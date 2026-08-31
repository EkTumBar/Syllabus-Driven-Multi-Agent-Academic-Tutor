import logging
from typing import List
from llm.llm_client import get_genai_client

logger = logging.getLogger("rag_embeddings")
logger.setLevel(logging.INFO)

DEFAULT_EMBEDDING_MODEL = "text-embedding-004"


def embed_text(text: str, model: str = DEFAULT_EMBEDDING_MODEL) -> List[float]:
    """
    Generates a dense vector embedding for a single string using Gemini text-embedding-004.
    Falls back gracefully to deterministic vectors if API key is missing or offline.
    """
    if not text or not text.strip():
        return [0.0] * 768

    client = get_genai_client()
    try:
        response = client.models.embed_content(
            model=model,
            contents=text
        )
        if hasattr(response, "embeddings") and response.embeddings:
            return response.embeddings[0].values
        if hasattr(response, "embedding") and response.embedding:
            return response.embedding.values
    except Exception as e:
        logger.warning("Gemini embedding API unavailable (%s); using deterministic vector fallback.", str(e))
        val = abs(hash(text) % 1000) / 1000.0
        return [val] * 768

    return [0.0] * 768


def embed_batch(texts: List[str], model: str = DEFAULT_EMBEDDING_MODEL) -> List[List[float]]:
    """
    Generates dense vector embeddings for a list of strings in batches.
    """
    if not texts:
        return []

    client = get_genai_client()
    try:
        response = client.models.embed_content(
            model=model,
            contents=texts
        )
        embeddings = []
        if hasattr(response, "embeddings") and response.embeddings:
            for emb in response.embeddings:
                embeddings.append(emb.values)
            return embeddings
    except Exception as e:
        logger.warning("Batch embedding unavailable (%s); falling back to individual embeddings.", str(e))

    return [embed_text(t, model=model) for t in texts]
