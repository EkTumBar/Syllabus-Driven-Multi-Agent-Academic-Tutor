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
        from sqlalchemy import inspect, text
        Base.metadata.create_all(bind=engine)
        
        # Verify questions and courses columns exist (handles existing databases without alembic sync)
        with engine.connect() as conn:
            inspector = inspect(conn)
            if "courses" in inspector.get_table_names():
                course_cols = [c["name"] for c in inspector.get_columns("courses")]
                if "is_archived" not in course_cols:
                    conn.execute(text("ALTER TABLE courses ADD COLUMN is_archived BOOLEAN DEFAULT FALSE NOT NULL;"))
                    conn.commit()

            if "questions" in inspector.get_table_names():
                cols = [c["name"] for c in inspector.get_columns("questions")]
                if "explanation" not in cols:
                    conn.execute(text("ALTER TABLE questions ADD COLUMN explanation TEXT;"))
                    conn.commit()
                if "order_index" not in cols:
                    conn.execute(text("ALTER TABLE questions ADD COLUMN order_index INTEGER DEFAULT 0 NOT NULL;"))
                    conn.commit()

            if "users" in inspector.get_table_names():
                user_cols = [c["name"] for c in inspector.get_columns("users")]
                cols_to_add = [
                    ("first_name", "VARCHAR(100)"),
                    ("last_name", "VARCHAR(100)"),
                    ("username", "VARCHAR(100)"),
                    ("phone_number", "VARCHAR(50)"),
                    ("location", "VARCHAR(255)"),
                    ("avatar_url", "TEXT"),
                    ("preferences_json", "JSON")
                ]
                for col_name, col_type in cols_to_add:
                    if col_name not in user_cols:
                        conn.execute(text(f"ALTER TABLE users ADD COLUMN {col_name} {col_type};"))
                        conn.commit()

        logger.info("Database schema tables and columns verified successfully.")
    except Exception as e:
        logger.warning("Database schema check notice: %s", str(e))


if __name__ == "__main__":
    run_db_migrations()

