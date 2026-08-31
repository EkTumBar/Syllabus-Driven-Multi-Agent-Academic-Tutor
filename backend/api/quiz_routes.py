import logging
from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from db.database import get_db
from db import crud
from db.models import User
from auth.dependencies import get_current_user
from agents.orchestrator import run_step

logger = logging.getLogger("quiz_routes")
router = APIRouter(tags=["Quiz & Assessment"])


class AnswerSubmission(BaseModel):
    answer_given: str
    course_id: Optional[str] = None


@router.get("/courses/{course_id}/next-question")
def get_next_question(
    course_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Generates or retrieves the next adaptive question for the user in this course."""
    course = crud.get_course_by_id(db, course_id=course_id)
    if not course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
    if course.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    result = run_step(
        db=db,
        course_id=course_id,
        user_id=current_user.id,
        step_input={"action": "next_question"}
    )
    return result


@router.post("/questions/{question_id}/answer")
def submit_answer(
    question_id: str,
    payload: AnswerSubmission,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Evaluates student answer, updates mastery profile, and returns feedback with remediation if triggered."""
    question = crud.get_question_by_id(db, question_id=question_id)
    if not question:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found")

    module = crud.get_module_by_id(db, module_id=question.module_id)
    course_id = payload.course_id or (module.course_id if module else None)

    if not course_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Could not resolve course for question")

    step_input = {
        "action": "submit_answer",
        "question_id": question.id,
        "question_text": question.question_text,
        "answer_given": payload.answer_given,
        "correct_answer": question.correct_answer
    }

    result = run_step(
        db=db,
        course_id=course_id,
        user_id=current_user.id,
        step_input=step_input
    )
    return result
