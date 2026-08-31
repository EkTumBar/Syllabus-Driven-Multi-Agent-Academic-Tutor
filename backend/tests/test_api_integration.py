import json
import os
import sys
import pytest
from unittest.mock import patch
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from main import app
from db.database import Base, get_db
from db.models import User, Course, Module, Question, AdminLog

SQLALCHEMY_TEST_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(autouse=True)
def setup_api_test():
    Base.metadata.create_all(bind=engine)
    app.dependency_overrides[get_db] = override_get_db
    yield
    Base.metadata.drop_all(bind=engine)
    app.dependency_overrides.pop(get_db, None)


@pytest.fixture
def client():
    return TestClient(app)


def test_full_api_flow_and_role_gating(client):
    # 1. Register a student user
    student_signup = client.post("/auth/signup", json={
        "email": "api_student@univ.edu",
        "password": "studentpassword123",
        "role": "student"
    })
    assert student_signup.status_code == 201
    student_token = student_signup.json()["access_token"]
    student_headers = {"Authorization": f"Bearer {student_token}"}

    # 2. Register an admin user
    admin_signup = client.post("/auth/signup", json={
        "email": "api_admin@univ.edu",
        "password": "adminpassword123",
        "role": "admin"
    })
    assert admin_signup.status_code == 201
    admin_token = admin_signup.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # 3. ACCEPTANCE CRITERIA: Verify student gets 403 on all /admin/* routes
    res_users = client.get("/admin/users", headers=student_headers)
    assert res_users.status_code == 403

    res_mastery = client.get(f"/admin/users/{student_signup.json()['user']['id']}/mastery", headers=student_headers)
    assert res_mastery.status_code == 403

    res_logs = client.get("/admin/logs", headers=student_headers)
    assert res_logs.status_code == 403

    res_del = client.delete("/admin/courses/fake_course_id", headers=student_headers)
    assert res_del.status_code == 403

    # 4. Student creates a Course
    mock_plan_json = json.dumps({
        "modules": [
            {"title": "Module 1: Intro to Chemistry", "order_index": 1, "topics": ["Atoms", "Molecules"], "prerequisites": []}
        ]
    })
    with patch("agents.planner_agent.generate", return_value=mock_plan_json):
        course_resp = client.post(
            "/courses",
            headers=student_headers,
            json={
                "title": "General Chemistry I",
                "syllabus_raw": "Week 1: Atoms & Molecules\nWeek 2: Periodic Table"
            }
        )
        assert course_resp.status_code == 201
        course_data = course_resp.json()
        course_id = course_data["id"]
        assert course_data["title"] == "General Chemistry I"

    # 5. Student requests next question
    mock_quiz_json = json.dumps({
        "questions": [
            {
                "question_text": "What is the atomic number of Hydrogen?",
                "options_json": ["1", "2", "6", "8"],
                "correct_answer": "1",
                "difficulty": "easy",
                "explanation": "Hydrogen has 1 proton."
            }
        ]
    })
    with patch("agents.examiner_agent.generate", return_value=mock_quiz_json):
        quiz_resp = client.get(f"/courses/{course_id}/next-question", headers=student_headers)
        assert quiz_resp.status_code == 200
        quiz_data = quiz_resp.json()
        assert quiz_data["payload"]["type"] == "question"
        q_item = quiz_data["payload"]["questions"][0]
        q_id = q_item["id"]

    # 6. Student answers question
    mock_eval_json = json.dumps({
        "is_correct": True,
        "feedback": "Correct! Hydrogen has atomic number 1.",
        "key_takeaway": "Atomic number = number of protons."
    })
    with patch("agents.evaluator_agent.generate", return_value=mock_eval_json):
        ans_resp = client.post(
            f"/questions/{q_id}/answer",
            headers=student_headers,
            json={"answer_given": "1", "course_id": course_id}
        )
        assert ans_resp.status_code == 200
        ans_data = ans_resp.json()
        assert ans_data["payload"]["evaluation"]["is_correct"] is True

    # 7. Student uses /courses/{course_id}/explain endpoint
    with patch("api.chat_routes.generate", return_value="Here is a simple explanation of atomic mass..."):
        explain_resp = client.post(
            f"/courses/{course_id}/explain",
            headers=student_headers,
            json={"topic": "Atomic Mass", "student_query": "Why does atomic mass have decimals?"}
        )
        assert explain_resp.status_code == 200
        assert "explanation" in explain_resp.json()

    # 8. Student inspects profile mastery
    profile_resp = client.get("/profile/mastery", headers=student_headers)
    assert profile_resp.status_code == 200
    assert "summary" in profile_resp.json()

    # 9. ACCEPTANCE CRITERIA: Admin actions succeed and produce rows in admin_logs
    db = TestingSessionLocal()
    initial_log_count = db.query(AdminLog).count()

    admin_users_resp = client.get("/admin/users", headers=admin_headers)
    assert admin_users_resp.status_code == 200
    assert len(admin_users_resp.json()) >= 2

    admin_mastery_resp = client.get(f"/admin/users/{student_signup.json()['user']['id']}/mastery", headers=admin_headers)
    assert admin_mastery_resp.status_code == 200

    admin_del_resp = client.delete(f"/admin/courses/{course_id}", headers=admin_headers)
    assert admin_del_resp.status_code == 200

    admin_logs_resp = client.get("/admin/logs", headers=admin_headers)
    assert admin_logs_resp.status_code == 200

    # Verify rows written to admin_logs in database
    final_log_count = db.query(AdminLog).count()
    assert final_log_count >= initial_log_count + 3
    db.close()
