import pytest
import os
import sys

BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from db.database import Base
from db.models import User, Course, Module, Question
from db import crud

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


def test_tenant_isolation_courses(db_session):
    # 1. Create two distinct users
    user_a = crud.create_user(db_session, email="alice@test.com", hashed_password="pw_a", role="student")
    user_b = crud.create_user(db_session, email="bob@test.com", hashed_password="pw_b", role="student")

    # 2. Alice creates courses
    course_a1 = crud.create_course(db_session, user_id=user_a.id, title="Alice Bio", syllabus_raw="Bio Syllabus")
    course_a2 = crud.create_course(db_session, user_id=user_a.id, title="Alice Chem", syllabus_raw="Chem Syllabus")

    # 3. Bob creates a course
    course_b1 = crud.create_course(db_session, user_id=user_b.id, title="Bob Math", syllabus_raw="Math Syllabus")

    # 4. Verify Alice only sees her courses
    alice_courses = crud.get_courses_by_user(db_session, user_id=user_a.id)
    assert len(alice_courses) == 2
    assert set(c.id for c in alice_courses) == {course_a1.id, course_a2.id}

    # 5. Verify Bob only sees his courses
    bob_courses = crud.get_courses_by_user(db_session, user_id=user_b.id)
    assert len(bob_courses) == 1
    assert bob_courses[0].id == course_b1.id

    # 6. Verify scoped get_course_by_id blocks Bob from querying Alice's course
    assert crud.get_course_by_id(db_session, course_id=course_a1.id, user_id=user_b.id) is None
    assert crud.get_course_by_id(db_session, course_id=course_a1.id, user_id=user_a.id) is not None

    # 7. Verify Bob cannot delete Alice's course
    delete_result = crud.delete_course(db_session, course_id=course_a1.id, user_id=user_b.id)
    assert delete_result is False
    assert crud.get_course_by_id(db_session, course_id=course_a1.id) is not None

    # 8. Alice deletes her own course
    delete_result = crud.delete_course(db_session, course_id=course_a1.id, user_id=user_a.id)
    assert delete_result is True
    assert crud.get_course_by_id(db_session, course_id=course_a1.id) is None


def test_tenant_isolation_mastery_and_attempts(db_session):
    user_a = crud.create_user(db_session, email="alice_m@test.com", hashed_password="pw_a")
    user_b = crud.create_user(db_session, email="bob_m@test.com", hashed_password="pw_b")

    course = crud.create_course(db_session, user_id=user_a.id, title="Physics", syllabus_raw="Physics")
    module = crud.create_module(db_session, course_id=course.id, title="Optics", order_index=1)
    question = crud.create_question(
        db_session,
        module_id=module.id,
        question_text="What is refraction?",
        options_json=["Bending of light", "Absorption", "Reflection", "Diffraction"],
        correct_answer="Bending of light"
    )

    # Alice records mastery and attempt
    crud.upsert_mastery(db_session, user_id=user_a.id, module_id=module.id, topic="Snell's Law", score_0to1=0.9)
    crud.create_attempt(db_session, user_id=user_a.id, question_id=question.id, answer_given="Bending of light", is_correct=True)

    # Bob records mastery and attempt
    crud.upsert_mastery(db_session, user_id=user_b.id, module_id=module.id, topic="Snell's Law", score_0to1=0.4)
    crud.create_attempt(db_session, user_id=user_b.id, question_id=question.id, answer_given="Reflection", is_correct=False)

    # Verify Alice's mastery and attempts are isolated
    alice_mastery = crud.get_mastery_by_user(db_session, user_id=user_a.id)
    assert len(alice_mastery) == 1
    assert alice_mastery[0].score_0to1 == 0.9

    alice_attempts = crud.get_attempts_by_user(db_session, user_id=user_a.id)
    assert len(alice_attempts) == 1
    assert alice_attempts[0].is_correct is True

    # Verify Bob's mastery and attempts are isolated
    bob_mastery = crud.get_mastery_by_user(db_session, user_id=user_b.id)
    assert len(bob_mastery) == 1
    assert bob_mastery[0].score_0to1 == 0.4

    bob_attempts = crud.get_attempts_by_user(db_session, user_id=user_b.id)
    assert len(bob_attempts) == 1
    assert bob_attempts[0].is_correct is False


def test_tenant_isolation_orchestrator_state(db_session):
    user_a = crud.create_user(db_session, email="alice_o@test.com", hashed_password="pw_a")
    user_b = crud.create_user(db_session, email="bob_o@test.com", hashed_password="pw_b")

    course = crud.create_course(db_session, user_id=user_a.id, title="History", syllabus_raw="History")

    # Set state for Alice
    crud.upsert_orchestrator_state(
        db_session,
        user_id=user_a.id,
        course_id=course.id,
        current_module="mod_1",
        status="in_progress"
    )

    # Check Alice state
    state_a = crud.get_orchestrator_state(db_session, user_id=user_a.id, course_id=course.id)
    assert state_a is not None
    assert state_a.status == "in_progress"

    # Bob has no state for this course
    state_b = crud.get_orchestrator_state(db_session, user_id=user_b.id, course_id=course.id)
    assert state_b is None
