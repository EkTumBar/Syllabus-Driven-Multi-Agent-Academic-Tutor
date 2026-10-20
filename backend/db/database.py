import os
import logging
from contextlib import contextmanager
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from config import settings

logger = logging.getLogger("database")


def get_normalized_database_url(url: str) -> str:
    """
    Normalizes database URL for production & Supabase deployment:
    - Fallback to SQLite if localhost is configured in a cloud environment
    - Automatically routes Supabase connections to Transaction Pooler port (6543) instead of direct port (5432)
    - Appends pgbouncer=true query parameter to prevent pool exhaustion
    - Converts postgres:// / postgresql:// to postgresql+psycopg:// for SQLAlchemy 2.0 & psycopg v3 compatibility
    """
    if not url:
        return "sqlite:///./app_data.db"
    
    # If in cloud environment and still configured to default localhost, fallback to sqlite
    if (os.getenv("RENDER") or settings.ENVIRONMENT == "production") and "localhost:5432" in url:
        logger.warning("DATABASE_URL points to localhost in production. Falling back to local SQLite database.")
        return "sqlite:///./app_data.db"

    # Supabase Transaction Pooler optimization:
    # Port 5432 is the direct session port (very limited pool, easily exhausted).
    # Port 6543 is the PgBouncer/Supavisor transaction pooler port.
    is_supabase = "supabase.co" in url or "pooler.supabase.com" in url
    if is_supabase:
        if ":5432" in url:
            logger.info("Supabase direct port 5432 detected. Normalizing to Transaction Pooler port 6543.")
            url = url.replace(":5432", ":6543")
        
        # Ensure pgbouncer=true is appended
        if "pgbouncer=true" not in url:
            delimiter = "&" if "?" in url else "?"
            url = f"{url}{delimiter}pgbouncer=true"

    # Convert postgres/postgresql to postgresql+psycopg:// for SQLAlchemy 2.0 & psycopg v3 compatibility
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql+psycopg://", 1)
    elif url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+psycopg://", 1)
    elif url.startswith("postgresql+psycopg2://"):
        url = url.replace("postgresql+psycopg2://", "postgresql+psycopg://", 1)

    return url


database_url = get_normalized_database_url(settings.DATABASE_URL)

# Configure driver arguments
connect_args = {}
if database_url.startswith("sqlite"):
    connect_args = {"check_same_thread": False}
else:
    # 10 second socket connection timeout to prevent indefinite network hangs
    connect_args["connect_timeout"] = 10
    
    # When connecting to Supabase PgBouncer (Transaction Pooler), server-side prepared
    # statements are not supported in transaction mode. Disabling them prevents
    # 'prepared statement does not exist' errors in psycopg 3.
    if "postgresql+psycopg://" in database_url and ("pgbouncer=true" in database_url or ":6543" in database_url):
        connect_args["prepare_threshold"] = None

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
