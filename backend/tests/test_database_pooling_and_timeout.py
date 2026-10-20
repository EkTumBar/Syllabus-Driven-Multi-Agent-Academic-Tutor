import pytest
from db.database import get_normalized_database_url, get_db_context, SessionLocal
from agents.orchestrator import remediation_node, TutorState
from db import crud
from db.models import User


def test_supabase_url_normalization_port_6543_and_pgbouncer():
    # 1. Direct pooler host with 5432 port
    direct_pooler = "postgresql://postgres.ref:secret@aws-0-us-east-1.pooler.supabase.com:5432/postgres"
    norm1 = get_normalized_database_url(direct_pooler)
    assert ":6543" in norm1
    assert "pgbouncer=true" in norm1
    assert norm1.startswith("postgresql+psycopg://")

    # 2. Supabase.co host with existing query parameter
    supabase_co = "postgresql://postgres:secret@db.abcxyz.supabase.co:5432/postgres?sslmode=require"
    norm2 = get_normalized_database_url(supabase_co)
    assert ":6543" in norm2
    assert "sslmode=require" in norm2
    assert "pgbouncer=true" in norm2
    assert "&pgbouncer=true" in norm2

    # 3. Already configured with 6543 and pgbouncer
    already_correct = "postgresql+psycopg://postgres.ref:secret@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
    norm3 = get_normalized_database_url(already_correct)
    assert norm3 == already_correct

    # 4. Local dev PostgreSQL should preserve port 5432
    local_pg = "postgresql+psycopg2://postgres:pass@localhost:5432/devdb"
    norm4 = get_normalized_database_url(local_pg)
    assert ":5432" in norm4
    assert "pgbouncer=true" not in norm4
    assert norm4.startswith("postgresql+psycopg://")


def test_db_context_manager_lifecycle():
    # Successful execution commits and closes
    with get_db_context() as db:
        assert db is not None
        # Should be an active session
        assert db.is_active

    # Exception inside context rolls back and re-raises
    with pytest.raises(RuntimeError, match="Simulated DB error"):
        with get_db_context() as db:
            raise RuntimeError("Simulated DB error")


def test_remediation_payload_contains_evaluation_and_last_evaluation():
    mock_eval = {
        "is_correct": False,
        "score_change": -0.15,
        "mastery_score": 0.35,
        "feedback": "Needs review of foundational concepts.",
        "remediate": True,
        "topic": "Neural Networks",
        "attempts_count": 3
    }
    mock_state: TutorState = {
        "course_id": "course-123",
        "user_id": "user-456",
        "current_topic": "Neural Networks",
        "context_text": "Sample excerpt",
        "last_evaluation": mock_eval,
        "status": "remediating"
    }

    result = remediation_node(mock_state)
    step_out = result.get("step_output", {})

    assert step_out.get("type") == "remediation"
    assert step_out.get("evaluation") == mock_eval
    assert step_out.get("last_evaluation") == mock_eval
    assert step_out.get("remediate") is True
    assert "guidance" in step_out
