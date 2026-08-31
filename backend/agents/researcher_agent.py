import logging
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from rag import vector_store

logger = logging.getLogger("researcher_agent")
logger.setLevel(logging.INFO)


def research_topic(
    db: Session,
    course_id: str,
    topic: str,
    remediate: bool = False,
    focus_areas: Optional[List[str]] = None,
    top_k: int = 5
) -> Dict[str, Any]:
    """
    Retrieves course-specific contextual excerpts for a topic via the vector store.
    Adjusts search parameters and query strategy when remediation is requested.
    """
    if not topic or not topic.strip():
        return {
            "topic": "",
            "remediate": remediate,
            "excerpts": [],
            "context_text": ""
        }

    effective_top_k = top_k + 3 if remediate else top_k

    # Construct search query with remediation adjustment if flagged
    query_parts = [topic]
    if focus_areas:
        query_parts.extend(focus_areas)

    if remediate:
        query_parts.append("foundational explanations definitions fundamentals step-by-step examples")

    search_query = " ".join(query_parts)

    logger.info("Researcher querying vector store for course_id=%s (remediate=%s): '%s'", course_id, remediate, search_query)
    excerpts = vector_store.query(
        db=db,
        course_id=course_id,
        query_text=search_query,
        top_k=effective_top_k
    )

    # Format concatenated context text for downstream agents
    context_lines = []
    for idx, item in enumerate(excerpts):
        text = item.get("text", "")
        filename = item.get("metadata", {}).get("filename", "Course Document")
        context_lines.append(f"[Excerpt {idx+1} from {filename}]:\n{text}")

    context_text = "\n\n".join(context_lines)

    return {
        "topic": topic,
        "remediate": remediate,
        "search_query": search_query,
        "excerpts": excerpts,
        "context_text": context_text
    }
