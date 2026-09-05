import os
import pytest
from alembic.config import Config
from alembic import command
from sqlalchemy import create_engine, inspect

# Use temporary SQLite DB file for migration test
TEST_DB_PATH = "test_migrations.db"
TEST_DB_URL = f"sqlite:///{TEST_DB_PATH}"


@pytest.fixture(scope="module")
def setup_migration_db():
    if os.path.exists(TEST_DB_PATH):
        os.remove(TEST_DB_PATH)
    yield
    if os.path.exists(TEST_DB_PATH):
        os.remove(TEST_DB_PATH)


def test_alembic_upgrade_and_downgrade(setup_migration_db):
    backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    alembic_cfg = Config(os.path.join(backend_dir, "alembic.ini"))
    alembic_cfg.set_main_option("script_location", os.path.join(backend_dir, "db", "migrations"))
    alembic_cfg.set_main_option("sqlalchemy.url", TEST_DB_URL)

    # 1. Upgrade to head
    command.upgrade(alembic_cfg, "head")

    # 2. Inspect created tables
    engine = create_engine(TEST_DB_URL)
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())

    expected_tables = {
        "users",
        "courses",
        "modules",
        "documents",
        "document_chunks",
        "questions",
        "attempts",
        "mastery_profile",
        "orchestrator_state",
        "admin_logs",
        "alembic_version"
    }

    assert expected_tables.issubset(tables), f"Missing tables: {expected_tables - tables}"

    # 3. Check indexes on courses (ownership index)
    course_indexes = {idx["name"] for idx in inspector.get_indexes("courses")}
    assert "ix_courses_user_id" in course_indexes or "ix_courses_user_id_created" in course_indexes

    # 4. Downgrade to base
    command.downgrade(alembic_cfg, "base")
    engine.dispose()

    # 5. Inspect dropped tables
    engine2 = create_engine(TEST_DB_URL)
    inspector2 = inspect(engine2)
    remaining_tables = set(inspector2.get_table_names()) - {"alembic_version"}
    assert len(remaining_tables) == 0, f"Tables not dropped: {remaining_tables}"
    engine2.dispose()
