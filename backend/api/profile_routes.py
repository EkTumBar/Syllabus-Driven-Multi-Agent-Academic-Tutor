import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from db.database import get_db
from db import crud
from db.models import User
from auth.dependencies import get_current_user
from schemas.pydantic_models import MasteryResponse

logger = logging.getLogger("profile_routes")
router = APIRouter(prefix="/profile", tags=["Student Profile & Mastery"])


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
