import logging
from typing import Dict, Any, List, Optional, TypedDict
from sqlalchemy.orm import Session
from langgraph.graph import StateGraph, END

from db import crud
from agents.planner_agent import plan_syllabus
from agents.researcher_agent import research_topic
from agents.examiner_agent import generate_quiz
from agents.evaluator_agent import evaluate_answer

logger = logging.getLogger("orchestrator")
logger.setLevel(logging.INFO)


class TutorState(TypedDict, total=False):
    course_id: str
    user_id: str
    current_module_id: Optional[str]
    current_topic: Optional[str]
    last_evaluation: Optional[Dict[str, Any]]
    context_text: Optional[str]
    generated_questions: Optional[List[Dict[str, Any]]]
    remediate: bool
    status: str  # 'idle' | 'planning' | 'researching' | 'examining' | 'evaluating' | 'remediating' | 'completed'
    step_input: Optional[Dict[str, Any]]
    step_output: Optional[Dict[str, Any]]
    db: Any  # Session reference


# ---------------------------------------------------------------------------
# Module advancement helper
# ---------------------------------------------------------------------------

def _resolve_next_module(
    db: Session,
    course_id: str,
    current_module_id: Optional[str],
    advance: bool = False,
    target_module_id: Optional[str] = None
) -> tuple[Optional[str], str]:
    """
    Returns (module_id, topic) for the current or next module.

    When target_module_id is provided, switches directly to that module.
    When advance=True the function moves to the module after current_module_id
    by order_index.  If the current module is the last one it wraps back to
    the first (round-robin).  This ensures the quiz always progresses and never
    silently loops on the same module.
    """
    modules = crud.get_modules_by_course(db, course_id=course_id)
    if not modules:
        return None, "General Overview"

    if target_module_id:
        target_mod = next((m for m in modules if m.id == target_module_id), None)
        if target_mod:
            return target_mod.id, target_mod.title

    if not current_module_id:
        # First call — start at the first module
        return modules[0].id, modules[0].title

    # Find the current module position
    current_idx = next(
        (i for i, m in enumerate(modules) if m.id == current_module_id), None
    )

    if not advance or current_idx is None:
        # Stay on the same module (e.g. first load or after remediation)
        mod = modules[current_idx] if current_idx is not None else modules[0]
        return mod.id, mod.title

    # Advance: move to the next module in order (wrap-around)
    next_idx = (current_idx + 1) % len(modules)
    next_mod = modules[next_idx]
    logger.info(
        "Module advancement: '%s' (idx=%d) -> '%s' (idx=%d) for course_id=%s",
        modules[current_idx].title, current_idx,
        next_mod.title, next_idx, course_id
    )
    return next_mod.id, next_mod.title


# ---------------------------------------------------------------------------
# Node implementations
# ---------------------------------------------------------------------------

def planner_node(state: TutorState) -> Dict[str, Any]:
    """Extracts modules from course syllabus if not already planned."""
    db: Session = state.get("db")
    course_id = state["course_id"]

    modules = crud.get_modules_by_course(db, course_id=course_id)
    if not modules:
        course = crud.get_course(db, course_id=course_id)
        syllabus_text = course.syllabus_raw if course else ""
        if syllabus_text:
            try:
                plan_syllabus(syllabus_raw=syllabus_text, course_id=course_id, db=db)
            except Exception as e:
                logger.error("Planner agent failed during run_step: %s", str(e), exc_info=True)
                lines = [l.strip() for l in syllabus_text.splitlines() if l.strip() and not l.startswith("[Extracted")]
                mod_title = lines[0] if lines else (course.title if course else "Course Curriculum")
                clean_title = mod_title if (mod_title.lower().startswith("module") or mod_title.lower().startswith("unit")) else f"Module 1: {mod_title}"
                crud.create_module(
                    db=db,
                    course_id=course_id,
                    title=clean_title,
                    order_index=1
                )
            modules = crud.get_modules_by_course(db, course_id=course_id)

    current_module_id = state.get("current_module_id")
    current_topic = state.get("current_topic")

    # If this is the very first question, pick the first module
    if modules and not current_module_id:
        current_module_id = modules[0].id
        current_topic = modules[0].title
        logger.info(
            "Planner starting at first module '%s' for course_id=%s",
            current_topic, course_id
        )

    return {
        "current_module_id": current_module_id,
        "current_topic": current_topic or "General Overview",
        "status": "researching"
    }


