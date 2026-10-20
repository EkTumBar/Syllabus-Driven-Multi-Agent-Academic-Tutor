import os
import logging
from contextlib import contextmanager
from urllib.parse import urlparse, urlunparse, urlencode, parse_qs
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from config import settings

logger = logging.getLogger("database")


def _strip_unsupported_params(url: str, params_to_remove: list) -> str:
    """
    Strips specified query parameters from a URL that are not valid
    libpq / psycopg connection options (e.g. pgbouncer=true).
    These must be handled at the SQLAlchemy / application level instead.
    """
    try:
        parsed = urlparse(url)
        qs = parse_qs(parsed.query, keep_blank_values=True)
        changed = False
        for p in params_to_remove:
            if p in qs:
                del qs[p]
                changed = True
        if not changed:
            return url
        new_query = urlencode({k: v[0] for k, v in qs.items()})
        return urlunparse(parsed._replace(query=new_query))
    except Exception:
        return url


def get_normalized_database_url(url: str) -> tuple[str, bool]:
    """
    Normalizes database URL for production & Supabase deployment.

    Returns:
        (normalized_url, is_pgbouncer_mode):
          - normalized_url: URL safe to pass to create_engine()
          - is_pgbouncer_mode: True if connection goes through PgBouncer/Supavisor
            (Supabase Transaction Pooler port 6543), requiring prepare_threshold=None

    Rules applied:
    - Fallback to SQLite if localhost is configured in a cloud environment
    - Detect Supabase hosts and normalize port 5432 -> 6543 (Transaction Pooler)
    - Strip ?pgbouncer=true (NOT a valid psycopg v3 / libpq connection option;
      causes psycopg.ProgrammingError: invalid connection option "pgbouncer")
    - Disable prepared statements via prepare_threshold=None in connect_args instead
    - Convert postgres:// / postgresql:// to postgresql+psycopg:// (psycopg v3)
    """
    if not url:
        return "sqlite:///./app_data.db", False

    # If in cloud environment and still configured to default localhost, fallback to sqlite
    if (os.getenv("RENDER") or settings.ENVIRONMENT == "production") and "localhost:5432" in url:
        logger.warning("DATABASE_URL points to localhost in production. Falling back to local SQLite database.")
        return "sqlite:///./app_data.db", False

    # Detect Supabase hosts (transaction pooler uses port 6543)
    is_supabase = "supabase.co" in url or "pooler.supabase.com" in url

    if is_supabase:
        if ":5432" in url:
            logger.info("Supabase direct port 5432 detected. Normalizing to Transaction Pooler port 6543.")
            url = url.replace(":5432", ":6543")

    # Determine if we are connecting through PgBouncer transaction pooler
    # (Supabase port 6543 is always the Supavisor/PgBouncer transaction pooler)
    is_pgbouncer_mode = is_supabase or ":6543" in url

    # CRITICAL: Strip ?pgbouncer=true from URL before passing to create_engine.
    # psycopg v3 forwards all URL query params to libpq's conninfo parser, which
    # does not recognise "pgbouncer" and raises:
    #   psycopg.ProgrammingError: invalid connection option "pgbouncer"
    # PgBouncer compatibility in psycopg v3 is achieved via prepare_threshold=None
    # in connect_args, NOT via the connection string.
    url = _strip_unsupported_params(url, ["pgbouncer"])

    # Convert postgres/postgresql to postgresql+psycopg:// for SQLAlchemy 2.0 & psycopg v3
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql+psycopg://", 1)
    elif url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+psycopg://", 1)
    elif url.startswith("postgresql+psycopg2://"):
        url = url.replace("postgresql+psycopg2://", "postgresql+psycopg://", 1)

    return url, is_pgbouncer_mode


# -------------------------------------------------------------------------
# Build engine
# -------------------------------------------------------------------------
database_url, _is_pgbouncer = get_normalized_database_url(settings.DATABASE_URL)

connect_args: dict = {}

if database_url.startswith("sqlite"):
    connect_args["check_same_thread"] = False
else:
    # 10-second socket connection timeout to fail fast on network issues
    connect_args["connect_timeout"] = 10

    if _is_pgbouncer:
        # psycopg v3: disable server-side prepared statements for PgBouncer
        # transaction mode. In transaction mode PgBouncer does not guarantee
        # sticky server sessions, so prepared statements created in one
        # transaction would not be visible in the next and cause:
        #   ERROR: prepared statement "..." does not exist
        connect_args["prepare_threshold"] = None
        logger.info(
            "PgBouncer / Supabase Transaction Pooler mode detected. "
            "Disabled prepared statements (prepare_threshold=None)."
        )

# Configure SQLAlchemy Engine
if database_url.startswith("sqlite"):
    engine = create_engine(
        database_url,
        connect_args=connect_args,
        pool_pre_ping=True
    )
else:
    engine = create_engine(
        database_url,
        connect_args=connect_args,
        pool_size=settings.DB_POOL_SIZE,
        max_overflow=settings.DB_MAX_OVERFLOW,
        pool_timeout=settings.DB_POOL_TIMEOUT,
        pool_recycle=settings.DB_POOL_RECYCLE,
        pool_pre_ping=True
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """Dependency that provides a database session and ensures it closes/rolls back safely after request."""
    db = SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


@contextmanager
def get_db_context():
    """Context manager providing a database session with automatic commit, rollback, and closure."""
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
