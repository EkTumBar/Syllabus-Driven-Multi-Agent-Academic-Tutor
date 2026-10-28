import logging
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from db.database import get_db
from db import crud
from db.models import User
from schemas.pydantic_models import (
    UserCreate,
    UserLogin,
    UserResponse,
    Token,
    ForgotPasswordRequest,
    ForgotPasswordResponse
)
from auth.jwt_handler import get_password_hash, verify_password, create_access_token
from auth.dependencies import get_current_user

from datetime import timedelta

logger = logging.getLogger("auth_routes")
router = APIRouter()

# Constant-time dummy hash used to neutralize timing attacks on unregistered accounts
_DUMMY_TIMING_HASH = "$2b$12$e80yq78j7U5aV30H8q8mpeX03U/q4yS3p03fX9UjC4vGkC0N9a2yK"

# In-memory audit store for testing and verifying dispatched security emails
_DISPATCHED_RESET_EMAILS = []


def _send_blind_password_reset_email(email: str, exists: bool):
    """
    Asynchronous background worker task (Anti-Enumeration):
    - If user exists: Dispatches password reset email with secure token.
    - If user does not exist: Silently dispatches notification stating no active account exists,
      providing a link to register (/auth).
    """
    if exists:
        # Generate secure single-use token valid for 15 minutes
        reset_token = create_access_token(
            {"sub": email, "type": "password_reset"},
            expires_delta=timedelta(minutes=15)
        )
        reset_url = f"/auth/reset-password?token={reset_token}"
        email_record = {
            "to": email,
            "type": "password_reset",
            "subject": "Password Reset Request - Multi-Agent Academic Tutor",
            "body": (
                f"Hello,\n\n"
                f"We received a request to reset your password. You can reset your password using the link below:\n"
                f"{reset_url}\n\n"
                f"This link is valid for 15 minutes. If you did not request a password reset, please ignore this email.\n"
            ),
            "link": reset_url,
            "account_exists": True
        }
        _DISPATCHED_RESET_EMAILS.append(email_record)
        logger.info(
            "[SECURE AUTH EMAIL] Password reset token generated for registered user: %s. "
            "Dispatching secure reset email with link: %s",
            email,
            reset_url
        )
    else:
        register_url = "/auth"
        email_record = {
            "to": email,
            "type": "account_not_found_notice",
            "subject": "Account Notice - Multi-Agent Academic Tutor",
            "body": (
                f"Hello,\n\n"
                f"A password reset was requested for {email}. However, you do not have an active account "
                f"registered with this email address.\n\n"
                f"If you would like to create an account, please register here:\n"
                f"{register_url}\n\n"
                f"If you did not make this request, you can safely disregard this email.\n"
            ),
            "link": register_url,
            "account_exists": False
        }
        _DISPATCHED_RESET_EMAILS.append(email_record)
        logger.info(
            "[SECURE AUTH EMAIL] Unregistered email '%s' requested reset. "
            "Silently dispatching account-not-found advisory notice with registration link: %s",
            email,
            register_url
        )


@router.post("/signup", response_model=Token, status_code=status.HTTP_201_CREATED)
def signup(user_data: UserCreate, db: Session = Depends(get_db)):
    """Registers a new user (student or admin) and returns a JWT access token."""
    existing_user = crud.get_user_by_email(db, email=user_data.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email already exists"
        )

    # Normalize role: support student, admin, and guest roles
    role = user_data.role if user_data.role in ["student", "admin", "guest"] else "student"
    hashed_pwd = get_password_hash(user_data.password)
    user = crud.create_user(
        db,
        email=user_data.email,
        hashed_password=hashed_pwd,
        role=role,
        first_name=None,
        last_name=None,
        username=None,
        phone_number=None,
        location=None,
        avatar_url=None,
        preferences_json=None,
    )

    # Generate JWT
    token_payload = {
        "sub": user.id,
        "email": user.email,
        "role": user.role
    }
    access_token = create_access_token(token_payload)

    return Token(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse.model_validate(user)
    )


@router.post("/login", response_model=Token)
def login(login_data: UserLogin, db: Session = Depends(get_db)):
    """
    Secure anti-enumeration login:
    Returns identical 401 Unauthorized for both invalid passwords and unregistered emails,
    with constant-time password verification to prevent timing attacks.
    """
    user = crud.get_user_by_email(db, email=login_data.email)
    if not user:
        # Dummy verification to neutralize timing side-channels
        verify_password("dummy_password_timing_defense", _DUMMY_TIMING_HASH)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not verify_password(login_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token_payload = {
        "sub": user.id,
        "email": user.email,
        "role": user.role
    }
    access_token = create_access_token(token_payload)

    return Token(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse.model_validate(user)
    )


@router.post("/forgot-password", response_model=ForgotPasswordResponse, status_code=status.HTTP_200_OK)
def forgot_password(
    payload: ForgotPasswordRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Blind password reset implementation (anti-enumeration):
    Instantly returns 200 OK with identical success message regardless of whether
    the submitted email exists in the database.
    Asynchronously sends either a password reset link (if account exists) or a registration invitation (if not).
    """
    user = crud.get_user_by_email(db, email=payload.email)
    account_exists = user is not None

    background_tasks.add_task(_send_blind_password_reset_email, email=payload.email, exists=account_exists)

    return ForgotPasswordResponse(
        message="If an account with that email exists, we have sent a password reset link.",
        status="success"
    )


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    """Returns the currently authenticated user's profile."""
    return UserResponse.model_validate(current_user)