def researcher_node(state: TutorState) -> Dict[str, Any]:
    """Retrieves course context from vector store, adjusting for remediation."""
    db: Session = state.get("db")
    course_id = state["course_id"]
    topic = state.get("current_topic") or "General Overview"
    remediate = state.get("remediate", False)

    research_result = research_topic(
        db=db,
        course_id=course_id,
        topic=topic,
        remediate=remediate,
        top_k=4
    )

    context_text = research_result.get("context_text", "")
    excerpts_count = len(research_result.get("excerpts", []))

    if not context_text.strip():
        logger.warning(
            "Researcher returned EMPTY context for topic='%s', course_id=%s. "
            "Check that document_chunks are indexed for this course.",
            topic, course_id
        )
    else:
        logger.info(
            "Researcher retrieved %d chunks (%d chars) for topic='%s', course_id=%s",
            excerpts_count, len(context_text), topic, course_id
        )

    return {
        "context_text": context_text,
        "status": "examining" if not remediate else "remediating"
    }


def examiner_node(state: TutorState) -> Dict[str, Any]:
    """Retrieves or pre-generates difficulty-calibrated assessment questions based on student mastery."""
    db: Session = state.get("db")
    user_id = state["user_id"]
    course_id = state["course_id"]
    module_id = state.get("current_module_id")
    topic = state.get("current_topic") or "Module Review"
    context_text = state.get("context_text", "")

    mastery_record = None
    if module_id:
        mastery_record = crud.get_mastery_record(db, user_id=user_id, module_id=module_id, topic=topic)
    mastery_score = mastery_record.score_0to1 if mastery_record else 0.5

    # 1. First, check if questions already exist in Supabase for this module
    if module_id:
        existing_db_questions = crud.get_questions_by_module(db, module_id=module_id)
        if existing_db_questions:
            # Check user attempts to pick next unanswered question
            attempts = crud.get_attempts_by_user(db, user_id=user_id)
            answered_q_ids = set(a.question_id for a in attempts)
            unanswered = [q for q in existing_db_questions if q.id not in answered_q_ids]

            if not unanswered:
                # All questions in this module are completed!
                # Check if other modules have questions to answer
                all_modules = crud.get_modules_by_course(db, course_id=course_id)
                next_mod_with_qs = None
                for m in all_modules:
                    m_qs = crud.get_questions_by_module(db, module_id=m.id)
                    m_unanswered = [q for q in m_qs if q.id not in answered_q_ids]
                    if m_unanswered:
                        next_mod_with_qs = (m, m_unanswered, m_qs)
                        break

                if next_mod_with_qs:
                    next_m, next_unanswered, next_all_qs = next_mod_with_qs
                    chosen_q = next_unanswered[0]
                    total_q = len(next_all_qs)
                    question_idx = total_q - len(next_unanswered) + 1
                    topic = next_m.title
                    state["current_module_id"] = next_m.id
                    q_dict = {
                        "id": chosen_q.id,
                        "module_id": chosen_q.module_id,
                        "question_text": chosen_q.question_text,
                        "options_json": chosen_q.options_json,
                        "correct_answer": chosen_q.correct_answer,
                        "difficulty": chosen_q.difficulty,
                        "explanation": getattr(chosen_q, "explanation", "") or "",
                        "order_index": getattr(chosen_q, "order_index", 1) or 1
                    }
                    questions = [q_dict]
                    step_output = {
                        "type": "question",
                        "topic": topic,
                        "mastery_score": mastery_score,
                        "question_index": question_idx,
                        "total_questions": total_q,
                        "questions": questions
                    }
                    return {
                        "current_module_id": next_m.id,
                        "generated_questions": questions,
                        "step_output": step_output,
                        "status": "idle"
                    }
                else:
                    # Entire course question bank is finished!
                    step_output = {
                        "type": "completed",
                        "topic": topic,
                        "message": f"Congratulations! You have completed all questions in {topic} and the entire course.",
                        "question_index": len(existing_db_questions),
                        "total_questions": len(existing_db_questions)
                    }
                    return {
                        "generated_questions": [],
                        "step_output": step_output,
                        "status": "completed"
                    }

            chosen_q = unanswered[0]
            question_idx = len(existing_db_questions) - len(unanswered) + 1
            total_q = len(existing_db_questions)

            q_dict = {
                "id": chosen_q.id,
                "module_id": chosen_q.module_id,
                "question_text": chosen_q.question_text,
                "options_json": chosen_q.options_json,
                "correct_answer": chosen_q.correct_answer,
                "difficulty": chosen_q.difficulty,
                "explanation": getattr(chosen_q, "explanation", "") or "",
                "order_index": getattr(chosen_q, "order_index", 1) or 1
            }
            questions = [q_dict]

            step_output = {
                "type": "question",
                "topic": topic,
                "mastery_score": mastery_score,
                "question_index": question_idx,
                "total_questions": total_q,
                "questions": questions
            }
            logger.info(
                "Examiner served pre-generated question %d/%d for topic='%s' (zero-delay)",
                question_idx, total_q, topic
            )
            return {
                "generated_questions": questions,
                "step_output": step_output,
                "status": "idle"
            }

    # 2. If no questions exist in DB for this module, generate a batch of 20 MCQs and save to DB
    if db:
        try:
            db.commit()
        except Exception:
            pass

    logger.info("Generating batch question bank for module '%s' (%s)", module_id, topic)
    from agents.examiner_agent import generate_question_bank
    try:
        bank = generate_question_bank(
            course_id=course_id,
            module_id=module_id,
            topic=topic,
            context_text=context_text,
            count=20,
            db=db
        )
    except Exception as qb_err:
        logger.warning("generate_question_bank encountered error: %s. Trying fallback to generate_quiz...", str(qb_err))
        bank = generate_quiz(
            topic=topic,
            context_text=context_text,
            module_id=module_id,
            mastery_score=mastery_score,
            num_questions=20,
            db=db
        )

    # Re-fetch from DB to get the saved questions
    saved_db_qs = crud.get_questions_by_module(db, module_id=module_id) if (db and module_id) else []
    all_qs = saved_db_qs if saved_db_qs else bank

    if not all_qs:
        logger.error("Failed to generate any questions for topic='%s', module_id='%s'", topic, module_id)
        raise ValueError(f"Failed to generate questions for topic '{topic}'")

    first_q = all_qs[0]
    total_q = len(all_qs)

    q_dict = {
        "id": getattr(first_q, "id", None) or first_q.get("id"),
        "module_id": getattr(first_q, "module_id", None) or first_q.get("module_id"),
        "question_text": getattr(first_q, "question_text", None) or first_q.get("question_text"),
        "options_json": getattr(first_q, "options_json", None) or first_q.get("options_json"),
        "correct_answer": getattr(first_q, "correct_answer", None) or first_q.get("correct_answer"),
        "difficulty": getattr(first_q, "difficulty", "medium") or first_q.get("difficulty", "medium"),
        "explanation": getattr(first_q, "explanation", "") or first_q.get("explanation", ""),
        "order_index": getattr(first_q, "order_index", 1) or first_q.get("order_index", 1)
    }
    questions = [q_dict]

    step_output = {
        "type": "question",
        "topic": topic,
        "mastery_score": mastery_score,
        "question_index": 1,
        "total_questions": total_q,
        "questions": questions
    }

    logger.info(
        "Examiner initialized question bank with %d question(s) for topic='%s' (serving 1/%d)",
        total_q, topic, total_q
    )

    return {
        "generated_questions": questions,
        "step_output": step_output,
        "status": "idle"
    }


