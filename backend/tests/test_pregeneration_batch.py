import json
import pytest
from unittest.mock import patch, MagicMock
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from db.database import Base
from db.models import User, Course, Module, Question, Attempt, MasteryProfile
from db import crud
from agents.examiner_agent import generate_question_bank, _parse_questions_from_response
from rag.ingest import extract_text_from_image, process_image

TEST_DB_URL = "sqlite:///:memory:"
engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False}, poolclass=StaticPool)
TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="module", autouse=True)
def setup_tables():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db():
    session = TestingSession()
    try:
        yield session
    finally:
        session.close()


def test_question_bank_flexible_json_parsing():
    """Validates that both JSON arrays and object with 'questions' parse strictly with options normalized."""
    sample_array = json.dumps([
        {
            "question": "What is the speed of light in vacuum?",
            "options": ["3e8 m/s", "3e6 m/s", "1e5 m/s", "None"],
            "correct_answer": "3e8 m/s",
            "difficulty": "easy",
            "explanation": "Light travels at approximately 3.0 x 10^8 m/s in vacuum."
        }
    ])

    parsed = _parse_questions_from_response(sample_array, topic="Electromagnetism")
    assert len(parsed) == 1
    assert parsed[0]["question_text"] == "What is the speed of light in vacuum?"
    assert parsed[0]["options_json"] == ["A. 3e8 m/s", "B. 3e6 m/s", "C. 1e5 m/s", "D. None"]
    assert parsed[0]["correct_answer"] == "A. 3e8 m/s"
    assert "3.0 x 10^8" in parsed[0]["explanation"]


def test_generate_question_bank_stores_in_database(db):
    """Tests that generate_question_bank creates and persists an array of 20-50 questions into Supabase/DB."""
    user = User(id="user_qb_test", email="qb@univ.edu", hashed_password="pw", role="student")
    course = Course(id="course_qb_test", user_id=user.id, title="Quantum Mechanics", syllabus_raw="Schrodinger eq")
    mod = Module(id="mod_qb_test", course_id=course.id, title="Wave Functions", order_index=1)
    db.add_all([user, course, mod])
    db.commit()

    mock_bank = json.dumps({
        "questions": [
            {
                "question": f"What is principle #{i} of quantum wave functions?",
                "options": ["A. Normalization", "B. Divergence", "C. Discontinuity", "D. Invariance"],
                "correct_answer": "A. Normalization",
                "difficulty": "medium",
                "explanation": "Wave functions must be square-integrable to yield probability 1."
            }
            for i in range(20)
        ]
    })

    with patch("agents.examiner_agent.generate", return_value=mock_bank):
        questions = generate_question_bank(
            course_id=course.id,
            module_id=mod.id,
            topic=mod.title,
            context_text="Wave mechanics context",
            count=20,
            db=db
        )

        assert len(questions) == 20
        assert questions[0]["module_id"] == mod.id
        assert questions[0]["correct_answer"] == "A. Normalization"
        assert "Wave functions must be" in questions[0]["explanation"]

        # Check in database
        db_qs = crud.get_questions_by_module(db, module_id=mod.id)
        assert len(db_qs) == 20
        assert db_qs[0].order_index == 1
        assert db_qs[19].order_index == 20


def test_extract_text_and_process_image():
    """Validates image transcription and chunk extraction."""
    mock_transcription = "Module 1: Photosynthesis\nLight reactions produce ATP and NADPH.\nCalvin cycle fixes CO2."
    with patch("llm.llm_client.generate", return_value=mock_transcription):
        raw = extract_text_from_image(b"fake_png_bytes", mime_type="image/png", filename="diagram.png")
        assert "Photosynthesis" in raw
        assert "Calvin cycle" in raw

        chunks = process_image(b"fake_png_bytes", course_id="c_img", filename="diagram.png", mime_type="image/png")
        assert len(chunks) >= 1
        assert chunks[0]["course_id"] == "c_img"
        assert "Photosynthesis" in chunks[0]["text"]
