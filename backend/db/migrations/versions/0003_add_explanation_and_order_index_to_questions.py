"""Add explanation and order_index to questions
Revision ID: 0003_add_explanation_and_order_index_to_questions
Revises: 0002_add_document_chunks
Create Date: 2026-10-20 15:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "0003_add_explanation_and_order_index_to_questions"
down_revision: Union[str, None] = "0002_add_document_chunks"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()

    if "questions" in tables:
        columns = [c["name"] for c in inspector.get_columns("questions")]
        if "explanation" not in columns:
            op.add_column("questions", sa.Column("explanation", sa.Text(), nullable=True))
        if "order_index" not in columns:
            op.add_column("questions", sa.Column("order_index", sa.Integer(), nullable=False, server_default="0"))
            op.create_index("ix_questions_module_order", "questions", ["module_id", "order_index"], unique=False)


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()

    if "questions" in tables:
        columns = [c["name"] for c in inspector.get_columns("questions")]
        if "order_index" in columns:
            try:
                op.drop_index("ix_questions_module_order", table_name="questions")
            except Exception:
                pass
            op.drop_column("questions", "order_index")
        if "explanation" in columns:
            op.drop_column("questions", "explanation")
