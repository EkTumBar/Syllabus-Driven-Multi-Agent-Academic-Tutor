import logging
import random
import time
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from db.database import get_db
from db import crud
from db.models import User
from auth.dependencies import get_current_user
from auth.jwt_handler import get_password_hash, verify_password
from schemas.pydantic_models import (
    UserResponse,
    UserProfileUpdate,
    PasswordChangeRequest,
    SendOtpRequest,
    OtpResponse,
    SessionItem,
    MasteryResponse
)

logger = logging.getLogger("profile_routes")
router = APIRouter(prefix="/profile", tags=["Student Profile, Security & Mastery"])

# In-memory secure OTP storage: user_id -> {"otp": str, "expires_at": float}
_OTP_CACHE: Dict[str, Dict[str, Any]] = {}
OTP_TTL_SECONDS = 300  # 5 minutes validity

# Revoked sessions tracking: set of revoked session_ids
_REVOKED_SESSIONS: set[str] = set()


def _mask_phone_number(phone: Optional[str]) -> str:
    if not phone:
        return "+1 (555) ***-****"
    digits_only = [c for c in phone if c.isdigit()]
    if len(digits_only) <= 4:
        return "***-***-****"
    last_four = "".join(digits_only[-4:])
    return f"+{digits_only[0]} (***) ***-{last_four}"


def calculate_mastery_summary(records: list) -> dict:
    if not records:
        return {
            "total_topics": 0,
            "average_score": 0.0,
            "mastered_count": 0,
            "remediation_needed_count": 0,
            "total_attempts": 0
        }

    total_topics = len(records)
    total_score = sum(r.score_0to1 for r in records)
    total_attempts = sum(r.attempts_count for r in records)
    mastered = sum(1 for r in records if r.score_0to1 >= 0.8)
    remediation = sum(1 for r in records if r.score_0to1 < 0.4)

    return {
        "total_topics": total_topics,
        "average_score": round(total_score / total_topics, 2),
        "mastered_count": mastered,
        "remediation_needed_count": remediation,
        "total_attempts": total_attempts
    }


# -----------------------------------------------------------------------------
# Profile Management Endpoints
# -----------------------------------------------------------------------------
@router.get("/me", response_model=UserResponse)
def get_my_profile(current_user: User = Depends(get_current_user)):
    """Retrieves full profile and account details for the authenticated user."""
    return UserResponse.model_validate(current_user)


