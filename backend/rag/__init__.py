"""Retrieval-Augmented Generation (RAG) package."""
from rag.ingest import (
    extract_text_from_pdf,
    extract_text_from_docx,
    extract_text_from_doc,
    extract_text_from_image,
    chunk_text,
    process_pdf,
    process_docx,
    process_doc,
    process_image,
    process_text,
)
from rag.embeddings import embed_text, embed_batch
from rag.vector_store import add_chunks, query, cosine_similarity

__all__ = [
    "extract_text_from_pdf",
    "extract_text_from_docx",
    "extract_text_from_doc",
    "extract_text_from_image",
    "chunk_text",
    "process_pdf",
    "process_docx",
    "process_doc",
    "process_image",
    "process_text",
    "embed_text",
    "embed_batch",
    "add_chunks",
    "query",
    "cosine_similarity"
]
