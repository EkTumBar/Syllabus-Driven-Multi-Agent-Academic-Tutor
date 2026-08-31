import pytest
import uuid
import os
import sys

BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from db.database import Base
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

SQLALCHEMY_TEST_DATABASE_URL = "sqlite:///:memory:"


@pytest.fixture
def db_session():
    engine = create_engine(
        SQLALCHEMY_TEST_DATABASE_URL,
        connect_args={"check_same_thread": False}
    )
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


def test_create_user_and_course(db_session):
    user = User(
        id=str(uuid.uuid4()),
        email="student@university.edu",
        hashed_password="fakehashedpassword",
        role="student"
    )
    db_session.add(user)
    db_session.commit()

    course = Course(
        id=str(uuid.uuid4()),
        user_id=user.id,
        title="CS101: Introduction to Computer Science",
        syllabus_raw="Module 1: Intro\nModule 2: Algorithms"
    )
    db_session.add(course)
    db_session.commit()

    assert user.id is not None
    assert len(user.courses) == 1
    assert user.courses[0].title == "CS101: Introduction to Computer Science"


def test_module_and_questions_cascade(db_session):
    user = User(
        id=str(uuid.uuid4()),
        email="prof@university.edu",
        hashed_password="fakehashedpassword",
        role="admin"
    )
    db_session.add(user)
    db_session.commit()

    course = Course(
        id=str(uuid.uuid4()),
        user_id=user.id,
        title="Physics 101",
        syllabus_raw="Unit 1: Kinematics"
    )
    db_session.add(course)
    db_session.commit()

    module = Module(
        id=str(uuid.uuid4()),
        course_id=course.id,
        title="Kinematics",
        order_index=1,
        prerequisites_json=["Basic Math"]
    )
    db_session.add(module)
    db_session.commit()

    question = Question(
        id=str(uuid.uuid4()),
        module_id=module.id,
        question_text="What is velocity?",
        options_json=["Speed with direction", "Scalar speed", "Force", "Mass"],
        correct_answer="Speed with direction",
        difficulty="easy"
    )
    db_session.add(question)
    db_session.commit()

    assert len(course.modules) == 1
    assert len(module.questions) == 1
    assert module.questions[0].correct_answer == "Speed with direction"


def test_mastery_and_orchestrator_state(db_session):
    user = User(
        id=str(uuid.uuid4()),
        email="learner@university.edu",
        hashed_password="fakehashedpassword",
        role="student"
    )
    db_session.add(user)
    db_session.commit()

    course = Course(
        id=str(uuid.uuid4()),
        user_id=user.id,
        title="Calculus I",
        syllabus_raw="Derivatives, Integrals"
    )
    db_session.add(course)
    db_session.commit()

    module = Module(
        id=str(uuid.uuid4()),
        course_id=course.id,
        title="Derivatives",
        order_index=1
    )
    db_session.add(module)
    db_session.commit()

    mastery = MasteryProfile(
        id=str(uuid.uuid4()),
        user_id=user.id,
        module_id=module.id,
        topic="Power Rule",
        score_0to1=0.85,
        attempts_count=3
    )
    db_session.add(mastery)

    state = OrchestratorState(
        id=str(uuid.uuid4()),
        course_id=course.id,
        user_id=user.id,
        current_module=module.id,
        last_evaluation={"score": 0.85, "status": "passed"},
        status="in_progress"
    )
    db_session.add(state)
    db_session.commit()

    assert mastery.score_0to1 == 0.85
    assert state.status == "in_progress"