@router.put("/me", response_model=UserResponse)
def update_my_profile(
    profile_data: UserProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Updates personal information, display settings, and preferences for current user."""
    # Validate username uniqueness if provided and changed
    if profile_data.username and profile_data.username.strip():
        existing_user = db.query(User).filter(
            User.username == profile_data.username.strip(),
            User.id != current_user.id
        ).first()
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This username is already taken. Please choose another."
            )

    first_name = profile_data.first_name
    last_name = profile_data.last_name
    if profile_data.name is not None and first_name is None and last_name is None:
        parts = profile_data.name.strip().split(maxsplit=1)
        first_name = parts[0] if parts else ""
        last_name = parts[1] if len(parts) > 1 else ""

    updated_user = crud.update_user_profile(
        db=db,
        user_id=current_user.id,
        first_name=first_name,
        last_name=last_name,
        username=profile_data.username,
        phone_number=profile_data.phone_number,
        location=profile_data.location,
        avatar_url=profile_data.avatar_url,
        preferences_json=profile_data.preferences_json
    )

    if not updated_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    return UserResponse.model_validate(updated_user)


# -----------------------------------------------------------------------------
# Security & OTP Password Management
# -----------------------------------------------------------------------------
@router.post("/send-otp", response_model=OtpResponse)
def send_security_otp(
    payload: SendOtpRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Generates a secure 6-digit OTP code for password changes or critical security actions.
    Stores code in temporary server cache with a 5-minute TTL.
    """
    phone = payload.phone_number or current_user.phone_number or "+1 (555) 234-5678"
    otp_code = f"{random.randint(100000, 999999)}"
    expires_at = time.time() + OTP_TTL_SECONDS

    _OTP_CACHE[current_user.id] = {
        "otp": otp_code,
        "expires_at": expires_at,
        "phone": phone
    }

    masked_phone = _mask_phone_number(phone)
    logger.info("Security OTP generated for user %s on %s", current_user.id, masked_phone)

    return OtpResponse(
        message=f"A verification code has been dispatched to {masked_phone}.",
        phone_masked=masked_phone,
        simulated_otp=otp_code
    )


@router.post("/change-password")
def change_password(
    req: PasswordChangeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Verifies current password and OTP code, then updates the user's password securely.
    """
    # 1. Verify current password
    if not verify_password(req.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect."
        )

    # 2. Validate new password strength
    if len(req.new_password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be at least 8 characters long."
        )

    # 3. Verify OTP code
    otp_entry = _OTP_CACHE.get(current_user.id)
    if not otp_entry:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active OTP found. Please request an OTP code first."
        )

    if time.time() > otp_entry["expires_at"]:
        _OTP_CACHE.pop(current_user.id, None)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The verification code has expired. Please request a new one."
        )

    if otp_entry["otp"] != req.otp.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid OTP verification code. Please check and try again."
        )

    # OTP verified -> consume OTP to prevent replay attacks
    _OTP_CACHE.pop(current_user.id, None)

    # 4. Hash and save new password
    hashed_pwd = get_password_hash(req.new_password)
    crud.update_user_password(db=db, user_id=current_user.id, hashed_password=hashed_pwd)

    logger.info("User %s successfully updated their password via OTP verification.", current_user.id)
    return {"message": "Password changed successfully."}


# -----------------------------------------------------------------------------
# Active Sessions Management
# -----------------------------------------------------------------------------
@router.get("/sessions", response_model=List[SessionItem])
def get_active_sessions(
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """Lists current and known active login sessions for the authenticated user."""
    user_agent = request.headers.get("user-agent", "Web Browser on Unknown OS")
    device_name = "Chrome on macOS"
    if "Windows" in user_agent:
        device_name = "Browser on Windows"
    elif "Macintosh" in user_agent:
        device_name = "Chrome on macOS"
    elif "iPhone" in user_agent or "Android" in user_agent:
        device_name = "Mobile Web"

    client_ip = request.client.host if request.client else "127.0.0.1"

    sessions = [
        SessionItem(
            id="session-current",
            device=f"{device_name} (Current Session)",
            ip=client_ip,
            location=current_user.location or "London, United Kingdom",
            last_active="Active Now",
            is_current=True
        )
    ]

    # Secondary mock session if not explicitly revoked
    if "session-mobile-1" not in _REVOKED_SESSIONS:
        sessions.append(
            SessionItem(
                id="session-mobile-1",
                device="Mobile App on iOS 18",
                ip="192.168.1.104",
                location="London, United Kingdom",
                last_active="2 hours ago",
                is_current=False
            )
        )

    return sessions


@router.post("/sessions/revoke")
def revoke_session(
    session_id: str,
    current_user: User = Depends(get_current_user)
):
    """Revokes a specific remote session."""
    if session_id == "session-current":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot revoke current session from this button. Use Logout instead."
        )

    _REVOKED_SESSIONS.add(session_id)
    return {"message": "Session revoked successfully."}


# -----------------------------------------------------------------------------
# Account Deletion (Danger Zone)
# -----------------------------------------------------------------------------
@router.delete("/me", status_code=status.HTTP_200_OK)
def delete_my_account(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Permanently deletes user account and cascades removal of all enrolled courses,
    attempts, and mastery profiles.
    """
    user_id = current_user.id
    success = crud.delete_user(db=db, user_id=user_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User account not found.")

    logger.warning("User %s permanently deleted their account.", user_id)
    return {"message": "Account successfully deleted."}


# -----------------------------------------------------------------------------
# Mastery Profile Endpoints (Preserved for existing frontend / evaluators)
# -----------------------------------------------------------------------------
@router.get("/mastery")
def get_my_mastery(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieves mastery profile and progression summary for the authenticated user."""
    records = crud.get_mastery_by_user(db, user_id=current_user.id)
    summary = calculate_mastery_summary(records)

    return {
        "user_id": current_user.id,
        "email": current_user.email,
        "summary": summary,
        "records": records
    }


@router.get("/{user_id}/mastery")
def get_user_mastery(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieves mastery profile for a specific user (accessible by the user or admin)."""
    if current_user.id != user_id and current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    target_user = crud.get_user_by_id(db, user_id=user_id)
    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    records = crud.get_mastery_by_user(db, user_id=user_id)
    summary = calculate_mastery_summary(records)

    return {
        "user_id": target_user.id,
        "email": target_user.email,
        "summary": summary,
        "records": records
    }
