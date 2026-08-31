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

# Determine target database URL
configured_url = config.get_main_option("sqlalchemy.url")
if configured_url and (configured_url.startswith("sqlite") or "test" in configured_url):
    db_url = configured_url
elif settings.DATABASE_URL:
    db_url = settings.DATABASE_URL
else:
    db_url = configured_url or "sqlite:///./app_data.db"

# If in cloud environment and still configured to default localhost, fallback to sqlite
if (os.getenv("RENDER") or settings.ENVIRONMENT == "production") and "localhost:5432" in str(db_url):
    db_url = "sqlite:///./app_data.db"

if db_url:
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql+psycopg://", 1)
    elif db_url.startswith("postgresql://"):
        db_url = db_url.replace("postgresql://", "postgresql+psycopg://", 1)
    elif db_url.startswith("postgresql+psycopg2://"):
        db_url = db_url.replace("postgresql+psycopg2://", "postgresql+psycopg://", 1)
    
    # Escape percent characters for ConfigParser interpolation safety
    config.set_main_option("sqlalchemy.url", db_url.replace("%", "%%"))


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    context.configure(
        url=db_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
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
