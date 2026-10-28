import pytest
from unittest.mock import patch
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from main import app
from db.database import Base, get_db
from db import crud
from db.models import User, Course, Module, Question, Document, DocumentChunk, Attempt, UserProgress

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


@pytest.fixture
def student_auth(client):
    res = client.post("/auth/signup", json={
        "email": "lifecycle_student@univ.edu",
        "password": "password123",
        "role": "student"
    })
    token = res.json()["access_token"]
    user_id = res.json()["user"]["id"]
    return {"headers": {"Authorization": f"Bearer {token}"}, "user_id": user_id}


def test_soft_delete_and_filtering(client, student_auth):
    headers = student_auth["headers"]
    user_id = student_auth["user_id"]

    db = TestingSessionLocal()
    course1 = crud.create_course(db, user_id=user_id, title="Quantum Computing", syllabus_raw="Module 1: Qubits")
    course2 = crud.create_course(db, user_id=user_id, title="Machine Learning", syllabus_raw="Module 1: Linear Models")
    c1_id = str(course1.id)
    c2_id = str(course2.id)
    db.close()

    # Initial list: both courses visible
    list_res = client.get("/courses", headers=headers)
    assert list_res.status_code == 200
    courses = list_res.json()
    assert len(courses) == 2

    # Soft delete (archive) course1
    archive_res = client.patch(f"/courses/{c1_id}/archive", headers=headers)
    assert archive_res.status_code == 200
    assert archive_res.json()["is_archived"] is True

    # Main dashboard query (include_archived=False by default) should only return course2
    dashboard_res = client.get("/courses", headers=headers)
    assert dashboard_res.status_code == 200
    active_courses = dashboard_res.json()
    assert len(active_courses) == 1
    assert active_courses[0]["id"] == c2_id

    # Query with include_archived=true should return both courses
    all_courses_res = client.get("/courses?include_archived=true", headers=headers)
    assert all_courses_res.status_code == 200
    all_courses = all_courses_res.json()
    assert len(all_courses) == 2


def test_user_progress_persistence(client, student_auth):
    headers = student_auth["headers"]
    user_id = student_auth["user_id"]

    db = TestingSessionLocal()
    course = crud.create_course(db, user_id=user_id, title="Data Structures", syllabus_raw="Module 1: Trees")
    module = crud.create_module(db, course_id=course.id, title="Trees and Heaps", order_index=1)
    course_id = str(course.id)
    module_id = str(module.id)
    db.close()

    # 1. GET initial progress (should return default 0 index)
    prog_res = client.get(f"/courses/{course_id}/progress?module_id={module_id}", headers=headers)
    assert prog_res.status_code == 200
    data = prog_res.json()
    assert data["current_question_index"] == 0
    assert data["answers_submitted"] == []

    # 2. PUT progress update (resuming after question 3 with answers)
    update_res = client.put(f"/courses/{course_id}/progress", headers=headers, json={
        "module_id": module_id,
        "current_question_index": 3,
        "answers_submitted": ["A. Binary Tree", "B. Min-Heap", "C. AVL Tree"]
    })
    assert update_res.status_code == 200
    updated_data = update_res.json()
    assert updated_data["current_question_index"] == 3
    assert len(updated_data["answers_submitted"]) == 3

    # 3. GET progress again to confirm persistence
    saved_res = client.get(f"/courses/{course_id}/progress?module_id={module_id}", headers=headers)
    assert saved_res.status_code == 200
    saved_data = saved_res.json()
    assert saved_data["current_question_index"] == 3
    assert saved_data["answers_submitted"] == ["A. Binary Tree", "B. Min-Heap", "C. AVL Tree"]


def test_hard_delete_storage_failure_aborts_db_cleanup(client, student_auth):
    headers = student_auth["headers"]
    user_id = student_auth["user_id"]

    db = TestingSessionLocal()
    course = crud.create_course(db, user_id=user_id, title="Physics 101", syllabus_raw="Classical Mechanics")
    doc = crud.create_document(
        db,
        course_id=course.id,
        filename="lecture1.pdf",
        storage_url="https://xyz.supabase.co/storage/v1/object/public/documents/uuid123_lecture1.pdf"
    )
    course_id = str(course.id)
    db.close()

    # Simulate Supabase storage failure
    with patch("api.syllabus_routes.delete_storage_files", side_effect=RuntimeError("Supabase connection timeout")):
        del_res = client.delete(f"/courses/{course_id}", headers=headers)
        # Should return user-friendly error (502), NOT raw 500
        assert del_res.status_code == 502
        assert "Unable to remove attached course documents from cloud storage" in del_res.json()["detail"]

    # Verify course and document still exist in database (deletion was safely aborted)
    db = TestingSessionLocal()
    course_in_db = crud.get_course_by_id(db, course_id=course_id)
    assert course_in_db is not None
    docs_in_db = crud.get_documents_by_course(db, course_id=course_id)
    assert len(docs_in_db) == 1
    db.close()


def test_hard_delete_success_deletes_all_records_in_order(client, student_auth):
    headers = student_auth["headers"]
    user_id = student_auth["user_id"]

    db = TestingSessionLocal()
    course = crud.create_course(db, user_id=user_id, title="Operating Systems", syllabus_raw="Processes & Threads")
    module = crud.create_module(db, course_id=course.id, title="Threads", order_index=1)
    q = crud.create_question(
        db,
        module_id=module.id,
        question_text="What is a mutex?",
        options_json=["Lock", "Condition", "Process", "Thread"],
        correct_answer="Lock"
    )
    crud.create_attempt(db, question_id=q.id, user_id=user_id, answer_given="Lock", is_correct=True)
    crud.create_document(
        db,
        course_id=course.id,
        filename="os_notes.pdf",
        storage_url="https://xyz.supabase.co/storage/v1/object/public/documents/abc_os_notes.pdf"
    )
    crud.upsert_user_progress(db, user_id=user_id, course_id=course.id, current_question_index=2, module_id=module.id)

    chunk = DocumentChunk(
        course_id=course.id,
        content="Mutex locks are synchronization primitives.",
        embedding_json=[0.1, 0.2],
        metadata_json={"source": "os_notes.pdf"}
    )
    db.add(chunk)
    db.commit()

    course_id = str(course.id)
    q_id = str(q.id)
    db.close()

    # Mock storage deletion returning success
    with patch("api.syllabus_routes.delete_storage_files", return_value=True) as mock_storage_del:
        del_res = client.delete(f"/courses/{course_id}", headers=headers)
        assert del_res.status_code == 200
        assert "permanently deleted" in del_res.json()["message"]
        # Storage deletion was invoked with the document's URL
        assert mock_storage_del.called

    # Verify everything is completely wiped from DB
    db = TestingSessionLocal()
    assert crud.get_course_by_id(db, course_id=course_id) is None
    assert db.query(DocumentChunk).filter(DocumentChunk.course_id == course_id).count() == 0
    assert db.query(Document).filter(Document.course_id == course_id).count() == 0
    assert db.query(Question).filter(Question.id == q_id).count() == 0
    assert db.query(UserProgress).filter(UserProgress.course_id == course_id).count() == 0
    db.close()