def evaluator_node(state: TutorState) -> Dict[str, Any]:
    """Evaluates student's submitted answer with fast local validation."""
    db: Session = state.get("db")
    user_id = state["user_id"]
    module_id = state.get("current_module_id")
    topic = state.get("current_topic") or "Module Review"
    step_input = state.get("step_input", {})

    question_id = step_input.get("question_id", "")
    answer_given = step_input.get("answer_given", "")
    correct_answer = step_input.get("correct_answer", "")
    question_text = step_input.get("question_text", "")

    # Look up question to get explanation for instant zero-delay feedback
    question_explanation = None
    if db and question_id:
        db_q = crud.get_question_by_id(db, question_id=question_id)
        if db_q:
            if not correct_answer:
                correct_answer = db_q.correct_answer
            if not question_text:
                question_text = db_q.question_text
            question_explanation = getattr(db_q, "explanation", None)

    eval_result = evaluate_answer(
        db=db,
        user_id=user_id,
        module_id=module_id or "default_mod",
        topic=topic,
        question_id=question_id or "default_q",
        answer_given=answer_given,
        correct_answer=correct_answer,
        question_text=question_text,
        explanation=question_explanation
    )

    remediate = eval_result.get("remediate", False)
    step_output = {
        "type": "evaluation",
        "evaluation": eval_result,
        "last_evaluation": eval_result,
        "remediate": remediate
    }

    return {
        "last_evaluation": eval_result,
        "remediate": remediate,
        "step_output": step_output,
        "status": "remediating" if remediate else "idle"
    }


