import json
import logging
import uuid
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from llm.llm_client import generate
from db import crud

logger = logging.getLogger("examiner_agent")
logger.setLevel(logging.INFO)

EXAMINER_SYSTEM_PROMPT = """You are an elite Academic Examiner and Assessment Designer for competitive computer-based testing (NTA, JEE, NEET, GRE level).
Your task is to generate difficulty-calibrated, high-yield multiple-choice questions strictly based on the provided course lecture context and syllabus.

Difficulty calibration guide:
- "easy": Focuses on direct recall, basic definitions, and core terminology.
- "medium": Tests conceptual understanding, scenario application, and standard problem-solving.
- "hard": Involves complex analysis, evaluating edge cases, synthesized concepts, or multi-step reasoning.

Output Format:
Return a valid JSON array of questions, OR a JSON object with a "questions" key containing the array:
[
  {
    "question": "Clear and unambiguous academic question stem",
    "options": ["A. Option 1", "B. Option 2", "C. Option 3", "D. Option 4"],
    "correct_answer": "A. Option 1",
    "difficulty": "easy" | "medium" | "hard",
    "explanation": "Detailed pedagogical explanation of why this answer is correct and why alternative options are incorrect."
  }
]

CRITICAL RULES:
1. Every question must have exactly 4 distinct and plausible options labelled "A. ", "B. ", "C. ", "D. ".
2. 'correct_answer' MUST be the exact matching option string (e.g. "A. Option 1"), not just the letter.
3. Every question MUST include a detailed, educational 'explanation'.
4. Base every question strictly on the provided syllabus and course materials.
"""


def get_calibrated_difficulty(mastery_score: float) -> str:
    """Calibrates assessment difficulty from mastery profile score [0.0 to 1.0]."""
    if mastery_score < 0.4:
        return "easy"
    elif mastery_score < 0.75:
        return "medium"
    else:
        return "hard"


def _normalize_options(raw_options: Any) -> List[str]:
    """Ensures options is a list of 4 choices prefixed with A., B., C., D."""
    if not isinstance(raw_options, list):
        return ["A. True", "B. False", "C. Neither", "D. Both"]

    prefixes = ["A. ", "B. ", "C. ", "D. "]
    cleaned = []
    for i, opt in enumerate(raw_options[:4]):
        opt_str = str(opt).strip()
        # Remove any existing leading letters like 'A)', 'A.', '(A)', etc.
        for p in ["A.", "B.", "C.", "D.", "A)", "B)", "C)", "D)", "(A)", "(B)", "(C)", "(D)"]:
            if opt_str.startswith(p):
                opt_str = opt_str[len(p):].strip()
                break
        prefix = prefixes[i] if i < len(prefixes) else f"{chr(65+i)}. "
        cleaned.append(f"{prefix}{opt_str}")

    # Pad if fewer than 4
    while len(cleaned) < 4:
        idx = len(cleaned)
        cleaned.append(f"{prefixes[idx]}None of the above")

    return cleaned


