import json
import os
import sys
import pytest
from unittest.mock import MagicMock, patch
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from db.database import Base
from db.models import User, Course, Module, Question
from agents import planner_agent, researcher_agent, examiner_agent, evaluator_agent

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


def test_planner_agent_extracts_modules(db_session):
    syllabus_sample = """
    Week 1-2: Foundations of Data Structures (Arrays, Linked Lists)
    Week 3-4: Trees and Graphs
    Week 5: Dynamic Programming
    """
    mock_response = json.dumps({
        "modules": [
            {"title": "Module 1: Foundations of Data Structures", "order_index": 1, "topics": ["Arrays", "Linked Lists"], "prerequisites": []},
            {"title": "Module 2: Trees and Graphs", "order_index": 2, "topics": ["Binary Trees", "Graphs"], "prerequisites": ["Arrays"]},
            {"title": "Module 3: Dynamic Programming", "order_index": 3, "topics": ["Memoization", "Tabulation"], "prerequisites": ["Arrays"]}
        ]
    })

    with patch("agents.planner_agent.generate", return_value=mock_response):
        user = User(id="user_plan_1", email="planner_test@univ.edu", hashed_password="pw", role="student")
        course = Course(id="course_plan_1", user_id="user_plan_1", title="Algorithms", syllabus_raw=syllabus_sample)
        db_session.add_all([user, course])
        db_session.commit()

        modules = planner_agent.plan_syllabus(syllabus_raw=syllabus_sample, course_id=course.id, db=db_session)
        assert len(modules) == 3
        assert modules[0]["title"] == "Module 1: Foundations of Data Structures"
        assert modules[1]["order_index"] == 2

        # Verify persisted in database
        db_modules = db_session.query(Module).filter(Module.course_id == course.id).all()
        assert len(db_modules) == 3


def test_researcher_agent_remediation_expansion(db_session):
    # Mock vector_store.query to observe query_text and top_k
    with patch("agents.researcher_agent.vector_store.query") as mock_query:
        mock_query.return_value = [
            {"text": "Quantum superposition allows states to exist simultaneously.", "metadata": {"filename": "quantum.pdf"}}
        ]

        # 1. Normal research query
        normal_res = researcher_agent.research_topic(
            db=db_session,
            course_id="course_test",
            topic="Superposition",
            remediate=False,
            top_k=4
        )
        assert normal_res["remediate"] is False
        assert "superposition" in normal_res["context_text"].lower()
        assert mock_query.call_args[1]["top_k"] == 4

        # 2. Remediation research query
        remed_res = researcher_agent.research_topic(
            db=db_session,
            course_id="course_test",
            topic="Superposition",
            remediate=True,
            top_k=4
        )
        assert remed_res["remediate"] is True
        # Remediation should increase top_k by 3 (4 + 3 = 7)
        assert mock_query.call_args[1]["top_k"] == 7
        assert "foundational explanations" in mock_query.call_args[1]["query_text"]


def test_examiner_agent_difficulty_calibration():
    assert examiner_agent.get_calibrated_difficulty(0.2) == "easy"
    assert examiner_agent.get_calibrated_difficulty(0.5) == "medium"
    assert examiner_agent.get_calibrated_difficulty(0.85) == "hard"

    mock_quiz_json = json.dumps({
        "questions": [
            {
                "question_text": "What is the Big-O complexity of binary search?",
                "options_json": ["A. O(log n)", "B. O(n)", "C. O(n^2)", "D. O(1)"],
                "correct_answer": "A. O(log n)",
                "difficulty": "medium",
                "explanation": "Binary search divides the search space in half each step."
            }
        ]
    })

    with patch("agents.examiner_agent.generate", return_value=mock_quiz_json):
        questions = examiner_agent.generate_quiz(
            topic="Binary Search",
            context_text="Binary search takes O(log n) time.",
            mastery_score=0.6,
            num_questions=1
        )
        assert len(questions) == 1
        assert questions[0]["question_text"] == "What is the Big-O complexity of binary search?"
        assert questions[0]["difficulty"] == "medium"


def test_evaluator_agent_mastery_and_remediation_trigger(db_session):
    user = User(id="user_eval_1", email="evaluator_test@univ.edu", hashed_password="pw", role="student")
    course = Course(id="course_eval_1", user_id="user_eval_1", title="Chemistry", syllabus_raw="Chem")
    module = Module(id="mod_eval_1", course_id="course_eval_1", title="Stoichiometry", order_index=1)
    q1 = Question(id="q_eval_1", module_id="mod_eval_1", question_text="What is a mole?", options_json=["6.022e23 particles", "12 g"], correct_answer="6.022e23 particles", difficulty="easy")
    q2 = Question(id="q_eval_2", module_id="mod_eval_1", question_text="Molar mass of H2O?", options_json=["18 g/mol", "20 g/mol"], correct_answer="18 g/mol", difficulty="easy")
    db_session.add_all([user, course, module, q1, q2])
    db_session.commit()

    mock_feedback_json = json.dumps({
        "is_correct": False,
        "feedback": "Make sure to review Avogadro's number.",
        "key_takeaway": "One mole contains 6.022e23 particles."
    })

    with patch("agents.evaluator_agent.generate", return_value=mock_feedback_json):
        # 1. First incorrect attempt
        eval1 = evaluator_agent.evaluate_answer(
            db=db_session,
            user_id=user.id,
            module_id=module.id,
            topic="Avogadro Constant",
            question_id=q1.id,
            answer_given="12 g",
            correct_answer="6.022e23 particles",
            question_text=q1.question_text
        )
        assert eval1["is_correct"] is False
        assert eval1["mastery_score"] == 0.35  # Initial 0.5 - 0.15 = 0.35

        # 2. Second consecutive incorrect attempt -> SHOULD TRIGGER REMEDIATE=TRUE
        eval2 = evaluator_agent.evaluate_answer(
            db=db_session,
            user_id=user.id,
            module_id=module.id,
            topic="Avogadro Constant",
            question_id=q2.id,
            answer_given="20 g/mol",
            correct_answer="18 g/mol",
            question_text=q2.question_text
        )
        assert eval2["is_correct"] is False
        assert eval2["mastery_score"] == 0.20  # 0.35 - 0.15 = 0.20
        # Acceptance criteria check: two consecutive low scores/failures trigger remediation
        assert eval2["remediate"] is True
        assert "feedback" in eval2

        # 3. Third attempt with correct answer -> Score improves
        eval3 = evaluator_agent.evaluate_answer(
            db=db_session,
            user_id=user.id,
            module_id=module.id,
            topic="Avogadro Constant",
            question_id=q2.id,
            answer_given="18 g/mol",
            correct_answer="18 g/mol",
            question_text=q2.question_text
        )
        assert eval3["is_correct"] is True
        assert eval3["mastery_score"] == 0.35  # 0.20 + 0.15 = 0.35
