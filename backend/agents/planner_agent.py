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

    import re
    modules = []
    try:
        cleaned = response_text.strip()
        if "```" in cleaned:
            match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', cleaned)
            if match:
                cleaned = match.group(1).strip()
        data = json.loads(cleaned)
        if isinstance(data, list):
            modules = data
        elif isinstance(data, dict):
            modules = data.get("modules") or data.get("curriculum") or data.get("topics") or []
        else:
            modules = []
    except Exception as e:
        logger.error("Failed to parse JSON output from Planner Agent: %s. Response: %s", str(e), response_text)
        modules = []

    # If parsing didn't yield modules, extract directly from user's actual syllabus text
    if not modules and syllabus_raw and syllabus_raw.strip():
        logger.info("Extracting modules directly from syllabus lines as fallback")
        lines = [line.strip() for line in syllabus_raw.splitlines() if line.strip() and not line.startswith("[Extracted")]
        found = []
        for line in lines:
            if any(line.lower().startswith(p) for p in ["module", "chapter", "unit", "week", "topic", "part", "#"]):
                clean = line.lstrip("#").strip()
                if len(clean) > 3:
                    found.append(clean)
        if not found:
            substantive = [l for l in lines if len(l) > 5]
            found = substantive[:5] if substantive else [lines[0]]

        modules = [
            {
                "title": title if (title.lower().startswith("module") or title.lower().startswith("unit")) else f"Module {i+1}: {title}",
                "order_index": i + 1,
                "topics": [title],
                "prerequisites": []
            }
            for i, title in enumerate(found)
        ]

    if not modules:
        logger.error("Planner agent failed: unable to extract curriculum modules from syllabus.")
        raise ValueError(f"Unable to extract curriculum modules from provided syllabus. Response: {response_text[:300]}")

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
