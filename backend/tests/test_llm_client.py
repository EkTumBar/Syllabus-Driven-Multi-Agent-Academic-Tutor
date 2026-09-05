import json
import os
import sys
import pytest
from unittest.mock import MagicMock, patch

BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from llm import llm_client


class MockUsageMetadata:
    prompt_token_count = 42
    candidates_token_count = 18
    total_token_count = 60


class MockGenerateResponse:
    def __init__(self, text_content: str):
        self.text = text_content
        self.usage_metadata = MockUsageMetadata()


def test_generate_text_returns_string():
    mock_client = MagicMock()
    mock_client.models.generate_content.return_value = MockGenerateResponse("Photosynthesis is the process...")

    with patch.object(llm_client, "get_genai_client", return_value=mock_client):
        result = llm_client.generate("Explain photosynthesis", system="You are an academic tutor.")

        assert isinstance(result, str)
        assert result == "Photosynthesis is the process..."

        # Verify config passed to SDK
        args, kwargs = mock_client.models.generate_content.call_args
        assert kwargs["model"] == "gemini-3.6-flash"
        config = kwargs["config"]
        assert config.system_instruction == "You are an academic tutor."
        assert config.response_mime_type == "text/plain"


def test_generate_json_mode_parses_json():
    sample_json = {
        "modules": [
            {"id": "mod_1", "title": "Calculus Fundamentals", "topics": ["Limits", "Continuity"]},
            {"id": "mod_2", "title": "Differential Calculus", "topics": ["Derivatives", "Product Rule"]}
        ]
    }
    mock_client = MagicMock()
    mock_client.models.generate_content.return_value = MockGenerateResponse(json.dumps(sample_json))

    with patch.object(llm_client, "get_genai_client", return_value=mock_client):
        result_str = llm_client.generate(
            "Extract modules from syllabus",
            system="Output strictly valid JSON.",
            json_mode=True
        )

        # Confirm output is valid JSON
        parsed_data = json.loads(result_str)
        assert "modules" in parsed_data
        assert len(parsed_data["modules"]) == 2
        assert parsed_data["modules"][0]["title"] == "Calculus Fundamentals"

        # Verify mime type configuration
        args, kwargs = mock_client.models.generate_content.call_args
        config = kwargs["config"]
        assert config.response_mime_type == "application/json"


def test_generate_retry_logic_recovers():
    mock_client = MagicMock()
    # Fail first call, succeed on second call
    mock_client.models.generate_content.side_effect = [
        RuntimeError("Transient RateLimit / 429"),
        MockGenerateResponse("Recovered response text")
    ]

    with patch.object(llm_client, "get_genai_client", return_value=mock_client):
        with patch("time.sleep", return_value=None):  # Fast test execution without sleeping
            result = llm_client.generate("Test retry mechanism", max_retries=3)

            assert result == "Recovered response text"
            assert mock_client.models.generate_content.call_count == 2


def test_generate_max_retries_exceeded_raises():
    mock_client = MagicMock()
    mock_client.models.generate_content.side_effect = RuntimeError("Persistent API outage")

    with patch.object(llm_client, "get_genai_client", return_value=mock_client):
        with patch("time.sleep", return_value=None):
            with pytest.raises(RuntimeError) as exc_info:
                llm_client.generate("Test outage", max_retries=2)
            assert "Persistent API outage" in str(exc_info.value)
            assert mock_client.models.generate_content.call_count == 2
