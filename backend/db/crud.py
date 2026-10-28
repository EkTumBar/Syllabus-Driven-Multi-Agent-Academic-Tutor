from typing import List, Optional, Dict, Any
import logging
from sqlalchemy.orm import Session
from sqlalchemy import select, and_, desc
from db.models import (
    User,
    Course,
    Module,
    Document,
    DocumentChunk,
    Question,
    Attempt,
    MasteryProfile,
    OrchestratorState,
    AdminLog,
    UserProgress
)

logger = logging.getLogger("crud")


# ---------------------------------------------------------
# User CRUD
# ---------------------------------------------------------
def get_user_by_id(db: Session, user_id: str) -> Optional[User]:
    return db.query(User).filter(User.id == user_id).first()


def get_user_by_email(db: Session, email: str) -> Optional[User]:
    return db.query(User).filter(User.email == email).first()


def create_user(
    db: Session,
    email: str,
    hashed_password: str,
    role: str = "student",
    first_name: Optional[str] = None,
    last_name: Optional[str] = None,
    username: Optional[str] = None,
    phone_number: Optional[str] = None,
    location: Optional[str] = None,
    avatar_url: Optional[str] = None,
    preferences_json: Optional[Dict[str, Any]] = None,
) -> User:
    user = User(
        email=email,
        hashed_password=hashed_password,
        role=role,
        first_name=first_name,
        last_name=last_name,
        username=username,
        phone_number=phone_number,
        location=location,
        avatar_url=avatar_url,
        preferences_json=preferences_json,
    )
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


def update_user_profile(
    db: Session,
    user_id: str,
    first_name: Optional[str] = None,
    last_name: Optional[str] = None,
    username: Optional[str] = None,
    phone_number: Optional[str] = None,
    location: Optional[str] = None,
    avatar_url: Optional[str] = None,
    preferences_json: Optional[Dict[str, Any]] = None
) -> Optional[User]:
    user = get_user_by_id(db, user_id)
    if not user:
        return None
    if first_name is not None:
        user.first_name = first_name
    if last_name is not None:
        user.last_name = last_name
    if username is not None:
        user.username = username.strip() if username.strip() else None
    if phone_number is not None:
        user.phone_number = phone_number.strip() if phone_number.strip() else None
    if location is not None:
        user.location = location.strip() if location.strip() else None
    if avatar_url is not None:
        user.avatar_url = avatar_url
    if preferences_json is not None:
        user.preferences_json = preferences_json
    db.commit()
    db.refresh(user)
    return user


def update_user_password(db: Session, user_id: str, hashed_password: str) -> Optional[User]:
    user = get_user_by_id(db, user_id)
    if not user:
        return None
    user.hashed_password = hashed_password
    db.commit()
    db.refresh(user)
    return user


# ---------------------------------------------------------
# Course CRUD (Multi-tenant scoped by user_id)
# ---------------------------------------------------------
def create_course(db: Session, user_id: str, title: str, syllabus_raw: str) -> Course:
    course = Course(user_id=user_id, title=title, syllabus_raw=syllabus_raw)
    db.add(course)
    db.commit()
    db.refresh(course)
    return course


def get_courses_by_user(db: Session, user_id: str, include_archived: bool = False) -> List[Course]:
    query = db.query(Course).filter(Course.user_id == user_id)
    if not include_archived:
        query = query.filter(Course.is_archived.is_(False))
    return query.order_by(desc(Course.created_at)).all()


def get_course_by_id(db: Session, course_id: str, user_id: Optional[str] = None) -> Optional[Course]:
    query = db.query(Course).filter(Course.id == course_id)
    if user_id is not None:
        query = query.filter(Course.user_id == user_id)
    return query.first()


get_course = get_course_by_id


def archive_course(db: Session, course_id: str, is_archived: bool = True, user_id: Optional[str] = None) -> Optional[Course]:
    """Sets the is_archived flag on a course (soft delete)."""
    course = get_course_by_id(db, course_id, user_id=user_id)
    if not course:
        return None
    course.is_archived = is_archived
    db.commit()
    db.refresh(course)
    return course


