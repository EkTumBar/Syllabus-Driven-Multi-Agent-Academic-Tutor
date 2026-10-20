import logging
import asyncio
from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from starlette.concurrency import run_in_threadpool
from pydantic import BaseModel
from sqlalchemy.orm import Session
from db.database import get_db
from db import crud
from db.models import User
from auth.dependencies import get_current_user
from agents.orchestrator import run_step

logger = logging.getLogger("quiz_routes")
router = APIRouter(tags=["Quiz & Assessment"])

ASSESSMENT_ROUTE_TIMEOUT_SECONDS = 25.0


class AnswerSubmission(BaseModel):
    answer_given: str
    course_id: Optional[str] = None


@router.get("/courses/{course_id}/next-question")
async def get_next_question(
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

    try:
        result = await asyncio.wait_for(
            run_in_threadpool(
                run_step,
                db=db,
                course_id=course_id,
                user_id=current_user.id,
                step_input={"action": "next_question"}
            ),
            timeout=ASSESSMENT_ROUTE_TIMEOUT_SECONDS
        )
        return result
    except asyncio.TimeoutError:
        logger.error(
            "Timeout generating next question for course_id=%s, user_id=%s (>%.1fs)",
            course_id, current_user.id, ASSESSMENT_ROUTE_TIMEOUT_SECONDS
        )
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Generating the next question timed out. Please try again."
        )
    except Exception as e:
        logger.error("Error generating next question: %s", str(e), exc_info=True)
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate the next question. Please try again."
        )


@router.post("/questions/{question_id}/answer")
async def submit_answer(
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

    try:
        result = await asyncio.wait_for(
            run_in_threadpool(
                run_step,
                db=db,
                course_id=course_id,
                user_id=current_user.id,
                step_input=step_input
            ),
            timeout=ASSESSMENT_ROUTE_TIMEOUT_SECONDS
        )
        return result
    except asyncio.TimeoutError:
        logger.error(
            "Timeout evaluating answer for question_id=%s, user_id=%s (>%.1fs)",
            question_id, current_user.id, ASSESSMENT_ROUTE_TIMEOUT_SECONDS
        )
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Evaluating your answer timed out. Please try again."
        )
    except Exception as e:
        logger.error("Error evaluating answer: %s", str(e), exc_info=True)
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to evaluate your answer. Please try again."
        )


@router.post("/courses/{course_id}/reset-quiz")
def reset_quiz_progress(
    course_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Resets the student's quiz attempts for this course, allowing a fresh exam run through the question bank."""
    course = crud.get_course_by_id(db, course_id=course_id)
    if not course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
    if course.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    # Delete all attempts by this user for questions belonging to this course
    modules = crud.get_modules_by_course(db, course_id=course_id)
    mod_ids = [m.id for m in modules]
    if mod_ids:
        q_rows = db.query(crud.Question.id).filter(crud.Question.module_id.in_(mod_ids)).all()
        q_ids = [q[0] for q in q_rows]
        if q_ids:
            db.query(crud.Attempt).filter(
                crud.Attempt.user_id == current_user.id,
                crud.Attempt.question_id.in_(q_ids)
            ).delete(synchronize_session=False)
            db.commit()

    # Reset orchestrator pointer to first module
    if modules:
        crud.upsert_orchestrator_state(
            db=db,
            user_id=current_user.id,
            course_id=course_id,
            current_module=modules[0].id,
            status="idle"
        )

    return {"message": "Quiz progress reset successfully. You can now retake the exam bank from question 1."}

