from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import select, and_, desc
from db.models import (
    User,
    Course,
    Module,
    Document,
    Question,
    Attempt,
    MasteryProfile,
    OrchestratorState,
    AdminLog
)


# ---------------------------------------------------------
# User CRUD
# ---------------------------------------------------------
def get_user_by_id(db: Session, user_id: str) -> Optional[User]:
    return db.query(User).filter(User.id == user_id).first()


def get_user_by_email(db: Session, email: str) -> Optional[User]:
    return db.query(User).filter(User.email == email).first()


def create_user(db: Session, email: str, hashed_password: str, role: str = "student") -> User:
    user = User(email=email, hashed_password=hashed_password, role=role)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def get_all_users(db: Session, skip: int = 0, limit: int = 100) -> List[User]:
    return db.query(User).offset(skip).limit(limit).all()


def delete_user(db: Session, user_id: str) -> bool:
    user = get_user_by_id(db, user_id)
    if not user:
        return False
    db.delete(user)
    db.commit()
    return True


# ---------------------------------------------------------
# Course CRUD (Multi-tenant scoped by user_id)
# ---------------------------------------------------------
def create_course(db: Session, user_id: str, title: str, syllabus_raw: str) -> Course:
    course = Course(user_id=user_id, title=title, syllabus_raw=syllabus_raw)
    db.add(course)
    db.commit()
    db.refresh(course)
    return course


def get_courses_by_user(db: Session, user_id: str) -> List[Course]:
    return db.query(Course).filter(Course.user_id == user_id).order_by(desc(Course.created_at)).all()


def get_course_by_id(db: Session, course_id: str, user_id: Optional[str] = None) -> Optional[Course]:
    query = db.query(Course).filter(Course.id == course_id)
    if user_id is not None:
        query = query.filter(Course.user_id == user_id)
    return query.first()


get_course = get_course_by_id


def delete_course(db: Session, course_id: str, user_id: Optional[str] = None) -> bool:
    course = get_course_by_id(db, course_id, user_id=user_id)
    if not course:
        return False
    db.delete(course)
    db.commit()
    return True


# ---------------------------------------------------------
# Module CRUD
# ---------------------------------------------------------
def create_module(
    db: Session,
    course_id: str,
    title: str,
    order_index: int = 0,
    prerequisites_json: Optional[List[str]] = None
) -> Module:
    module = Module(
        course_id=course_id,
        title=title,
        order_index=order_index,
        prerequisites_json=prerequisites_json or []
    )
    db.add(module)
    db.commit()
    db.refresh(module)
    return module


def get_modules_by_course(db: Session, course_id: str) -> List[Module]:
    return db.query(Module).filter(Module.course_id == course_id).order_by(Module.order_index).all()


def get_module_by_id(db: Session, module_id: str) -> Optional[Module]:
    return db.query(Module).filter(Module.id == module_id).first()


get_module = get_module_by_id


# ---------------------------------------------------------
# Document CRUD
# ---------------------------------------------------------
def create_document(db: Session, course_id: str, filename: str, storage_url: str) -> Document:
    doc = Document(course_id=course_id, filename=filename, storage_url=storage_url)
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc


def get_documents_by_course(db: Session, course_id: str) -> List[Document]:
    return db.query(Document).filter(Document.course_id == course_id).order_by(desc(Document.indexed_at)).all()


# ---------------------------------------------------------
# Question CRUD
# ---------------------------------------------------------
def create_question(
    db: Session,
    module_id: str,
    question_text: str,
    options_json: List[str],
    correct_answer: str,
    difficulty: str = "medium"
) -> Question:
    question = Question(
        module_id=module_id,
        question_text=question_text,
        options_json=options_json,
        correct_answer=correct_answer,
        difficulty=difficulty
    )
    db.add(question)
    db.commit()
    db.refresh(question)
    return question


def get_questions_by_module(db: Session, module_id: str, difficulty: Optional[str] = None) -> List[Question]:
    query = db.query(Question).filter(Question.module_id == module_id)
    if difficulty:
        query = query.filter(Question.difficulty == difficulty)
    return query.all()


def get_question_by_id(db: Session, question_id: str) -> Optional[Question]:
    return db.query(Question).filter(Question.id == question_id).first()


