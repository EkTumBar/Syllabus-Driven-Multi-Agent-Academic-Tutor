"""Enable Row Level Security (RLS) on all public tables

Revision ID: 0006_enable_rls_all_tables
Revises: 0005_user_profile_fields
Create Date: 2026-10-29 00:25:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = "0006_enable_rls_all_tables"
down_revision: Union[str, None] = "0005_user_profile_fields"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

PUBLIC_TABLES = [
    "admin_logs",
    "alembic_version",
    "attempts",
    "courses",
    "document_chunks",
    "documents",
    "mastery_profile",
    "modules",
    "orchestrator_state",
    "questions",
    "user_progress",
    "users",
]


def upgrade() -> None:
    conn = op.get_bind()
    if conn.dialect.name != "postgresql":
        return
    inspector = sa.inspect(conn)
    existing_tables = set(inspector.get_table_names())
    for table_name in PUBLIC_TABLES:
        if table_name in existing_tables:
            op.execute(f"ALTER TABLE public.{table_name} ENABLE ROW LEVEL SECURITY;")


def downgrade() -> None:
    conn = op.get_bind()
    if conn.dialect.name != "postgresql":
        return
    inspector = sa.inspect(conn)
    existing_tables = set(inspector.get_table_names())
    for table_name in PUBLIC_TABLES:
        if table_name in existing_tables:
            op.execute(f"ALTER TABLE public.{table_name} DISABLE ROW LEVEL SECURITY;")
