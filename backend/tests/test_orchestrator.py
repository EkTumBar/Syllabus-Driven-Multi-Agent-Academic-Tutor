import json
import os
import sys
import pytest
from unittest.mock import patch
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from db.database import Base
from db.models import User, Course, Module, Question, OrchestratorState
from agents import orchestrator

SQLALCHEMY_TEST_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="module", autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db_session():
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


def test_orchestrator_multi_step_loop_with_db_persistence(db_session):
    # 1. Seed database with User, Course, Module, and Question
    user = User(id="user_orch_1", email="student_orch@univ.edu", hashed_password="pw", role="student")
    course = Course(id="course_orch_1", user_id=user.id, title="Calculus I", syllabus_raw="Week 1: Limits\nWeek 2: Derivatives")
    mod1 = Module(id="mod_orch_1", course_id=course.id, title="Module 1: Limits & Continuity", order_index=1)
    q1 = Question(id="q_orch_1", module_id=mod1.id, question_text="What is lim x->0 of sin(x)/x?", options_json=["1", "0", "Undefined", "Infinity"], correct_answer="1", difficulty="medium")
    db_session.add_all([user, course, mod1, q1])
    db_session.commit()

    # Mock examiner output
    mock_examiner_quiz = json.dumps({
        "questions": [
            {
                "question_text": "What is lim x->0 of sin(x)/x?",
                "options_json": ["1", "0", "Undefined", "Infinity"],
                "correct_answer": "1",
                "difficulty": "medium",
                "explanation": "Standard trigonometric limit"
            }
        ]
    })

    # Step 1: Initial start / request question
    with patch("agents.examiner_agent.generate", return_value=mock_examiner_quiz):
        step1_res = orchestrator.run_step(
            db=db_session,
            course_id=course.id,
            user_id=user.id,
            step_input={"action": "next_question"}
        )

        assert step1_res["course_id"] == course.id
        assert step1_res["current_module_id"] == mod1.id
        assert step1_res["payload"]["type"] == "question"
        assert len(step1_res["payload"]["questions"]) == 1

        # Check that state was persisted to Postgres table
        state_in_db = db_session.query(OrchestratorState).filter(
            OrchestratorState.user_id == user.id,
            OrchestratorState.course_id == course.id
        ).first()
        assert state_in_db is not None
        assert state_in_db.current_module == mod1.id

    # Step 2: Student submits an incorrect answer
    mock_eval_incorrect = json.dumps({
        "is_correct": False,
        "feedback": "Review the squeeze theorem for sin(x)/x limit.",
        "key_takeaway": "lim x->0 sin(x)/x equals 1."
    })

    with patch("agents.evaluator_agent.generate", return_value=mock_eval_incorrect):
        step2_res = orchestrator.run_step(
            db=db_session,
            course_id=course.id,
            user_id=user.id,
            step_input={
                "action": "submit_answer",
                "question_id": q1.id,
                "question_text": q1.question_text,
                "answer_given": "0",
                "correct_answer": "1"
            }
        )

        assert step2_res["payload"]["type"] == "evaluation"
        assert step2_res["payload"]["evaluation"]["is_correct"] is False
        assert step2_res["payload"]["evaluation"]["mastery_score"] == 0.35

        # Confirm DB state updated
        db_session.refresh(state_in_db)
        assert state_in_db.last_evaluation is not None
        assert state_in_db.last_evaluation["is_correct"] is False

    # Step 3: Student submits a 2nd incorrect answer -> Trigger remediation
    with patch("agents.evaluator_agent.generate", return_value=mock_eval_incorrect):
        step3_res = orchestrator.run_step(
            db=db_session,
            course_id=course.id,
            user_id=user.id,
            step_input={
                "action": "submit_answer",
                "question_id": q1.id,
                "question_text": q1.question_text,
                "answer_given": "Undefined",
                "correct_answer": "1"
            }
        )

        # Confirm remediation flow triggered and persisted
        assert step3_res["payload"]["type"] == "remediation"
        assert "targeted review" in step3_res["payload"]["guidance"]

        db_session.refresh(state_in_db)
        assert state_in_db.last_evaluation["remediate"] is True
