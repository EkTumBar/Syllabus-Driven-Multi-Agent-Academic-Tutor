"""Add profile fields to users table

Revision ID: 0005_user_profile_fields
Revises: 0004_course_lifecycle
Create Date: 2026-10-28 23:54:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = "0005_user_profile_fields"
down_revision: Union[str, None] = "0004_course_lifecycle"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [c["name"] for c in inspector.get_columns("users")]
    with op.batch_alter_table("users") as batch_op:
        if "first_name" not in columns:
            batch_op.add_column(sa.Column("first_name", sa.String(100), nullable=True))
        if "last_name" not in columns:
            batch_op.add_column(sa.Column("last_name", sa.String(100), nullable=True))
        if "username" not in columns:
            batch_op.add_column(sa.Column("username", sa.String(100), nullable=True))
        if "phone_number" not in columns:
            batch_op.add_column(sa.Column("phone_number", sa.String(50), nullable=True))
        if "location" not in columns:
            batch_op.add_column(sa.Column("location", sa.String(255), nullable=True))
        if "avatar_url" not in columns:
            batch_op.add_column(sa.Column("avatar_url", sa.Text(), nullable=True))
        if "preferences_json" not in columns:
            batch_op.add_column(sa.Column("preferences_json", sa.JSON(), nullable=True))


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [c["name"] for c in inspector.get_columns("users")]
    with op.batch_alter_table("users") as batch_op:
        for col_name in ["preferences_json", "avatar_url", "location", "phone_number", "username", "last_name", "first_name"]:
            if col_name in columns:
                batch_op.drop_column(col_name)
