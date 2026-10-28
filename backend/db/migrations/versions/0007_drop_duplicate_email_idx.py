"""Drop duplicate email index on users table

Revision ID: 0007_drop_duplicate_email_idx
Revises: 0006_enable_rls_all_tables
Create Date: 2026-10-29 02:45:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = "0007_drop_duplicate_email_idx"
down_revision: Union[str, None] = "0006_enable_rls_all_tables"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_indexes = {idx["name"] for idx in inspector.get_indexes("users")}
    if "ix_users_email" in existing_indexes:
        op.drop_index("ix_users_email", table_name="users")


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_indexes = {idx["name"] for idx in inspector.get_indexes("users")}
    if "ix_users_email" not in existing_indexes:
        op.create_index("ix_users_email", "users", ["email"], unique=True)