def _parse_questions_from_response(
    response_text: str,
    topic: str,
    target_difficulty: str = "medium"
) -> List[Dict[str, Any]]:
    """
    Parses the LLM JSON response into a list of question dicts.
    Accepts both:
    - Top-level JSON array: [ { "question": ..., "options": ... }, ... ]
    - JSON object: { "questions": [ { ... }, ... ] }
    """
    if not response_text or not response_text.strip():
        raise ValueError("LLM returned an empty response — cannot generate questions")

    # Clean potential markdown fences
    cleaned_text = response_text.strip()
    if cleaned_text.startswith("```json"):
        cleaned_text = cleaned_text[7:]
    elif cleaned_text.startswith("```"):
        cleaned_text = cleaned_text[3:]
    if cleaned_text.endswith("```"):
        cleaned_text = cleaned_text[:-3]
    cleaned_text = cleaned_text.strip()

    try:
        data = json.loads(cleaned_text)
    except json.JSONDecodeError as json_err:
        raise ValueError(
            f"LLM response is not valid JSON: {json_err}. Raw response snippet: {cleaned_text[:300]}"
        ) from json_err

    # Extract questions list
    if isinstance(data, list):
        raw_list = data
    elif isinstance(data, dict):
        raw_list = data.get("questions") or data.get("quiz") or data.get("items") or []
    else:
        raw_list = []

    if not isinstance(raw_list, list):
        raise ValueError(f"LLM JSON response missing questions list (got {type(raw_list).__name__})")

    valid_questions = []
    for idx, q in enumerate(raw_list):
        if not isinstance(q, dict):
            continue

        q_text = (q.get("question") or q.get("question_text") or "").strip()
        raw_opts = q.get("options") or q.get("options_json") or []
        correct = (q.get("correct_answer") or "").strip()
        explanation = (q.get("explanation") or "").strip()
        diff = q.get("difficulty") or target_difficulty

        if not q_text:
            continue

        # Normalize options to A., B., C., D.
        options = _normalize_options(raw_opts)

        # Match or normalize correct_answer
        matched_correct = None
        for opt in options:
            if correct.lower() == opt.lower():
                matched_correct = opt
                break
            # Handle if correct is just 'A', 'B', 'C', 'D'
            if len(correct) == 1 and opt.startswith(f"{correct.upper()}."):
                matched_correct = opt
                break
            # Handle if opt starts with correct string
            if opt[3:].strip().lower() == correct.lower():
                matched_correct = opt
                break

        if not matched_correct:
            matched_correct = options[0]

        valid_questions.append({
            "question_text": q_text,
            "options_json": options,
            "correct_answer": matched_correct,
            "difficulty": diff,
            "explanation": explanation or f"The correct answer is {matched_correct} based on course principles."
        })

    if not valid_questions:
        raise ValueError(f"No structurally valid questions found in LLM response ({len(raw_list)} items inspected)")

    return valid_questions


def generate_question_bank(
    course_id: str,
    module_id: str,
    topic: str,
    context_text: str = "",
    count: int = 25,
    seed_offset: int = 0,
    existing_questions: Optional[List[str]] = None,
    db: Optional[Session] = None
) -> List[Dict[str, Any]]:
    """
    Comprehensive Pre-Generated Question Bank Generator (NTA/JEE/NEET style).
    Generates a full array of unique, difficulty-calibrated MCQs (configurable 20 to 50)
    and saves them directly into the Supabase 'questions' table linked to module_id.
    """
    # Bound count between 5 and 50 (default 25)
    target_count = max(5, min(50, count))
    seed_id = f"{uuid.uuid4().hex[:8]}-{seed_offset}"

    context_section = context_text.strip() if context_text and context_text.strip() else f"Standard academic curriculum for: {topic}"

    exclusion_prompt = ""
    if existing_questions and len(existing_questions) > 0:
        sample_existing = existing_questions[:15]
        exclusion_prompt = (
            "\nAVOID DUPLICATES: Do NOT duplicate or closely rephrase any of these existing questions:\n"
            + "\n".join(f"- {s}" for s in sample_existing)
            + "\n"
        )

    prompt = f"""Topic / Module: {topic}
Question Bank Target Size: {target_count} unique MCQs
Variation Seed: {seed_id}
{exclusion_prompt}
Course Excerpts & Syllabus Context:
{context_section[:5000]}

Generate exactly {target_count} difficulty-calibrated, high-yield multiple choice questions.
Ensure balanced distribution:
- ~30% Easy (Direct recall, core formulas, definitions)
- ~40% Medium (Application, conceptual problem-solving)
- ~30% Hard (Multi-step reasoning, analytical synthesis)

Return STRICTLY a JSON array containing the {target_count} questions with:
"question", "options" (A, B, C, D), "correct_answer", "difficulty", and a detailed "explanation".
"""

    if db is not None:
        try:
            db.commit()
        except Exception:
            pass

    response_text = ""
    llm_error = None
    try:
        response_text = generate(
            prompt=prompt,
            system=EXAMINER_SYSTEM_PROMPT,
            json_mode=True,
            temperature=0.3
        )
    except Exception as e:
        llm_error = e
        logger.error("Examiner question bank generation failed for topic='%s': %s", topic, str(e))

    questions = None
    if response_text:
        try:
            questions = _parse_questions_from_response(response_text, topic=topic)
            logger.info("Successfully generated %d question bank items for topic='%s'", len(questions), topic)
        except Exception as parse_err:
            logger.error("Parsing question bank failed for topic='%s': %s", topic, str(parse_err))

    # Academic fallback if LLM unreachable or empty
    if not questions:
        logger.warning("Generating procedural question bank fallback for topic='%s' (LLM error: %s)", topic, llm_error)
        questions = []
        difficulties = ["easy", "medium", "hard"]
        for i in range(min(target_count, 10)):
            diff = difficulties[i % 3]
            q_num = i + 1
            questions.append({
                "question_text": f"What is a primary principle of {topic} (Concept {q_num})?",
                "options_json": [
                    f"A. Fundamental theoretical axiom of {topic}",
                    f"B. Secondary auxiliary mechanism",
                    f"C. Inverse contradictory condition",
                    f"D. Unrelated arbitrary property"
                ],
                "correct_answer": f"A. Fundamental theoretical axiom of {topic}",
                "difficulty": diff,
                "explanation": f"In {topic}, Option A represents the foundational tenet governing the behavior under study."
            })

    # Save questions to Supabase / Postgres DB
    if db is not None and module_id is not None:
        saved_records = []
        for idx, q in enumerate(questions):
            record = crud.create_question(
                db=db,
                module_id=module_id,
                question_text=q["question_text"],
                options_json=q["options_json"],
                correct_answer=q["correct_answer"],
                difficulty=q.get("difficulty", "medium"),
                explanation=q.get("explanation", ""),
                order_index=idx + 1
            )
            saved_records.append({
                "id": record.id,
                "module_id": record.module_id,
                "question_text": record.question_text,
                "options_json": record.options_json,
                "correct_answer": record.correct_answer,
                "difficulty": record.difficulty,
                "explanation": record.explanation or "",
                "order_index": record.order_index
            })
        return saved_records

    return questions


