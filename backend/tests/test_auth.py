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


def test_login_anti_enumeration_unregistered_email(client):
    """
    Anti-enumeration security test:
    Verify that an unregistered email returns the exact same 401 status and generic
    error detail as an invalid password for a registered email.
    """
    payload = {
        "email": "completely_unregistered_user_999@example.com",
        "password": "some_random_password_attempt"
    }
    response = client.post("/auth/login", json=payload)
    assert response.status_code == 401
    assert response.json()["detail"] == "Incorrect email or password"


def test_login_anti_enumeration_invalid_password(client):
    """
    Anti-enumeration security test:
    Verify that an invalid password for an existing account returns generic error.
    """
    payload = {
        "email": "student1@example.com",
        "password": "wrong_password_test"
    }
    response = client.post("/auth/login", json=payload)
    assert response.status_code == 401
    assert response.json()["detail"] == "Incorrect email or password"


def test_blind_password_reset_flow(client):
    """
    Blind Password Reset Test (Anti-Enumeration):
    Verify that submitting both registered and unregistered emails returns identical 200 OK
    with the exact generic security message, while background tasks trigger appropriate emails.
    """
    from auth.auth_routes import _DISPATCHED_RESET_EMAILS
    _DISPATCHED_RESET_EMAILS.clear()

    # 1. Registered email
    registered_payload = {"email": "student1@example.com"}
    reg_response = client.post("/auth/forgot-password", json=registered_payload)
    assert reg_response.status_code == 200
    assert reg_response.json()["message"] == "If an account with that email exists, we have sent a password reset link."

    # 2. Unregistered email
    unregistered_payload = {"email": "nobody_exists_here@example.com"}
    unreg_response = client.post("/auth/forgot-password", json=unregistered_payload)
    assert unreg_response.status_code == 200
    assert unreg_response.json()["message"] == "If an account with that email exists, we have sent a password reset link."

    # 3. Verify dispatched email records in background
    assert len(_DISPATCHED_RESET_EMAILS) == 2
    reg_email = next(e for e in _DISPATCHED_RESET_EMAILS if e["to"] == "student1@example.com")
    assert reg_email["account_exists"] is True
    assert "reset-password?token=" in reg_email["link"]
    assert "Password Reset Request" in reg_email["subject"]

    unreg_email = next(e for e in _DISPATCHED_RESET_EMAILS if e["to"] == "nobody_exists_here@example.com")
    assert unreg_email["account_exists"] is False
    assert unreg_email["link"] == "/auth"
    assert "no active account" in unreg_email["body"].lower() or "do not have an active account" in unreg_email["body"].lower()


def test_supabase_token_me_and_auto_provision(client):
    """
    Verify that a Supabase token carrying aud='authenticated' can access /auth/me
    and auto-provisions a backend user row without 401.
    """
    from jose import jwt
    import uuid
    from config import settings

    sub_id = str(uuid.uuid4())
    email = f"oauth_user_{sub_id[:8]}@example.com"
    token = jwt.encode(
        {
            "sub": sub_id,
            "email": email,
            "aud": "authenticated",
            "user_metadata": {"full_name": "Supabase Test User"},
            "exp": 2106353989,
        },
        settings.JWT_SECRET,
        algorithm="HS256",
    )

    response = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == email
    assert data["first_name"] == "Supabase"


def test_supabase_es256_jwks_token_me(client):
    """
    Verify that an ES256 token verified via JWKS is accepted and auto-provisions user.
    """
    import jwt
    import uuid
    from unittest.mock import MagicMock
    from cryptography.hazmat.primitives.asymmetric import ec
    from config import settings
    from auth import jwt_handler

    private_key = ec.generate_private_key(ec.SECP256R1())
    public_key = private_key.public_key()
    sub_id = str(uuid.uuid4())
    email = f"es256_user_{sub_id[:8]}@example.com"

    supabase_url = (settings.SUPABASE_URL or "").rstrip("/")
    token = jwt.encode(
        {
            "sub": sub_id,
            "email": email,
            "aud": "authenticated",
            "iss": f"{supabase_url}/auth/v1",
            "user_metadata": {"full_name": "ES256 Student"},
            "exp": 2106353989,
        },
        private_key,
        algorithm="ES256",
        headers={"kid": "mock-es256-kid-1"},
    )

    mock_key = MagicMock()
    mock_key.key = public_key
    mock_client = MagicMock()
    mock_client.get_signing_key_from_jwt.return_value = mock_key

    orig_client = jwt_handler._jwks_client
    jwt_handler._jwks_client = mock_client
    try:
        response = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == email
        assert data["first_name"] == "ES256"
    finally:
        jwt_handler._jwks_client = orig_client


def test_supabase_es256_unknown_kid_401(client):
    """
    Verify that an ES256 token with an unknown kid returns a clean 401 Unauthorized.
    """
    token = "eyJhbGciOiJFUzI1NiIsImtpZCI6InVua25vd24ta2lkIiwidHlwIjoiSldUIn0.eyJzdWIiOiIxIn0.abc"
    response = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 401
    assert "Could not validate credentials" in response.json()["detail"]



