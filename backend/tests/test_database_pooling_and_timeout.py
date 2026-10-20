import pytest
from db.database import get_normalized_database_url, get_db_context, SessionLocal
from agents.orchestrator import remediation_node, TutorState


def test_supabase_url_normalization_port_6543_no_pgbouncer_in_url():
    """
    Verify that get_normalized_database_url:
    - Converts port 5432 -> 6543 for Supabase hosts
    - STRIPS ?pgbouncer=true (psycopg v3 does not support it as a libpq option)
    - Returns is_pgbouncer_mode=True for Supabase connections
    - Converts postgres:// to postgresql+psycopg://
    - Preserves port 5432 and sets is_pgbouncer_mode=False for non-Supabase hosts
    """
    # 1. Supabase Transaction Pooler host with direct port 5432
    direct_pooler = "postgresql://postgres.ref:secret@aws-0-us-east-1.pooler.supabase.com:5432/postgres"
    url1, is_pooler1 = get_normalized_database_url(direct_pooler)
    assert ":6543" in url1, "Should normalize port to 6543"
    assert "pgbouncer" not in url1, "pgbouncer must NOT be in URL (psycopg v3 crashes on it)"
    assert url1.startswith("postgresql+psycopg://")
    assert is_pooler1 is True

    # 2. Supabase.co host with existing ?sslmode query parameter — pgbouncer must be stripped
    supabase_co_pgbouncer = "postgresql://postgres:secret@db.abcxyz.supabase.co:5432/postgres?pgbouncer=true&sslmode=require"
    url2, is_pooler2 = get_normalized_database_url(supabase_co_pgbouncer)
    assert ":6543" in url2
    assert "pgbouncer" not in url2, "pgbouncer must be stripped to avoid psycopg v3 crash"
    assert "sslmode=require" in url2, "Other query params must be preserved"
    assert is_pooler2 is True

    # 3. Already has port 6543 but also has ?pgbouncer=true — must be stripped
    already_6543_with_pgbouncer = "postgresql+psycopg://postgres.ref:secret@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
    url3, is_pooler3 = get_normalized_database_url(already_6543_with_pgbouncer)
    assert ":6543" in url3
    assert "pgbouncer" not in url3, "pgbouncer must be stripped even if already on port 6543"
    assert url3.startswith("postgresql+psycopg://")
    assert is_pooler3 is True

    # 4. Local dev PostgreSQL — no port change, no pgbouncer, is_pgbouncer_mode=False
    local_pg = "postgresql+psycopg2://postgres:pass@localhost:5432/devdb"
    url4, is_pooler4 = get_normalized_database_url(local_pg)
    assert ":5432" in url4
    assert "pgbouncer" not in url4
    assert url4.startswith("postgresql+psycopg://")
    assert is_pooler4 is False

    # 5. Non-Supabase port 6543 custom host — still treated as PgBouncer mode
    custom_pgbouncer = "postgresql://user:pass@my-proxy.example.com:6543/appdb"
    url5, is_pooler5 = get_normalized_database_url(custom_pgbouncer)
    assert ":6543" in url5
    assert is_pooler5 is True


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
