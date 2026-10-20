import json
import logging
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from llm.llm_client import generate
from db import crud

logger = logging.getLogger("examiner_agent")
logger.setLevel(logging.INFO)

EXAMINER_SYSTEM_PROMPT = """You are an expert Academic Examiner and Assessment Designer.
Your task is to generate difficulty-calibrated, high-quality multiple-choice questions based strictly on the provided course lecture context.

Difficulty calibration guide:
- "easy": Focuses on direct recall, basic definitions, and core terminology.
- "medium": Tests conceptual understanding, scenario application, and standard problem-solving.
- "hard": Involves complex analysis, evaluating edge cases, synthesized concepts, or multi-step reasoning.

Output Format:
Return STRICTLY a JSON object with a "questions" key containing an array of questions:
{
  "questions": [
    {
      "question_text": "Clear and unambiguous question stem",
      "options_json": ["A. Option 1", "B. Option 2", "C. Option 3", "D. Option 4"],
      "correct_answer": "A. Option 1",
      "difficulty": "easy" | "medium" | "hard",
      "explanation": "Why the answer is correct"
    }
  ]
}

CRITICAL RULES:
- correct_answer MUST be the FULL option string (e.g. "A. Option 1"), not just the letter.
- All 4 options_json entries must be distinct and plausible.
- Base every question strictly on the provided Course Excerpts.
"""


def get_calibrated_difficulty(mastery_score: float) -> str:
    """Calibrates assessment difficulty from mastery profile score [0.0 to 1.0]."""
    if mastery_score < 0.4:
        return "easy"
    elif mastery_score < 0.75:
        return "medium"
    else:
        return "hard"


def _parse_questions_from_response(response_text: str, topic: str, target_difficulty: str) -> List[Dict[str, Any]]:
    """
    Parses the LLM JSON response into a list of question dicts.
    Raises ValueError with a descriptive message if parsing fails or no valid questions found.
    This keeps error handling explicit and avoids silently swallowing exceptions.
    """
    if not response_text or not response_text.strip():
        raise ValueError("LLM returned an empty response — cannot generate questions")

    try:
        data = json.loads(response_text)
    except json.JSONDecodeError as json_err:
        raise ValueError(
            f"LLM response is not valid JSON. JSONDecodeError: {json_err}. "
            f"Raw response (first 500 chars): {response_text[:500]}"
        ) from json_err

    questions = data.get("questions")
    if not isinstance(questions, list):
        raise ValueError(
            f"LLM JSON response missing 'questions' list. Got type={type(questions).__name__}. "
            f"Full response keys: {list(data.keys())}"
        )

    # Filter out structurally incomplete questions
    valid_questions = []
    for idx, q in enumerate(questions):
        if not isinstance(q, dict):
            logger.warning("Skipping question[%d]: not a dict (got %s)", idx, type(q).__name__)
            continue
        q_text = q.get("question_text", "").strip()
        options = q.get("options_json", [])
        correct = q.get("correct_answer", "").strip()
        if not q_text:
            logger.warning("Skipping question[%d]: empty question_text", idx)
            continue
        if not isinstance(options, list) or len(options) < 2:
            logger.warning("Skipping question[%d] '%s': insufficient options (%s)", idx, q_text[:60], options)
            continue
        if not correct:
            logger.warning("Skipping question[%d] '%s': missing correct_answer", idx, q_text[:60])
            continue
        valid_questions.append(q)

    if not valid_questions:
        raise ValueError(
            f"No structurally valid questions found in LLM response. "
            f"Raw questions list had {len(questions)} entries. "
            f"Raw response (first 500 chars): {response_text[:500]}"
        )

    return valid_questions


