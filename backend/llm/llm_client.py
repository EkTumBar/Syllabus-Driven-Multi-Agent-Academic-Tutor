import io
import os
import time
import logging
from typing import Optional, Any, List
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
    model: str = "gemini-3.6-flash",
    temperature: float = 0.2,
    max_retries: int = 3,
    files: Optional[List[Any]] = None
) -> str:
    """
    Generates text or JSON output using Google Gemini model via google-genai SDK.
    Supports multimodal inputs (PDFs, images, documents) via Gemini File API.

    Args:
        prompt: User prompt content.
        system: Optional system instruction.
        json_mode: If True, enforces structured JSON output mime type.
        model: Target Gemini model identifier (default: 'gemini-3.6-flash').
        temperature: Sampling temperature (default: 0.2 for deterministic academic evaluation).
        max_retries: Number of retry attempts on transient failures.
        files: Optional list of files (file objects, paths, (bytes, mime_type) tuples, or dicts).

    Returns:
        Generated text response string.
    """
    client = get_genai_client()

    config = types.GenerateContentConfig(
        system_instruction=system if system else None,
        response_mime_type="application/json" if json_mode else "text/plain",
        temperature=temperature,
    )

    # Prepare multimodal contents
    uploaded_files = []
    if files:
        for f in files:
            try:
                if hasattr(f, "uri") or hasattr(f, "name"):
                    uploaded_files.append(f)
                elif isinstance(f, tuple) and len(f) >= 2:
                    file_bytes, mime_type = f[0], f[1]
                    display_name = f[2] if len(f) > 2 else None
                    cfg = types.UploadFileConfig(mime_type=mime_type, display_name=display_name)
                    up = client.files.upload(file=io.BytesIO(file_bytes), config=cfg)
                    uploaded_files.append(up)
                elif isinstance(f, dict):
                    file_data = f.get("bytes") or f.get("file_bytes")
                    mime_type = f.get("mime_type")
                    display_name = f.get("filename") or f.get("display_name")
                    if file_data and mime_type:
                        cfg = types.UploadFileConfig(mime_type=mime_type, display_name=display_name)
                        up = client.files.upload(file=io.BytesIO(file_data), config=cfg)
                        uploaded_files.append(up)
                    elif f.get("path"):
                        cfg = types.UploadFileConfig(mime_type=mime_type, display_name=display_name)
                        up = client.files.upload(file=f["path"], config=cfg)
                        uploaded_files.append(up)
                elif isinstance(f, (str, os.PathLike)):
                    up = client.files.upload(file=f)
                    uploaded_files.append(up)
                elif isinstance(f, io.IOBase):
                    up = client.files.upload(file=f)
                    uploaded_files.append(up)
                elif isinstance(f, bytes):
                    up = client.files.upload(file=io.BytesIO(f))
                    uploaded_files.append(up)
                else:
                    uploaded_files.append(f)
            except Exception as upload_err:
                logger.warning("Failed to upload multimodal file via Gemini File API: %s", str(upload_err))

    contents: Any = [prompt, *uploaded_files] if uploaded_files else prompt

    last_exception = None

    for attempt in range(1, max_retries + 1):
        try:
            response = client.models.generate_content(
                model=model,
                contents=contents,
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
