import pytest
import os
import sys
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi import Depends

BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from db.database import Base, get_db
from main import app
from auth.dependencies import require_admin, get_current_user

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


# Dummy protected routes for testing permissions
@app.get("/api/test-admin-only", tags=["Test"])
def handle_test_admin_only(admin_user=Depends(require_admin)):
    return {"message": f"Welcome Admin {admin_user.email}"}


@app.get("/api/test-student-protected", tags=["Test"])
def handle_test_student_protected(current_user=Depends(get_current_user)):
    return {"message": f"Hello {current_user.email}"}


@pytest.fixture(scope="module", autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    app.dependency_overrides[get_db] = override_get_db
    yield
    Base.metadata.drop_all(bind=engine)
    app.dependency_overrides.pop(get_db, None)


@pytest.fixture
def client():
    return TestClient(app)


def test_signup_success(client):
    payload = {
        "email": "student1@example.com",
        "password": "strongpassword123",
        "role": "student"
    }
    response = client.post("/auth/signup", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == "student1@example.com"
    assert data["user"]["role"] == "student"
    assert "id" in data["user"]


def test_signup_duplicate_email(client):
    payload = {
        "email": "student1@example.com",
        "password": "anotherpassword",
        "role": "student"
    }
    response = client.post("/auth/signup", json=payload)
    assert response.status_code == 400
    assert "already exists" in response.json()["detail"].lower()


def test_login_success(client):
    payload = {
        "email": "student1@example.com",
        "password": "strongpassword123"
    }
    response = client.post("/auth/login", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["user"]["email"] == "student1@example.com"


def test_login_invalid_password(client):
    payload = {
        "email": "student1@example.com",
        "password": "wrongpassword"
    }
    response = client.post("/auth/login", json=payload)
    assert response.status_code == 401
    assert "email or password" in response.json()["detail"].lower()


def test_auth_me_and_protected_routes(client):
    # 1. Login to get token
    login_resp = client.post("/auth/login", json={
        "email": "student1@example.com",
        "password": "strongpassword123"
    })
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Test /auth/me
    me_resp = client.get("/auth/me", headers=headers)
    assert me_resp.status_code == 200
    assert me_resp.json()["email"] == "student1@example.com"

    # 3. Test student protected route
    prot_resp = client.get("/api/test-student-protected", headers=headers)
    assert prot_resp.status_code == 200
    assert "Hello student1@example.com" in prot_resp.json()["message"]


def test_admin_role_access(client):
    # 1. Signup admin
    admin_signup = client.post("/auth/signup", json={
        "email": "admin@university.edu",
        "password": "adminsecret123",
        "role": "admin"
    })
    assert admin_signup.status_code == 201
    admin_token = admin_signup.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # 2. Admin accesses admin route -> 200 OK
    admin_resp = client.get("/api/test-admin-only", headers=admin_headers)
    assert admin_resp.status_code == 200
    assert "Welcome Admin admin@university.edu" in admin_resp.json()["message"]

    # 3. Student tries to access admin route -> 403 Forbidden
    student_login = client.post("/auth/login", json={
        "email": "student1@example.com",
        "password": "strongpassword123"
    })
    student_token = student_login.json()["access_token"]
    student_headers = {"Authorization": f"Bearer {student_token}"}

    forbidden_resp = client.get("/api/test-admin-only", headers=student_headers)
    assert forbidden_resp.status_code == 403
    assert "Admin privileges required" in forbidden_resp.json()["detail"]


def test_unauthenticated_access_fails(client):
    resp = client.get("/auth/me")
    assert resp.status_code == 401
