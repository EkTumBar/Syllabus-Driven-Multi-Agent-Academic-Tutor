"""Initial schema with multi-tenant tables and indexes

Revision ID: 0001_initial_schema
Revises: 
Create Date: 2026-08-31 22:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "0001_initial_schema"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. users table
    op.create_table(
        "users",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("hashed_password", sa.String(length=255), nullable=False),
        sa.Column("role", sa.String(length=50), nullable=False, server_default="student"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email")
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    # 2. courses table
    op.create_table(
        "courses",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("syllabus_raw", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id")
    )
    op.create_index("ix_courses_user_id", "courses", ["user_id"], unique=False)
    op.create_index("ix_courses_user_id_created", "courses", ["user_id", "created_at"], unique=False)

    # 3. modules table
    op.create_table(
        "modules",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("course_id", sa.String(length=36), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("order_index", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("prerequisites_json", sa.JSON(), nullable=True),
        sa.ForeignKeyConstraint(["course_id"], ["courses.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id")
    )
    op.create_index("ix_modules_course_id", "modules", ["course_id"], unique=False)
    op.create_index("ix_modules_course_order", "modules", ["course_id", "order_index"], unique=False)

    # 4. documents table
    op.create_table(
        "documents",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("course_id", sa.String(length=36), nullable=False),
        sa.Column("filename", sa.String(length=255), nullable=False),
        sa.Column("storage_url", sa.String(length=1024), nullable=False),
        sa.Column("indexed_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.ForeignKeyConstraint(["course_id"], ["courses.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id")
    )
    op.create_index("ix_documents_course_id", "documents", ["course_id"], unique=False)

    # 5. questions table
    op.create_table(
        "questions",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("module_id", sa.String(length=36), nullable=False),
        sa.Column("question_text", sa.Text(), nullable=False),
        sa.Column("options_json", sa.JSON(), nullable=False),
        sa.Column("correct_answer", sa.Text(), nullable=False),
        sa.Column("difficulty", sa.String(length=50), nullable=False, server_default="medium"),
        sa.ForeignKeyConstraint(["module_id"], ["modules.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id")
    )
    op.create_index("ix_questions_module_id", "questions", ["module_id"], unique=False)
    op.create_index("ix_questions_module_difficulty", "questions", ["module_id", "difficulty"], unique=False)

    # 6. attempts table
    op.create_table(
        "attempts",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("question_id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("answer_given", sa.Text(), nullable=False),
        sa.Column("is_correct", sa.Boolean(), nullable=False),
        sa.Column("timestamp", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.ForeignKeyConstraint(["question_id"], ["questions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id")
    )
    op.create_index("ix_attempts_question_id", "attempts", ["question_id"], unique=False)
    op.create_index("ix_attempts_user_id", "attempts", ["user_id"], unique=False)
    op.create_index("ix_attempts_user_question", "attempts", ["user_id", "question_id"], unique=False)
    op.create_index("ix_attempts_user_timestamp", "attempts", ["user_id", "timestamp"], unique=False)

    # 7. mastery_profile table
    op.create_table(
        "mastery_profile",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("module_id", sa.String(length=36), nullable=False),
        sa.Column("topic", sa.String(length=255), nullable=False),
        sa.Column("score_0to1", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("last_updated", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("attempts_count", sa.Integer(), nullable=False, server_default="0"),
        sa.ForeignKeyConstraint(["module_id"], ["modules.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id")
    )
    op.create_index("ix_mastery_profile_user_id", "mastery_profile", ["user_id"], unique=False)
    op.create_index("ix_mastery_profile_module_id", "mastery_profile", ["module_id"], unique=False)
    op.create_index("ix_mastery_user_module", "mastery_profile", ["user_id", "module_id"], unique=False)
    op.create_index("ix_mastery_user_topic", "mastery_profile", ["user_id", "topic"], unique=False)

    # 8. orchestrator_state table
    op.create_table(
        "orchestrator_state",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("course_id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("current_module", sa.String(length=255), nullable=True),
        sa.Column("last_evaluation", sa.JSON(), nullable=True),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="idle"),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.ForeignKeyConstraint(["course_id"], ["courses.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id")
    )
    op.create_index("ix_orchestrator_state_course_id", "orchestrator_state", ["course_id"], unique=False)
    op.create_index("ix_orchestrator_state_user_id", "orchestrator_state", ["user_id"], unique=False)
    op.create_index("ix_orchestrator_user_course", "orchestrator_state", ["user_id", "course_id"], unique=False)

    # 9. admin_logs table
    op.create_table(
        "admin_logs",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("admin_id", sa.String(length=36), nullable=True),
        sa.Column("action", sa.String(length=100), nullable=False),
        sa.Column("target_user_id", sa.String(length=36), nullable=True),
        sa.Column("details_json", sa.JSON(), nullable=True),
        sa.Column("timestamp", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.ForeignKeyConstraint(["admin_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id")
    )
    op.create_index("ix_admin_logs_admin_id", "admin_logs", ["admin_id"], unique=False)
    op.create_index("ix_admin_logs_admin_timestamp", "admin_logs", ["admin_id", "timestamp"], unique=False)
    op.create_index("ix_admin_logs_target_user", "admin_logs", ["target_user_id"], unique=False)


def downgrade() -> None:
    op.drop_table("admin_logs")
    op.drop_table("orchestrator_state")
    op.drop_table("mastery_profile")
    op.drop_table("attempts")
    op.drop_table("questions")
    op.drop_table("documents")
    op.drop_table("modules")
    op.drop_table("courses")
    op.drop_table("users")
