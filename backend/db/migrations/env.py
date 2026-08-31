import os
import sys
from logging.config import fileConfig
from sqlalchemy import create_engine, pool
from alembic import context

# Append current directory and parent to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from config import settings
from db.database import Base
import db.models  # Ensure all models are registered with Base.metadata

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# add your model's MetaData object here
# for 'autogenerate' support
target_metadata = Base.metadata

# Override sqlalchemy.url with environment configuration if not explicitly set in main options
current_main_url = config.get_main_option("sqlalchemy.url")
if not current_main_url or current_main_url.startswith("postgresql"):
    if settings.DATABASE_URL:
        db_url = settings.DATABASE_URL
        if db_url.startswith("postgresql://"):
            try:
                import psycopg2
            except ImportError:
                db_url = db_url.replace("postgresql://", "postgresql+psycopg://", 1)
        elif db_url.startswith("postgresql+psycopg2://"):
            try:
                import psycopg2
            except ImportError:
                db_url = db_url.replace("postgresql+psycopg2://", "postgresql+psycopg://", 1)
        config.set_main_option("sqlalchemy.url", db_url)


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    db_url = config.get_main_option("sqlalchemy.url")
    connect_args = {}
    if db_url and db_url.startswith("sqlite"):
        connect_args = {"check_same_thread": False}

    connectable = create_engine(
        db_url,
        connect_args=connect_args,
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
