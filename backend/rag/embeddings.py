import logging
from typing import List
from llm.llm_client import get_genai_client

logger = logging.getLogger("rag_embeddings")
logger.setLevel(logging.INFO)

DEFAULT_EMBEDDING_MODEL = "text-embedding-004"


def embed_text(text: str, model: str = DEFAULT_EMBEDDING_MODEL) -> List[float]:
    """
    Generates a dense vector embedding for a single string using Gemini text-embedding-004.
    """
    if not text.strip():
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
        raise ValueError("Unexpected response format from Gemini embedding API")
    except Exception as e:
        logger.error("Error generating embedding: %s", str(e))
        raise e


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
        else:
            # Fallback to individual embedding if batch format differs
            return [embed_text(t, model=model) for t in texts]
    except Exception as e:
        logger.warning("Batch embedding failed; falling back to itemized embedding: %s", str(e))
        return [embed_text(t, model=model) for t in texts]