def remediation_node(state: TutorState) -> Dict[str, Any]:
    """Executes remediation flow when student struggles with a concept."""
    eval_info = state.get("last_evaluation", {})
    topic = state.get("current_topic", "Current Topic")
    context_text = state.get("context_text", "")

    remediation_payload = {
        "type": "remediation",
        "topic": topic,
        "guidance": f"We noticed you encountered difficulty with {topic}. Here is a targeted review:",
        "review_excerpts": context_text,
        "evaluation": eval_info,
        "last_evaluation": eval_info,
        "remediate": True
    }

    return {
        "step_output": remediation_payload,
        "status": "idle"
    }


def route_after_evaluation(state: TutorState) -> str:
    """Conditional edge router: checks if remediation is required."""
    if state.get("remediate", False):
        return "remediation_node"
    return END


def build_tutor_graph():
    """Builds and compiles the StateGraph workflow."""
    builder = StateGraph(TutorState)

    builder.add_node("planner_node", planner_node)
    builder.add_node("researcher_node", researcher_node)
    builder.add_node("examiner_node", examiner_node)
    builder.add_node("evaluator_node", evaluator_node)
    builder.add_node("remediation_node", remediation_node)

    # Standard progression
    builder.add_edge("planner_node", "researcher_node")
    builder.add_edge("researcher_node", "examiner_node")
    builder.add_edge("examiner_node", END)

    # Conditional edge from evaluator
    builder.add_conditional_edges(
        "evaluator_node",
        route_after_evaluation,
        {
            "remediation_node": "remediation_node",
            END: END
        }
    )
    builder.add_edge("remediation_node", END)

    # Set entry point
    builder.set_entry_point("planner_node")
    return builder.compile()


# Compiled LangGraph instance
tutor_graph = build_tutor_graph()