def delete_course(db: Session, course_id: str, user_id: Optional[str] = None) -> bool:
    """
    Deletes a course and cleanly deletes all child records in dependency order:
    UserProgress -> Attempts -> Questions -> MasteryProfile -> Modules -> OrchestratorState ->
    DocumentChunks -> Documents -> Course.
    """
    course = get_course_by_id(db, course_id, user_id=user_id)
    if not course:
        return False

    try:
        # 1. Cleanly delete child records in reverse dependency order
        db.query(UserProgress).filter(UserProgress.course_id == course_id).delete(synchronize_session=False)

        module_rows = db.query(Module.id).filter(Module.course_id == course_id).all()
        module_ids = [m[0] for m in module_rows]

        if module_ids:
            question_rows = db.query(Question.id).filter(Question.module_id.in_(module_ids)).all()
            question_ids = [q[0] for q in question_rows]

            if question_ids:
                db.query(Attempt).filter(Attempt.question_id.in_(question_ids)).delete(synchronize_session=False)
                db.query(Question).filter(Question.id.in_(question_ids)).delete(synchronize_session=False)

            db.query(MasteryProfile).filter(MasteryProfile.module_id.in_(module_ids)).delete(synchronize_session=False)
            db.query(Module).filter(Module.id.in_(module_ids)).delete(synchronize_session=False)

        db.query(OrchestratorState).filter(OrchestratorState.course_id == course_id).delete(synchronize_session=False)

        try:
            db.query(DocumentChunk).filter(DocumentChunk.course_id == course_id).delete(synchronize_session=False)
        except Exception as chunk_err:
            logger.warning("Could not delete from document_chunks table: %s", str(chunk_err))
            db.rollback()

        db.query(Document).filter(Document.course_id == course_id).delete(synchronize_session=False)

        # 2. Delete the course itself via ORM session delete
        db.delete(course)
        db.commit()
        return True
    except Exception as e:
        logger.error("Explicit deletion failed for course %s: %s", course_id, str(e), exc_info=True)
        db.rollback()
        raise e


# ---------------------------------------------------------
# User Progress CRUD
# ---------------------------------------------------------
def get_user_progress(
    db: Session,
    user_id: str,
    course_id: str,
    module_id: Optional[str] = None
) -> Optional[UserProgress]:
    query = db.query(UserProgress).filter(
        UserProgress.user_id == user_id,
        UserProgress.course_id == course_id
    )
    if module_id:
        query = query.filter(UserProgress.module_id == module_id)
    else:
        query = query.order_by(desc(UserProgress.updated_at))
    return query.first()


def upsert_user_progress(
    db: Session,
    user_id: str,
    course_id: str,
    current_question_index: int,
    answers_submitted: Optional[List[Any]] = None,
    module_id: Optional[str] = None
) -> UserProgress:
    query = db.query(UserProgress).filter(
        UserProgress.user_id == user_id,
        UserProgress.course_id == course_id
    )
    if module_id is not None:
        query = query.filter(UserProgress.module_id == module_id)
    else:
        query = query.filter(UserProgress.module_id.is_(None))

    progress = query.first()
    if progress:
        progress.current_question_index = max(0, current_question_index)
        if answers_submitted is not None:
            progress.answers_submitted = answers_submitted
    else:
        progress = UserProgress(
            user_id=user_id,
            course_id=course_id,
            module_id=module_id,
            current_question_index=max(0, current_question_index),
            answers_submitted=answers_submitted or []
        )
        db.add(progress)

    db.commit()
    db.refresh(progress)
    return progress



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
    difficulty: str = "medium",
    explanation: Optional[str] = None,
    order_index: int = 0
) -> Question:
    question = Question(
        module_id=module_id,
        question_text=question_text,
        options_json=options_json,
        correct_answer=correct_answer,
        difficulty=difficulty,
        explanation=explanation,
        order_index=order_index
    )
    db.add(question)
    db.commit()
    db.refresh(question)
    return question


def get_questions_by_module(db: Session, module_id: str, difficulty: Optional[str] = None) -> List[Question]:
    query = db.query(Question).filter(Question.module_id == module_id)
    if difficulty:
        query = query.filter(Question.difficulty == difficulty)
    return query.order_by(Question.order_index, Question.id).all()


def get_questions_by_course(db: Session, course_id: str) -> List[Question]:
    modules = get_modules_by_course(db, course_id)
    module_ids = [m.id for m in modules]
    if not module_ids:
        return []
    return db.query(Question).filter(Question.module_id.in_(module_ids)).order_by(Question.order_index, Question.id).all()


def delete_questions_by_module(db: Session, module_id: str) -> int:
    q_ids = [q[0] for q in db.query(Question.id).filter(Question.module_id == module_id).all()]
    if q_ids:
        db.query(Attempt).filter(Attempt.question_id.in_(q_ids)).delete(synchronize_session=False)
    count = db.query(Question).filter(Question.module_id == module_id).delete(synchronize_session=False)
    db.commit()
    return count


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
