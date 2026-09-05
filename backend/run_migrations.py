import os
import sys
import logging
from alembic.config import Config
from alembic import command

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("migration_runner")


def run_db_migrations():
    """Runs Alembic migrations safely on startup with error handling."""
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    alembic_ini_path = os.path.join(backend_dir, "alembic.ini")

    if not os.path.exists(alembic_ini_path):
        logger.warning("alembic.ini not found at %s. Skipping migrations.", alembic_ini_path)
        return

    alembic_cfg = Config(alembic_ini_path)
    alembic_cfg.set_main_option("script_location", os.path.join(backend_dir, "db", "migrations"))

    try:
        logger.info("Executing database migrations (alembic upgrade head)...")
        command.upgrade(alembic_cfg, "head")
        logger.info("Database migrations applied successfully.")
    except Exception as e:
        logger.error("Database migration error: %s", str(e))
        logger.warning(
            "If using Supabase, ensure you use the Connection Pooler URL (aws-0-<region>.pooler.supabase.com) with IPv4 compatibility, and check that the Supabase database is active."
        )
        logger.warning("Continuing startup so the web service remains operational.")

    # Also run create_all idempotently to ensure all declared tables exist
    try:
        from db.database import engine, Base
        import db.models  # noqa: F401
        Base.metadata.create_all(bind=engine)
        logger.info("Database schema tables verified successfully.")
    except Exception as e:
        logger.warning("Base.metadata.create_all notice: %s", str(e))


if __name__ == "__main__":
    run_db_migrations()

