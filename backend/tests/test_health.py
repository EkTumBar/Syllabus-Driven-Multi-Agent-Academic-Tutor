from fastapi.testclient import TestClient
import sys
import os

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from main import app

client = TestClient(app)


def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_root_endpoint():
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data.get("status") == "running"


def test_cors_preflight_vercel():
    response = client.options(
        "/health",
        headers={
            "Origin": "https://syllabus-driven-multi-agent-academi.vercel.app",
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "authorization,content-type",
        },
    )
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == "https://syllabus-driven-multi-agent-academi.vercel.app"
    assert response.headers.get("access-control-allow-credentials") == "true"
    assert "GET" in response.headers.get("access-control-allow-methods", "")

