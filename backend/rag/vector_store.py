import math
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from db.models import DocumentChunk
from rag.embeddings import embed_text


def cosine_similarity(vec_a: List[float], vec_b: List[float]) -> float:
    """Computes cosine similarity between two float vectors."""
    if not vec_a or not vec_b or len(vec_a) != len(vec_b):
        return 0.0

    dot_product = sum(a * b for a, b in zip(vec_a, vec_b))
    norm_a = math.sqrt(sum(a * a for a in vec_a))
    norm_b = math.sqrt(sum(b * b for b in vec_b))

    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0

    return dot_product / (norm_a * norm_b)


def add_chunks(
    db: Session,
    course_id: str,
    chunks_with_embeddings: List[Dict[str, Any]]
) -> List[DocumentChunk]:
    """
    Stores document chunks and their dense embeddings scoped to a course_id.

    Args:
        db: SQLAlchemy DB session.
        course_id: Course identifier for tenant scoping.
        chunks_with_embeddings: List of dicts containing 'text' (or 'content'), 'embedding', and optional metadata.

    Returns:
        List of created DocumentChunk instances.
    """
    created_records = []
    for item in chunks_with_embeddings:
        content = item.get("text") or item.get("content") or ""
        embedding = item.get("embedding", [])
        metadata = {
            "filename": item.get("filename", ""),
            "chunk_index": item.get("chunk_index", 0),
            **item.get("metadata", {})
        }

        chunk_record = DocumentChunk(
            course_id=course_id,
            content=content,
            embedding_json=embedding,
            metadata_json=metadata
        )
        db.add(chunk_record)
        created_records.append(chunk_record)

    db.commit()
    for record in created_records:
        db.refresh(record)
    return created_records


def query(
    db: Session,
    course_id: str,
    query_text: str,
    top_k: int = 5,
    query_embedding: Optional[List[float]] = None
) -> List[Dict[str, Any]]:
    """
    Searches the vector store for the top-k most relevant chunks strictly filtered by course_id.

    Args:
        db: SQLAlchemy DB session.
        course_id: Course identifier to enforce tenant isolation.
        query_text: Natural language search query.
        top_k: Number of highest ranking results to retrieve.
        query_embedding: Optional precomputed query embedding vector.

    Returns:
        List of dicts: [{"id": str, "text": str, "score": float, "metadata": dict, "course_id": str}]
    """
    if query_embedding is None:
        query_embedding = embed_text(query_text)

    # Strictly filter by course_id to guarantee tenant isolation
    chunks = db.query(DocumentChunk).filter(DocumentChunk.course_id == course_id).all()

    if not chunks:
        return []

    scored_chunks = []
    for chunk in chunks:
        chunk_emb = chunk.embedding_json or []
        sim = cosine_similarity(query_embedding, chunk_emb)
        scored_chunks.append({
            "id": chunk.id,
            "text": chunk.content,
            "score": round(float(sim), 4),
            "metadata": chunk.metadata_json or {},
            "course_id": chunk.course_id
        })

    # Sort descending by cosine similarity
    scored_chunks.sort(key=lambda x: x["score"], reverse=True)

    return scored_chunks[:top_k]
