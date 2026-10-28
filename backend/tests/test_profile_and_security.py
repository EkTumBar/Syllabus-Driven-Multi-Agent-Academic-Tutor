import pytest
import os
import sys
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from db.database import Base, get_db
from main import app
from auth.jwt_handler import get_password_hash
from db import crud

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


def test_unauthenticated_profile_access(client):
    res = client.get("/profile/me")
    assert res.status_code == 401


def test_profile_lifecycle_and_updates(client):
    # 1. Create a user
    signup_res = client.post("/auth/signup", json={
        "email": "alex.taylor@example.com",
        "password": "Password123!",
        "role": "student"
    })
    assert signup_res.status_code == 201
    token = signup_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Get profile - verify optional fields default to None / null
    me_res = client.get("/profile/me", headers=headers)
    assert me_res.status_code == 200
    profile = me_res.json()
    assert profile["email"] == "alex.taylor@example.com"
    assert profile["role"] == "student"
    assert profile["username"] is None
    assert profile["phone_number"] is None
    assert profile["location"] is None

    # 3. Update profile
    update_res = client.put("/profile/me", headers=headers, json={
        "first_name": "Alex",
        "last_name": "Taylor",
        "username": "alextaylor",
        "phone_number": "+1 (555) 234-5678",
        "location": "London, United Kingdom",
        "avatar_url": "https://example.com/avatar.jpg",
        "preferences_json": {
            "theme": "dark",
            "security_alerts": True,
            "email_digests": True,
            "product_updates": False
        }
    })
    assert update_res.status_code == 200
    updated = update_res.json()
    assert updated["first_name"] == "Alex"
    assert updated["last_name"] == "Taylor"
    assert updated["username"] == "alextaylor"
    assert updated["phone_number"] == "+1 (555) 234-5678"
    assert updated["location"] == "London, United Kingdom"
    assert updated["preferences_json"]["theme"] == "dark"


def test_duplicate_username_rejected(client):
    # Create second user
    u2_res = client.post("/auth/signup", json={
        "email": "user2@example.com",
        "password": "Password123!",
        "role": "student"
    })
    assert u2_res.status_code == 201
    token2 = u2_res.json()["access_token"]
    headers2 = {"Authorization": f"Bearer {token2}"}

    # Attempt to take 'alextaylor'
    dup_res = client.put("/profile/me", headers=headers2, json={
        "username": "alextaylor"
    })
    assert dup_res.status_code == 400
    assert "already taken" in dup_res.json()["detail"].lower()


def test_otp_and_password_change_flow(client):
    # Log in as Alex Taylor
    login_res = client.post("/auth/login", json={
        "email": "alex.taylor@example.com",
        "password": "Password123!"
    })
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Request OTP
    otp_res = client.post("/profile/send-otp", headers=headers, json={})
    assert otp_res.status_code == 200
    otp_data = otp_res.json()
    assert "simulated_otp" in otp_data
    assert len(otp_data["simulated_otp"]) == 6
    simulated_otp = otp_data["simulated_otp"]

    # 2. Try changing password with wrong current password
    bad_curr_res = client.post("/profile/change-password", headers=headers, json={
        "current_password": "WrongCurrentPassword!",
        "new_password": "NewSecurePassword456!",
        "otp": simulated_otp
    })
    assert bad_curr_res.status_code == 400
    assert "incorrect" in bad_curr_res.json()["detail"].lower()

    # 3. Try changing password with wrong OTP
    bad_otp_res = client.post("/profile/change-password", headers=headers, json={
        "current_password": "Password123!",
        "new_password": "NewSecurePassword456!",
        "otp": "000000"
    })
    assert bad_otp_res.status_code == 400
    assert "invalid otp" in bad_otp_res.json()["detail"].lower()

    # 4. Successful change
    good_res = client.post("/profile/change-password", headers=headers, json={
        "current_password": "Password123!",
        "new_password": "NewSecurePassword456!",
        "otp": simulated_otp
    })
    assert good_res.status_code == 200
    assert "successfully" in good_res.json()["message"].lower()

    # 5. Old password no longer works
    old_login = client.post("/auth/login", json={
        "email": "alex.taylor@example.com",
        "password": "Password123!"
    })
    assert old_login.status_code == 401

    # 6. New password works
    new_login = client.post("/auth/login", json={
        "email": "alex.taylor@example.com",
        "password": "NewSecurePassword456!"
    })
    assert new_login.status_code == 200


def test_active_sessions_flow(client):
    login_res = client.post("/auth/login", json={
        "email": "user2@example.com",
        "password": "Password123!"
    })
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Get sessions
    sess_res = client.get("/profile/sessions", headers=headers)
    assert sess_res.status_code == 200
    sessions = sess_res.json()
    assert len(sessions) >= 1
    assert any(s["is_current"] for s in sessions)

    # Revoke secondary session
    rev_res = client.post("/profile/sessions/revoke?session_id=session-mobile-1", headers=headers)
    assert rev_res.status_code == 200

    # Cannot revoke current session
    bad_rev = client.post("/profile/sessions/revoke?session_id=session-current", headers=headers)
    assert bad_rev.status_code == 400


def test_account_deletion_flow(client):
    # Signup a temporary user
    temp_res = client.post("/auth/signup", json={
        "email": "delete.me@example.com",
        "password": "Password123!",
        "role": "student"
    })
    token = temp_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Delete account
    del_res = client.delete("/profile/me", headers=headers)
    assert del_res.status_code == 200

    # Trying to login now fails
    login_fail = client.post("/auth/login", json={
        "email": "delete.me@example.com",
        "password": "Password123!"
    })
    assert login_fail.status_code == 401


def test_role_and_access_levels(client):
    # 1. Unauthenticated visitor (guest access) is blocked from private endpoints
    anon_res = client.get("/profile/me")
    assert anon_res.status_code == 401

    # 2. Standard student registration returns role 'student'
    student_res = client.post("/auth/signup", json={
        "email": "student.role@example.com",
        "password": "Password123!",
        "role": "student"
    })
    assert student_res.status_code == 201
    assert student_res.json()["user"]["role"] == "student"
    student_token = student_res.json()["access_token"]
    student_headers = {"Authorization": f"Bearer {student_token}"}

    # Student cannot access admin endpoints
    admin_probe = client.get("/admin/users", headers=student_headers)
    assert admin_probe.status_code == 403

    # 3. Admin registration returns role 'admin'
    admin_res = client.post("/auth/signup", json={
        "email": "admin.role@example.com",
        "password": "Password123!",
        "role": "admin"
    })
    assert admin_res.status_code == 201
    assert admin_res.json()["user"]["role"] == "admin"
    admin_token = admin_res.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # Admin can access admin endpoints
    admin_ok = client.get("/admin/users", headers=admin_headers)
    assert admin_ok.status_code == 200

    # 4. Guest account registration returns role 'guest'
    guest_res = client.post("/auth/signup", json={
        "email": "guest.role@example.com",
        "password": "Password123!",
        "role": "guest"
    })
    assert guest_res.status_code == 201
    assert guest_res.json()["user"]["role"] == "guest"
    guest_token = guest_res.json()["access_token"]
    guest_headers = {"Authorization": f"Bearer {guest_token}"}

    # Guest cannot access admin endpoints
    guest_admin_probe = client.get("/admin/users", headers=guest_headers)
    assert guest_admin_probe.status_code == 403

