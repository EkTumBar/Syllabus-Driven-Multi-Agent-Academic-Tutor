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
      "correct_answer": "A",
      "difficulty": "easy" | "medium" | "hard",
      "explanation": "Why the answer is correct"
    }
  ]
}
"""


def get_calibrated_difficulty(mastery_score: float) -> str:
    """Calibrates assessment difficulty from mastery profile score [0.0 to 1.0]."""
    if mastery_score < 0.4:
        return "easy"
    elif mastery_score < 0.75:
        return "medium"
    else:
        return "hard"


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
    """
    target_difficulty = get_calibrated_difficulty(mastery_score)

    prompt = f"""Topic: {topic}
Target Difficulty: {target_difficulty} (Student Mastery: {mastery_score:.2f})
Number of Questions: {num_questions}

Course Excerpts / Context:
{context_text if context_text.strip() else 'Use standard university curriculum principles for: ' + topic}

Generate {num_questions} {target_difficulty}-level multiple choice questions strictly based on the content above.
"""

    response_text = generate(
        prompt=prompt,
        system=EXAMINER_SYSTEM_PROMPT,
        json_mode=True,
        temperature=0.3
    )

    try:
        data = json.loads(response_text)
        questions = data.get("questions", [])
        if not isinstance(questions, list):
            questions = []
    except Exception as e:
        logger.error("Failed to parse Examiner JSON output: %s. Response: %s", str(e), response_text)
        questions = [
            {
                "question_text": f"What is a primary concept of {topic}?",
                "options_json": [f"A. Fundamental aspect of {topic}", "B. Unrelated concept", "C. None", "D. All of the above"],
                "correct_answer": f"A. Fundamental aspect of {topic}",
                "difficulty": target_difficulty,
                "explanation": f"Concept explanation for {topic}"
            }
        ]

    # Save to database if db and module_id are provided
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
