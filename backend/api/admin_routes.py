import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from db.database import get_db
from db import crud
from db.models import User
from auth.dependencies import require_admin
from schemas.pydantic_models import UserResponse, AdminLogResponse

logger = logging.getLogger("admin_routes")
router = APIRouter(prefix="/admin", tags=["Administrator Dashboard"])


@router.get("/users", response_model=List[UserResponse])
def list_all_users_admin(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """Lists all registered users in the platform. Writes audit log."""
    users = crud.get_all_users(db, skip=0, limit=200)

    # Log admin action
    crud.create_admin_log(
        db=db,
        admin_id=admin.id,
        action="VIEW_USERS",
        details_json={"users_count": len(users)}
    )

    return users


@router.get("/users/{user_id}/mastery")
def get_user_mastery_admin(
    user_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """Inspects mastery profile of any student. Writes audit log."""
    target_user = crud.get_user_by_id(db, user_id=user_id)
    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    records = crud.get_mastery_by_user(db, user_id=user_id)

    # Log admin action
    crud.create_admin_log(
        db=db,
        admin_id=admin.id,
        action="VIEW_USER_MASTERY",
        target_user_id=user_id,
        details_json={"records_count": len(records)}
    )

    return {
        "user_id": target_user.id,
        "email": target_user.email,
        "records": records
    }


@router.delete("/courses/{course_id}")
def delete_course_admin(
    course_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """Deletes any course and associated materials across tenants. Writes audit log."""
    course = crud.get_course_by_id(db, course_id=course_id)
    if not course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")

    target_owner = course.user_id
    course_title = course.title

    success = crud.delete_course(db, course_id=course_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to delete course")

    # Log admin action
    crud.create_admin_log(
        db=db,
        admin_id=admin.id,
        action="DELETE_COURSE",
        target_user_id=target_owner,
        details_json={"course_id": course_id, "title": course_title}
    )

    return {"message": f"Course '{course_title}' successfully deleted by admin"}


@router.get("/logs", response_model=List[AdminLogResponse])
def get_audit_logs_admin(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """Retrieves immutable system audit log entries."""
    logs = crud.get_admin_logs(db, skip=skip, limit=limit)
    return logs
