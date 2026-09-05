import json
import logging
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from llm.llm_client import generate
from db import crud

logger = logging.getLogger("planner_agent")
logger.setLevel(logging.INFO)

PLANNER_SYSTEM_PROMPT = """You are an expert Academic Curriculum Planner.
Your task is to analyze the provided course syllabus text, document, or image to infer the course outline, topics, and learning objectives automatically, and break them down into a structured, chronological list of learning modules.

Rules:
1. Carefully analyze any provided text, attached document (PDF/Word), or image (screenshot/photo of a syllabus or schedule) to infer the comprehensive curriculum structure, key topics, and learning goals.
2. Extract modules in logical sequential learning order.
3. For each module, identify:
   - "title": Concise, informative module title (e.g. "Module 1: Foundations of Classical Mechanics")
   - "order_index": Sequential integer starting from 1
   - "topics": Array of key concepts, subtopics, and competencies covered
   - "prerequisites": Array of prerequisite module titles or topics needed before this module
4. Return STRICTLY a valid JSON object with the key "modules" containing the list of modules.
"""


def plan_syllabus(
    syllabus_raw: str = "",
    course_id: Optional[str] = None,
    db: Optional[Session] = None,
    files: Optional[List[Any]] = None
) -> List[Dict[str, Any]]:
    """
    Parses raw syllabus text and/or multimodal documents/images using Gemini
    and returns an ordered list of module dicts.
    If course_id and db session are provided, saves the modules to the database.
    """
    if (not syllabus_raw or not syllabus_raw.strip()) and not files:
        raise ValueError("Syllabus text or attached document cannot be empty.")

    if syllabus_raw and syllabus_raw.strip():
        prompt = f"Please analyze the following syllabus content and attached materials to infer the course outline and extract ordered learning modules:\n\n{syllabus_raw}"
    else:
        prompt = "Please analyze the attached document or image to infer the course outline, topics, and objectives, and extract structured, ordered learning modules."

    response_text = generate(
        prompt=prompt,
        system=PLANNER_SYSTEM_PROMPT,
        json_mode=True,
        temperature=0.2,
        files=files
    )

    try:
        data = json.loads(response_text)
        modules = data.get("modules", [])
        if not isinstance(modules, list):
            modules = []
    except Exception as e:
        logger.error("Failed to parse JSON output from Planner Agent: %s. Response: %s", str(e), response_text)
        modules = [
            {
                "title": "Module 1: General Course Content",
                "order_index": 1,
                "topics": ["Introduction"],
                "prerequisites": []
            }
        ]

    # If database and course_id provided, persist to database
    if db is not None and course_id is not None:
        created_records = []
        for i, mod in enumerate(modules):
            title = mod.get("title", f"Module {i+1}")
            order_index = mod.get("order_index", i + 1)
            prereqs = mod.get("prerequisites", [])
            record = crud.create_module(
                db=db,
                course_id=course_id,
                title=title,
                order_index=order_index,
                prerequisites_json=prereqs
            )
            created_records.append(record)
        return modules

    return modules
