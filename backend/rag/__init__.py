"""Retrieval-Augmented Generation (RAG) package."""
from rag.ingest import extract_text_from_pdf, chunk_text, process_pdf
from rag.embeddings import embed_text, embed_batch
from rag.vector_store import add_chunks, query, cosine_similarity

__all__ = [
    "extract_text_from_pdf",
    "chunk_text",
    "process_pdf",
    "embed_text",
    "embed_batch",
    "add_chunks",
    "query",
    "cosine_similarity"
]