get_question = get_question_by_id


# ---------------------------------------------------------
# Attempt CRUD (Multi-tenant scoped by user_id)
# ---------------------------------------------------------
def create_attempt(
    db: Session,
    user_id: str,
    question_id: str,
    answer_given: str,
    is_correct: bool
) -> Attempt:
    attempt = Attempt(
        user_id=user_id,
        question_id=question_id,
        answer_given=answer_given,
        is_correct=is_correct
    )
    db.add(attempt)
    db.commit()
    db.refresh(attempt)
    return attempt


def get_attempts_by_user(db: Session, user_id: str, question_id: Optional[str] = None) -> List[Attempt]:
    query = db.query(Attempt).filter(Attempt.user_id == user_id)
    if question_id:
        query = query.filter(Attempt.question_id == question_id)
    return query.order_by(desc(Attempt.timestamp)).all()


# ---------------------------------------------------------
# Mastery Profile CRUD (Multi-tenant scoped by user_id)
# ---------------------------------------------------------
def get_mastery_by_user(db: Session, user_id: str, module_id: Optional[str] = None) -> List[MasteryProfile]:
    query = db.query(MasteryProfile).filter(MasteryProfile.user_id == user_id)
    if module_id:
        query = query.filter(MasteryProfile.module_id == module_id)
    return query.order_by(desc(MasteryProfile.last_updated)).all()


def get_mastery_record(db: Session, user_id: str, module_id: str, topic: str) -> Optional[MasteryProfile]:
    return db.query(MasteryProfile).filter(
        and_(
            MasteryProfile.user_id == user_id,
            MasteryProfile.module_id == module_id,
            MasteryProfile.topic == topic
        )
    ).first()


def upsert_mastery(
    db: Session,
    user_id: str,
    module_id: str,
    topic: str,
    score_0to1: float,
    increment_attempt: bool = True
) -> MasteryProfile:
    record = get_mastery_record(db, user_id=user_id, module_id=module_id, topic=topic)
    if record:
        record.score_0to1 = max(0.0, min(1.0, score_0to1))
        if increment_attempt:
            record.attempts_count += 1
    else:
        record = MasteryProfile(
            user_id=user_id,
            module_id=module_id,
            topic=topic,
            score_0to1=max(0.0, min(1.0, score_0to1)),
            attempts_count=1 if increment_attempt else 0
        )
        db.add(record)
    db.commit()
    db.refresh(record)
    return record


# ---------------------------------------------------------
# Orchestrator State CRUD (Multi-tenant scoped by user_id)
# ---------------------------------------------------------
def get_orchestrator_state(db: Session, user_id: str, course_id: str) -> Optional[OrchestratorState]:
    return db.query(OrchestratorState).filter(
        and_(
            OrchestratorState.user_id == user_id,
            OrchestratorState.course_id == course_id
        )
    ).first()


def upsert_orchestrator_state(
    db: Session,
    user_id: str,
    course_id: str,
    current_module: Optional[str] = None,
    last_evaluation: Optional[Dict[str, Any]] = None,
    status: str = "idle"
) -> OrchestratorState:
    state = get_orchestrator_state(db, user_id=user_id, course_id=course_id)
    if state:
        if current_module is not None:
            state.current_module = current_module
        if last_evaluation is not None:
            state.last_evaluation = last_evaluation
        state.status = status
    else:
        state = OrchestratorState(
            course_id=course_id,
            user_id=user_id,
            current_module=current_module,
            last_evaluation=last_evaluation,
            status=status
        )
        db.add(state)
    db.commit()
    db.refresh(state)
    return state


# ---------------------------------------------------------
# Admin Log CRUD
# ---------------------------------------------------------
def create_admin_log(
    db: Session,
    admin_id: Optional[str],
    action: str,
    target_user_id: Optional[str] = None,
    details_json: Optional[Dict[str, Any]] = None
) -> AdminLog:
    log = AdminLog(
        admin_id=admin_id,
        action=action,
        target_user_id=target_user_id,
        details_json=details_json
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log


def get_admin_logs(db: Session, skip: int = 0, limit: int = 50) -> List[AdminLog]:
    return db.query(AdminLog).order_by(desc(AdminLog.timestamp)).offset(skip).limit(limit).all()
