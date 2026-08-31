import json
import logging
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from llm.llm_client import generate
from db import crud

logger = logging.getLogger("evaluator_agent")
logger.setLevel(logging.INFO)

EVALUATOR_SYSTEM_PROMPT = """You are an empathetic, constructive Academic Evaluation and Tutoring Specialist.
Analyze the student's answer compared to the correct answer. Provide:
1. "is_correct": boolean
2. "feedback": Concise pedagogical feedback explaining why the answer is correct or clarifying the misunderstanding.
3. "key_takeaway": One concise summary sentence of the concept.

Output JSON Format:
{
  "is_correct": true | false,
  "feedback": "...",
  "key_takeaway": "..."
}
"""


def check_is_correct(answer_given: str, correct_answer: str) -> bool:
    """Performs normalized comparison between student answer and reference answer."""
    norm_given = answer_given.strip().lower()
    norm_correct = correct_answer.strip().lower()

    if norm_given == norm_correct:
        return True

    # Handle option prefix matches (e.g. "A" vs "A. Some text" or "Option A")
    if len(norm_given) == 1 and norm_correct.startswith(norm_given):
        return True
    if len(norm_correct) == 1 and norm_given.startswith(norm_correct):
        return True

    return False


def evaluate_answer(
    db: Session,
    user_id: str,
    module_id: str,
    topic: str,
    question_id: str,
    answer_given: str,
    correct_answer: str,
    question_text: str = ""
) -> Dict[str, Any]:
    """
    Evaluates student answer, updates mastery score, checks remediation threshold,
    and records the attempt in Postgres.
    """
    is_correct = check_is_correct(answer_given, correct_answer)

    # 1. Record the attempt in Postgres
    crud.create_attempt(
        db=db,
        user_id=user_id,
        question_id=question_id,
        answer_given=answer_given,
        is_correct=is_correct
    )

    # 2. Retrieve existing mastery profile
    existing_mastery = crud.get_mastery_record(db, user_id=user_id, module_id=module_id, topic=topic)
    current_score = existing_mastery.score_0to1 if existing_mastery else 0.5
    attempts_count = (existing_mastery.attempts_count if existing_mastery else 0) + 1

    # 3. Score progression calculation
    if is_correct:
        score_change = +0.15
        new_score = min(1.0, round(current_score + score_change, 2))
    else:
        score_change = -0.15
        new_score = max(0.0, round(current_score + score_change, 2))

    # 4. Check for Remediation Condition:
    # Trigger remediation if:
    # A) The last 2 consecutive attempts by this user are incorrect, OR
    # B) Current mastery score is below 0.4 after 2 or more attempts.
    recent_attempts = crud.get_attempts_by_user(db, user_id=user_id)
    remediate = False

    if len(recent_attempts) >= 2:
        # Check last two attempts (most recent first)
        last_two_failed = not recent_attempts[0].is_correct and not recent_attempts[1].is_correct
        low_mastery_threshold = new_score < 0.4
        if last_two_failed or low_mastery_threshold:
            remediate = True
    elif not is_correct and new_score < 0.4:
        remediate = True

    # 5. Generate instructional feedback via LLM
    feedback = ""
    try:
        eval_prompt = f"""Question: {question_text}
Student's Answer: {answer_given}
Correct Answer: {correct_answer}
Evaluation: {'CORRECT' if is_correct else 'INCORRECT'}
"""
        response_text = generate(
            prompt=eval_prompt,
            system=EVALUATOR_SYSTEM_PROMPT,
            json_mode=True,
            temperature=0.2
        )
        data = json.loads(response_text)
        feedback = data.get("feedback", "")
    except Exception as e:
        logger.warning("LLM feedback generation fallback: %s", str(e))
        if is_correct:
            feedback = "Excellent work! That is the correct answer."
        else:
            feedback = f"Incorrect. The correct answer is: {correct_answer}."

    # 6. Update mastery profile in Postgres
    crud.upsert_mastery(
        db=db,
        user_id=user_id,
        module_id=module_id,
        topic=topic,
        score_0to1=new_score,
        increment_attempt=True
    )

    return {
        "is_correct": is_correct,
        "score_change": score_change,
        "mastery_score": new_score,
        "feedback": feedback,
        "remediate": remediate,
        "topic": topic,
        "attempts_count": attempts_count
    }