def run_step(
    db: Session,
    course_id: str,
    user_id: str,
    step_input: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Loads state from Postgres, executes the appropriate state machine step,
    persists updated state back to Postgres, and returns the response payload.

    Session progression logic:
    - On "next_question": advance to the next module after each submission so
      the quiz cycles through all modules (round-robin by order_index).
    - On "submit_answer": stay on the current module for evaluation.
    - The current module is persisted to OrchestratorState after every step.
    """
    step_input = step_input or {}
    action = step_input.get("action", "next_question")

    # -----------------------------------------------------------------------
    # 1. Load state from Postgres
    # -----------------------------------------------------------------------
    db_state = crud.get_orchestrator_state(db, user_id=user_id, course_id=course_id)
    current_module_id = db_state.current_module if db_state else None
    last_eval = db_state.last_evaluation if db_state else None
    status = db_state.status if db_state else "idle"

    # -----------------------------------------------------------------------
    # 2. Module advancement
    # For "next_question" we advance to the next module so the session
    # progresses.  A None current_module_id means "first question ever" — we
    # pick module 0 without incrementing.
    # For "submit_answer" we stay on the same module so that evaluation and
    # remediation are anchored to the question that was just answered.
    # -----------------------------------------------------------------------
    # Advance module ONLY when all questions in the current module have been answered,
    # unless a specific target module_id was explicitly requested in step_input.
    target_module_id = step_input.get("module_id")
    should_advance = False
    if action == "next_question" and current_module_id is not None and not target_module_id:
        mod_questions = crud.get_questions_by_module(db, module_id=current_module_id)
        if mod_questions:
            user_attempts = crud.get_attempts_by_user(db, user_id=user_id)
            answered_ids = set(a.question_id for a in user_attempts)
            unanswered = [q for q in mod_questions if q.id not in answered_ids]
            if not unanswered:
                should_advance = True

    new_module_id, current_topic = _resolve_next_module(
        db=db,
        course_id=course_id,
        current_module_id=current_module_id,
        advance=should_advance,
        target_module_id=target_module_id
    )

    logger.info(
        "run_step: action='%s', prev_module='%s', resolved_module='%s' ('%s'), user_id=%s",
        action, current_module_id, new_module_id, current_topic, user_id
    )

    # -----------------------------------------------------------------------
    # 3. Build initial state
    # -----------------------------------------------------------------------
    initial_state: TutorState = {
        "course_id": course_id,
        "user_id": user_id,
        "current_module_id": new_module_id,
        "current_topic": current_topic,
        "last_evaluation": last_eval,
        "context_text": "",
        "generated_questions": [],
        "remediate": False,
        "status": status,
        "step_input": step_input,
        "step_output": {},
        "db": db
    }

    # Release initial state read transaction before running target node agent pipeline
    if db:
        try:
            db.commit()
        except Exception:
            pass

    # -----------------------------------------------------------------------
    # 4. Execute target node based on action
    # -----------------------------------------------------------------------
    if action == "submit_answer":
        # Run evaluator node and conditional edge
        eval_out = evaluator_node(initial_state)
        initial_state.update(eval_out)
        if initial_state.get("remediate", False):
            # Fetch remediation context from vector store for the current topic
            research_out = researcher_node(initial_state)
            initial_state.update(research_out)
            remed_out = remediation_node(initial_state)
            initial_state.update(remed_out)
    else:
        # Standard next-question generation: plan -> research -> examine
        plan_out = planner_node(initial_state)
        initial_state.update(plan_out)
        # Use the module resolved by planner (it may have created modules on first call)
        new_module_id = initial_state.get("current_module_id", new_module_id)
        research_out = researcher_node(initial_state)
        initial_state.update(research_out)
        exam_out = examiner_node(initial_state)
        initial_state.update(exam_out)

    final_output = initial_state.get("step_output", {})
    final_module_id = initial_state.get("current_module_id", new_module_id)
    new_eval = initial_state.get("last_evaluation")
    new_status = initial_state.get("status", "idle")

    # -----------------------------------------------------------------------
    # 5. Persist updated state (including the advanced module pointer)
    # -----------------------------------------------------------------------
    crud.upsert_orchestrator_state(
        db=db,
        user_id=user_id,
        course_id=course_id,
        current_module=final_module_id,
        last_evaluation=new_eval,
        status=new_status
    )

    logger.info(
        "run_step complete: action='%s', final_module='%s', status='%s', user_id=%s",
        action, final_module_id, new_status, user_id
    )

    return {
        "course_id": course_id,
        "user_id": user_id,
        "current_module_id": final_module_id,
        "status": new_status,
        "payload": final_output
    }
