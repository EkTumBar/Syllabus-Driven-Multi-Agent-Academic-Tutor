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


def planner_node(state: TutorState) -> Dict[str, Any]:
    """Extracts modules from course syllabus if not already planned."""
    db: Session = state.get("db")
    course_id = state["course_id"]

    modules = crud.get_modules_by_course(db, course_id=course_id)
    if not modules:
        course = crud.get_course(db, course_id=course_id)
        syllabus_text = course.syllabus_raw if course else ""
        if syllabus_text:
            plan_syllabus(syllabus_raw=syllabus_text, course_id=course_id, db=db)
            modules = crud.get_modules_by_course(db, course_id=course_id)

    current_module_id = state.get("current_module_id")
    current_topic = state.get("current_topic")

    if modules and not current_module_id:
        current_module_id = modules[0].id
        current_topic = modules[0].title

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

    return {
        "context_text": research_result.get("context_text", ""),
        "status": "examining" if not remediate else "remediating"
    }


def examiner_node(state: TutorState) -> Dict[str, Any]:
    """Generates difficulty-calibrated assessment questions based on student mastery."""
    db: Session = state.get("db")
    user_id = state["user_id"]
    module_id = state.get("current_module_id")
    topic = state.get("current_topic") or "Module Review"
    context_text = state.get("context_text", "")

    mastery_record = None
    if module_id:
        mastery_record = crud.get_mastery_record(db, user_id=user_id, module_id=module_id, topic=topic)
    mastery_score = mastery_record.score_0to1 if mastery_record else 0.5

    questions = generate_quiz(
        topic=topic,
        context_text=context_text,
        module_id=module_id,
        mastery_score=mastery_score,
        num_questions=1,
        db=db
    )

    step_output = {
        "type": "question",
        "topic": topic,
        "mastery_score": mastery_score,
        "questions": questions
    }

    return {
        "generated_questions": questions,
        "step_output": step_output,
        "status": "idle"
    }


def evaluator_node(state: TutorState) -> Dict[str, Any]:
    """Evaluates student's submitted answer and computes remediation trigger."""
    db: Session = state.get("db")
    user_id = state["user_id"]
    module_id = state.get("current_module_id")
    topic = state.get("current_topic") or "Module Review"
    step_input = state.get("step_input", {})

    question_id = step_input.get("question_id", "")
    answer_given = step_input.get("answer_given", "")
    correct_answer = step_input.get("correct_answer", "")
    question_text = step_input.get("question_text", "")

    eval_result = evaluate_answer(
        db=db,
        user_id=user_id,
        module_id=module_id or "default_mod",
        topic=topic,
        question_id=question_id or "default_q",
        answer_given=answer_given,
        correct_answer=correct_answer,
        question_text=question_text
    )

    remediate = eval_result.get("remediate", False)
    step_output = {
        "type": "evaluation",
        "evaluation": eval_result,
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
        "last_evaluation": eval_info
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
    """
    step_input = step_input or {}
    action = step_input.get("action", "next_question")

    # 1. Load state from Postgres
    db_state = crud.get_orchestrator_state(db, user_id=user_id, course_id=course_id)
    current_module_id = db_state.current_module if db_state else None
    last_eval = db_state.last_evaluation if db_state else None
    status = db_state.status if db_state else "idle"

    # Resolve module title/topic
    current_topic = "General Overview"
    if current_module_id:
        mod = crud.get_module(db, module_id=current_module_id)
        if mod:
            current_topic = mod.title

    initial_state: TutorState = {
        "course_id": course_id,
        "user_id": user_id,
        "current_module_id": current_module_id,
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

    # 2. Execute target node based on action
    if action == "submit_answer":
        # Run evaluator node and conditional edge
        eval_out = evaluator_node(initial_state)
        initial_state.update(eval_out)
        if initial_state.get("remediate", False):
            # Also fetch remediation context
            research_out = researcher_node(initial_state)
            initial_state.update(research_out)
            remed_out = remediation_node(initial_state)
            initial_state.update(remed_out)
    else:
        # Standard question / next step generation
        plan_out = planner_node(initial_state)
        initial_state.update(plan_out)
        research_out = researcher_node(initial_state)
        initial_state.update(research_out)
        exam_out = examiner_node(initial_state)
        initial_state.update(exam_out)

    final_output = initial_state.get("step_output", {})
    new_module_id = initial_state.get("current_module_id")
    new_eval = initial_state.get("last_evaluation")
    new_status = initial_state.get("status", "idle")

    # 3. Save state to Postgres
    crud.upsert_orchestrator_state(
        db=db,
        user_id=user_id,
        course_id=course_id,
        current_module=new_module_id,
        last_evaluation=new_eval,
        status=new_status
    )

    return {
        "course_id": course_id,
        "user_id": user_id,
        "current_module_id": new_module_id,
        "status": new_status,
        "payload": final_output
    }
