import os
import time
import logging
from typing import Optional, Any
from google import genai
from google.genai import types
from config import settings

logger = logging.getLogger("llm_client")
logger.setLevel(logging.INFO)

# Global client cache
_client: Optional[genai.Client] = None


def get_genai_client() -> genai.Client:
    """Initializes and returns a cached google-genai Client instance."""
    global _client
    if _client is None:
        api_key = settings.GEMINI_API_KEY or os.environ.get("GEMINI_API_KEY")
        if not api_key:
            # Initialize with empty/dummy key or let SDK read default env
            logger.warning("GEMINI_API_KEY is not configured in settings or environment.")
        _client = genai.Client(api_key=api_key or "mock_key")
    return _client


def generate(
    prompt: str,
    system: Optional[str] = None,
    json_mode: bool = False,
    model: str = "gemini-3.1-pro-preview",
    temperature: float = 0.2,
    max_retries: int = 3
) -> str:
    """
    Generates text or JSON output using Google Gemini model via google-genai SDK.

    Args:
        prompt: User prompt content.
        system: Optional system instruction.
        json_mode: If True, enforces structured JSON output mime type.
        model: Target Gemini model identifier (default: 'gemini-2.5-flash').
        temperature: Sampling temperature (default: 0.2 for deterministic academic evaluation).
        max_retries: Number of retry attempts on transient failures.

    Returns:
        Generated text response string.
    """
    client = get_genai_client()

    config = types.GenerateContentConfig(
        system_instruction=system if system else None,
        response_mime_type="application/json" if json_mode else "text/plain",
        temperature=temperature,
    )

    last_exception = None

    for attempt in range(1, max_retries + 1):
        try:
            response = client.models.generate_content(
                model=model,
                contents=prompt,
                config=config
            )

            # Log token usage if provided in response metadata
            if hasattr(response, "usage_metadata") and response.usage_metadata:
                usage = response.usage_metadata
                prompt_tokens = getattr(usage, "prompt_token_count", "N/A")
                candidate_tokens = getattr(usage, "candidates_token_count", "N/A")
                total_tokens = getattr(usage, "total_token_count", "N/A")
                logger.info(
                    "Gemini API Token Usage [model=%s]: prompt=%s, candidates=%s, total=%s",
                    model, prompt_tokens, candidate_tokens, total_tokens
                )

            return response.text or ""

        except Exception as e:
            last_exception = e
            logger.warning(
                "Gemini API call attempt %d/%d failed with error: %s",
                attempt, max_retries, str(e)
            )
            if attempt < max_retries:
                backoff_seconds = 2 ** attempt
                time.sleep(backoff_seconds)

    logger.error("All %d Gemini API call attempts failed.", max_retries)
    raise last_exception
