import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    String,
    Text,
    Integer,
    Float,
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    JSON,
    func
)
from sqlalchemy.orm import relationship
from db.database import Base


def generate_uuid() -> str:
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(50), default="student", nullable=False)  # 'student' | 'admin'
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    courses = relationship("Course", back_populates="user", cascade="all, delete-orphan")
    attempts = relationship("Attempt", back_populates="user", cascade="all, delete-orphan")
    mastery_records = relationship("MasteryProfile", back_populates="user", cascade="all, delete-orphan")
    orchestrator_states = relationship("OrchestratorState", back_populates="user", cascade="all, delete-orphan")
    admin_logs = relationship("AdminLog", back_populates="admin", foreign_keys="[AdminLog.admin_id]")


class Course(Base):
    __tablename__ = "courses"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    title = Column(String(255), nullable=False)
    syllabus_raw = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Composite Indexes
    __table_args__ = (
        Index("ix_courses_user_id_created", "user_id", "created_at"),
    )

    # Relationships
    user = relationship("User", back_populates="courses")
    modules = relationship("Module", back_populates="course", cascade="all, delete-orphan", passive_deletes=True, order_by="Module.order_index")
    documents = relationship("Document", back_populates="course", cascade="all, delete-orphan", passive_deletes=True)
    chunks = relationship("DocumentChunk", back_populates="course", cascade="all, delete-orphan", passive_deletes=True)
    orchestrator_state = relationship("OrchestratorState", back_populates="course", uselist=False, cascade="all, delete-orphan", passive_deletes=True)


class Module(Base):
    __tablename__ = "modules"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    course_id = Column(String(36), ForeignKey("courses.id", ondelete="CASCADE"), index=True, nullable=False)
    title = Column(String(255), nullable=False)
    order_index = Column(Integer, default=0, nullable=False)
    prerequisites_json = Column(JSON, nullable=True)

    # Composite Indexes
    __table_args__ = (
        Index("ix_modules_course_order", "course_id", "order_index"),
    )

    # Relationships
    course = relationship("Course", back_populates="modules")
    questions = relationship("Question", back_populates="module", cascade="all, delete-orphan", passive_deletes=True)
    mastery_records = relationship("MasteryProfile", back_populates="module", cascade="all, delete-orphan", passive_deletes=True)


class Document(Base):
    __tablename__ = "documents"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    course_id = Column(String(36), ForeignKey("courses.id", ondelete="CASCADE"), index=True, nullable=False)
    filename = Column(String(255), nullable=False)
    storage_url = Column(String(1024), nullable=False)
    indexed_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    course = relationship("Course", back_populates="documents")


class DocumentChunk(Base):
    __tablename__ = "document_chunks"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    course_id = Column(String(36), ForeignKey("courses.id", ondelete="CASCADE"), index=True, nullable=False)
    content = Column(Text, nullable=False)
    embedding_json = Column(JSON, nullable=False)
    metadata_json = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Composite Indexes
    __table_args__ = (
        Index("ix_document_chunks_course_created", "course_id", "created_at"),
    )

    # Relationships
    course = relationship("Course", back_populates="chunks")


class Question(Base):
    __tablename__ = "questions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    module_id = Column(String(36), ForeignKey("modules.id", ondelete="CASCADE"), index=True, nullable=False)
    question_text = Column(Text, nullable=False)
    options_json = Column(JSON, nullable=False)
    correct_answer = Column(Text, nullable=False)
    difficulty = Column(String(50), default="medium", nullable=False)

    # Composite Indexes
    __table_args__ = (
        Index("ix_questions_module_difficulty", "module_id", "difficulty"),
    )

    # Relationships
    module = relationship("Module", back_populates="questions")
    attempts = relationship("Attempt", back_populates="question", cascade="all, delete-orphan", passive_deletes=True)


class Attempt(Base):
    __tablename__ = "attempts"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    question_id = Column(String(36), ForeignKey("questions.id", ondelete="CASCADE"), index=True, nullable=False)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    answer_given = Column(Text, nullable=False)
    is_correct = Column(Boolean, nullable=False)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Composite Indexes
    __table_args__ = (
        Index("ix_attempts_user_question", "user_id", "question_id"),
        Index("ix_attempts_user_timestamp", "user_id", "timestamp"),
    )

    # Relationships
    question = relationship("Question", back_populates="attempts")
    user = relationship("User", back_populates="attempts")


class MasteryProfile(Base):
    __tablename__ = "mastery_profile"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    module_id = Column(String(36), ForeignKey("modules.id", ondelete="CASCADE"), index=True, nullable=False)
    topic = Column(String(255), nullable=False)
    score_0to1 = Column(Float, default=0.0, nullable=False)
    last_updated = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    attempts_count = Column(Integer, default=0, nullable=False)

    # Composite Indexes
    __table_args__ = (
        Index("ix_mastery_user_module", "user_id", "module_id"),
        Index("ix_mastery_user_topic", "user_id", "topic"),
    )

    # Relationships
    user = relationship("User", back_populates="mastery_records")
    module = relationship("Module", back_populates="mastery_records")


class OrchestratorState(Base):
    __tablename__ = "orchestrator_state"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    course_id = Column(String(36), ForeignKey("courses.id", ondelete="CASCADE"), index=True, nullable=False)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    current_module = Column(String(255), nullable=True)
    last_evaluation = Column(JSON, nullable=True)
    status = Column(String(50), default="idle", nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Composite Indexes
    __table_args__ = (
        Index("ix_orchestrator_user_course", "user_id", "course_id"),
    )

    # Relationships
    course = relationship("Course", back_populates="orchestrator_state")
    user = relationship("User", back_populates="orchestrator_states")


class AdminLog(Base):
    __tablename__ = "admin_logs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    admin_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), index=True, nullable=True)
    action = Column(String(100), nullable=False)
    target_user_id = Column(String(36), index=True, nullable=True)
    details_json = Column(JSON, nullable=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Composite Indexes
    __table_args__ = (
        Index("ix_admin_logs_admin_timestamp", "admin_id", "timestamp"),
    )

    # Relationships
    admin = relationship("User", back_populates="admin_logs", foreign_keys=[admin_id])