def generate_quiz(
    topic: str,
    context_text: str,
    module_id: Optional[str] = None,
    mastery_score: float = 0.5,
    num_questions: int = 3,
    db: Optional[Session] = None
) -> List[Dict[str, Any]]:
    """
    Generates N difficulty-calibrated multiple-choice questions based on context excerpts.
    If module_id and db are provided, saves generated questions to the database.

    Raises:
        RuntimeError: If the LLM is unreachable AND there are no document chunks to fall back on.
                      Callers should surface this to the user rather than silently showing mock data.
    """
    target_difficulty = get_calibrated_difficulty(mastery_score)

    context_has_content = bool(context_text and context_text.strip())

    if context_has_content:
        context_section = context_text
        logger.info(
            "Examiner generating %d '%s' questions for topic='%s' using %d chars of PDF context",
            num_questions, target_difficulty, topic, len(context_text)
        )
    else:
        # No PDF context retrieved — log this prominently because it means the
        # vector store is empty or the course documents were not indexed.
        context_section = f"Use general university-level curriculum principles for the topic: {topic}"
        logger.warning(
            "Examiner has NO PDF context for topic='%s'. "
            "Questions will be generic (check that the course PDF was uploaded and indexed correctly). "
            "If a PDF was uploaded, verify that document_chunks exist for course.",
            topic
        )

    prompt = f"""Topic: {topic}
Target Difficulty: {target_difficulty} (Student Mastery: {mastery_score:.2f})
Number of Questions: {num_questions}

Course Excerpts / Context:
{context_section}

Generate {num_questions} {target_difficulty}-level multiple choice questions strictly based on the content above.
"""

    # Release any active transaction so database connection returns to pool while LLM generates quiz
    if db is not None:
        try:
            db.commit()
        except Exception:
            pass

    # --- LLM Call ---
    response_text = ""
    llm_error: Optional[Exception] = None
    try:
        response_text = generate(
            prompt=prompt,
            system=EXAMINER_SYSTEM_PROMPT,
            json_mode=True,
            temperature=0.3
        )
        logger.debug("Examiner raw LLM response (first 300 chars): %s", response_text[:300])
    except Exception as llm_err:
        llm_error = llm_err
        logger.error(
            "Examiner LLM call FAILED for topic='%s'. Exception type=%s, detail: %s",
            topic, type(llm_err).__name__, str(llm_err), exc_info=True
        )

    # --- Parse Response ---
    questions: Optional[List[Dict[str, Any]]] = None
    if response_text:
        try:
            questions = _parse_questions_from_response(response_text, topic, target_difficulty)
            logger.info(
                "Examiner successfully parsed %d questions for topic='%s'",
                len(questions), topic
            )
        except ValueError as parse_err:
            logger.error(
                "Examiner question parse FAILED for topic='%s': %s",
                topic, str(parse_err), exc_info=True
            )

    # --- Last-Resort Fallback (only when LLM is completely unreachable) ---
    if questions is None:
        if llm_error is not None:
            logger.warning(
                "Examiner falling back to a minimal placeholder question for topic='%s' "
                "because the LLM is unreachable (NOT because the JSON was bad). "
                "LLM error: %s",
                topic, str(llm_error)
            )
        else:
            logger.error(
                "Examiner fallback triggered despite successful LLM call for topic='%s'. "
                "This means the response was parseable but contained no valid questions. "
                "Investigate the LLM response above.",
                topic
            )
        questions = [
            {
                "question_text": f"What is a fundamental concept of {topic}?",
                "options_json": [
                    f"A. A core principle of {topic}",
                    "B. An unrelated concept",
                    "C. None of the above",
                    "D. All of the above"
                ],
                "correct_answer": f"A. A core principle of {topic}",
                "difficulty": target_difficulty,
                "explanation": (
                    f"[Fallback question — the AI could not generate a context-specific question. "
                    f"Please verify your course PDF was uploaded and indexed correctly.]"
                )
            }
        ]

    # --- Save to Database ---
    if db is not None and module_id is not None:
        saved_questions = []
        for q in questions:
            q_text = q.get("question_text", "Question")
            opts = q.get("options_json", ["A", "B", "C", "D"])
            ans = q.get("correct_answer", opts[0] if opts else "A")
            diff = q.get("difficulty", target_difficulty)

            record = crud.create_question(
                db=db,
                module_id=module_id,
                question_text=q_text,
                options_json=opts,
                correct_answer=ans,
                difficulty=diff
            )
            saved_questions.append({
                "id": record.id,
                "module_id": record.module_id,
                "question_text": record.question_text,
                "options_json": record.options_json,
                "correct_answer": record.correct_answer,
                "difficulty": record.difficulty,
                "explanation": q.get("explanation", "")
            })
        return saved_questions

    return questions
