"""Add is_archived to courses and create user_progress table
Revision ID: 0004_course_lifecycle
Revises: 0003_quiz_cbt_columns
Create Date: 2026-10-28 15:45:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = "0004_course_lifecycle"
down_revision: Union[str, None] = "0003_quiz_cbt_columns"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()

    # 1. Update courses table with is_archived soft-delete column and index
    if "courses" in tables:
        course_columns = [c["name"] for c in inspector.get_columns("courses")]
        with op.batch_alter_table("courses") as batch_op:
            if "is_archived" not in course_columns:
                batch_op.add_column(
                    sa.Column("is_archived", sa.Boolean(), server_default="false", nullable=False)
                )
        
        course_indexes = [idx["name"] for idx in inspector.get_indexes("courses")]
        if "ix_courses_user_archived" not in course_indexes:
            try:
                op.create_index(
                    "ix_courses_user_archived",
                    "courses",
                    ["user_id", "is_archived"],
                    unique=False
                )
            except Exception:
                pass

    # 2. Create user_progress persistence table
    if "user_progress" not in tables:
        op.create_table(
            "user_progress",
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.Column("user_id", sa.String(length=36), nullable=False),
            sa.Column("course_id", sa.String(length=36), nullable=False),
            sa.Column("module_id", sa.String(length=36), nullable=True),
            sa.Column("current_question_index", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("answers_submitted", sa.JSON(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["course_id"], ["courses.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["module_id"], ["modules.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id")
        )
        op.create_index("ix_user_progress_user_course_module", "user_progress", ["user_id", "course_id", "module_id"], unique=True)
        op.create_index("ix_user_progress_user_course", "user_progress", ["user_id", "course_id"], unique=False)


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()

    # 1. Drop user_progress table
    if "user_progress" in tables:
        try:
            op.drop_index("ix_user_progress_user_course", table_name="user_progress")
            op.drop_index("ix_user_progress_user_course_module", table_name="user_progress")
        except Exception:
            pass
        op.drop_table("user_progress")

    # 2. Revert courses table soft delete column
    if "courses" in tables:
        course_indexes = [idx["name"] for idx in inspector.get_indexes("courses")]
        if "ix_courses_user_archived" in course_indexes:
            try:
                op.drop_index("ix_courses_user_archived", table_name="courses")
            except Exception:
                pass

        course_columns = [c["name"] for c in inspector.get_columns("courses")]
        if "is_archived" in course_columns:
            with op.batch_alter_table("courses") as batch_op:
                batch_op.drop_column("is_archived")
