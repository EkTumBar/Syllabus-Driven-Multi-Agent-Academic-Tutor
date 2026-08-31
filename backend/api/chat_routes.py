import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from db.database import get_db
from db import crud
from db.models import User
from auth.dependencies import get_current_user
from agents.researcher_agent import research_topic
from llm.llm_client import generate

logger = logging.getLogger("chat_routes")
router = APIRouter(prefix="/courses", tags=["Interactive Tutoring Chat"])


class ExplainRequest(BaseModel):
    topic: str
    question_text: Optional[str] = None
    student_query: Optional[str] = None
    remediate: bool = False


EXPLAINER_SYSTEM_PROMPT = """You are an empathetic, world-class university tutor.
Your goal is to explain concepts clearly, breaking down difficult ideas into intuitive first principles, analogies, and step-by-step examples.
Ground your response strictly in the provided course lecture materials whenever possible.
"""


@router.post("/{course_id}/explain")
def explain_topic(
    course_id: str,
    payload: ExplainRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Provides conversational, Socratic academic explanation and remediation grounded in course lecture materials."""
    course = crud.get_course_by_id(db, course_id=course_id)
    if not course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
    if course.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    # 1. Retrieve course context
    research_res = research_topic(
        db=db,
        course_id=course_id,
        topic=payload.topic,
        remediate=True,
        top_k=4
    )
    context_text = research_res.get("context_text", "")

    # 2. Build explanation prompt
    student_question = payload.student_query or f"Can you please explain {payload.topic} in simple terms with an example?"
    prompt = f"""Topic: {payload.topic}
Context Excerpts from Course Lectures:
{context_text if context_text.strip() else 'No specific excerpts found. Use standard academic principles.'}

Student Question / Confusion:
{student_question}

Related Quiz Question (if any):
{payload.question_text or 'N/A'}

Provide an engaging, clear, and reassuring explanation:
"""

    explanation = generate(
        prompt=prompt,
        system=EXPLAINER_SYSTEM_PROMPT,
        json_mode=False,
        temperature=0.3
    )

    return {
        "topic": payload.topic,
        "explanation": explanation,
        "references": research_res.get("excerpts", [])
    }
