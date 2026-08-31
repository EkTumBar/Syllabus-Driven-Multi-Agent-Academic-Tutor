import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from config import settings


import logging

logger = logging.getLogger("database")


def get_normalized_database_url(url: str) -> str:
    if not url:
        return "sqlite:///./app_data.db"
    
    # If in cloud environment and still configured to default localhost, fallback to sqlite
    if (os.getenv("RENDER") or settings.ENVIRONMENT == "production") and "localhost:5432" in url:
        logger.warning("DATABASE_URL points to localhost in production. Falling back to local SQLite database.")
        return "sqlite:///./app_data.db"

    # Convert postgres/postgresql to postgresql+psycopg:// for SQLAlchemy 2.0 & psycopg v3 compatibility
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql+psycopg://", 1)
    elif url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+psycopg://", 1)
    elif url.startswith("postgresql+psycopg2://"):
        url = url.replace("postgresql+psycopg2://", "postgresql+psycopg://", 1)

    return url


database_url = get_normalized_database_url(settings.DATABASE_URL)

# Support sqlite connect_args if sqlite is used in tests/dev
connect_args = {}
if database_url.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(
    database_url,
    connect_args=connect_args,
    pool_pre_ping=True,
    pool_recycle=300
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
