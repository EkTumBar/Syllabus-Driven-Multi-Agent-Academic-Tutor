import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from config import settings


def get_normalized_database_url(url: str) -> str:
    if not url:
        return "sqlite:///./dev_fallback.db"
    # If psycopg2 is requested but not installed, fallback to psycopg (v3)
    if url.startswith("postgresql+psycopg2://"):
        try:
            import psycopg2
        except ImportError:
            url = url.replace("postgresql+psycopg2://", "postgresql+psycopg://", 1)
    elif url.startswith("postgresql://"):
        try:
            import psycopg2
        except ImportError:
            url = url.replace("postgresql://", "postgresql+psycopg://", 1)
    return url


database_url = get_normalized_database_url(settings.DATABASE_URL)

# Support sqlite connect_args if sqlite is used in tests/dev
connect_args = {}
if database_url.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(
    database_url,
    connect_args=connect_args,
    pool_pre_ping=True
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """Dependency that provides a database session and ensures it closes after request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