def generate_quiz(
    topic: str,
    context_text: str,
    module_id: Optional[str] = None,
    mastery_score: float = 0.5,
    num_questions: int = 1,
    db: Optional[Session] = None
) -> List[Dict[str, Any]]:
    """
    Backward-compatible quiz generator for adaptive calibration and unit tests.
    """
    target_difficulty = get_calibrated_difficulty(mastery_score)
    context_section = context_text.strip() if context_text and context_text.strip() else f"Topic: {topic}"

    prompt = f"""Topic: {topic}
Target Difficulty: {target_difficulty} (Mastery: {mastery_score:.2f})
Number of Questions: {num_questions}

Course Context:
{context_section}

Generate {num_questions} {target_difficulty}-level multiple choice questions.
Return JSON with 'questions' array.
"""
    if db is not None:
        try:
            db.commit()
        except Exception:
            pass

    response_text = ""
    try:
        response_text = generate(
            prompt=prompt,
            system=EXAMINER_SYSTEM_PROMPT,
            json_mode=True,
            temperature=0.3
        )
    except Exception as e:
        logger.error("Examiner generate_quiz LLM call failed for '%s': %s", topic, str(e))

    questions = None
    if response_text:
        try:
            questions = _parse_questions_from_response(response_text, topic=topic, target_difficulty=target_difficulty)
        except Exception as e:
            logger.error("Examiner generate_quiz parse failed: %s", str(e))

    if not questions:
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
                "explanation": f"Core principle of {topic} represents the primary definition."
            }
        ]

    if db is not None and module_id is not None:
        saved_questions = []
        for idx, q in enumerate(questions):
            record = crud.create_question(
                db=db,
                module_id=module_id,
                question_text=q["question_text"],
                options_json=q["options_json"],
                correct_answer=q["correct_answer"],
                difficulty=q.get("difficulty", target_difficulty),
                explanation=q.get("explanation", ""),
                order_index=idx + 1
            )
            saved_questions.append({
                "id": record.id,
                "module_id": record.module_id,
                "question_text": record.question_text,
                "options_json": record.options_json,
                "correct_answer": record.correct_answer,
                "difficulty": record.difficulty,
                "explanation": record.explanation or ""
            })
        return saved_questions

    return questions
