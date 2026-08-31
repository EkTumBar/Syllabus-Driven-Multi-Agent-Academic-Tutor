import io
from typing import List, Dict, Any
from pypdf import PdfReader


def extract_text_from_pdf(file_bytes: bytes) -> str:
    """Extracts raw concatenated text from PDF byte content."""
    pdf_file = io.BytesIO(file_bytes)
    reader = PdfReader(pdf_file)
    extracted_pages = []

    for page_num, page in enumerate(reader.pages):
        page_text = page.extract_text() or ""
        if page_text.strip():
            extracted_pages.append(page_text.strip())

    return "\n\n".join(extracted_pages)


def chunk_text(
    text: str,
    chunk_size: int = 500,
    chunk_overlap: int = 50
) -> List[str]:
    """
    Splits text into overlapping chunks cleanly on word/sentence boundaries.
    """
    if not text:
        return []

    words = text.split()
    chunks = []
    current_idx = 0

    while current_idx < len(words):
        chunk_words = words[current_idx : current_idx + chunk_size]
        chunk_str = " ".join(chunk_words)
        if chunk_str.strip():
            chunks.append(chunk_str.strip())
        
        # Advance by chunk_size - chunk_overlap
        step = max(1, chunk_size - chunk_overlap)
        current_idx += step

    return chunks


def process_pdf(
    file_bytes: bytes,
    course_id: str,
    filename: str,
    chunk_size: int = 200,
    chunk_overlap: int = 30
) -> List[Dict[str, Any]]:
    """
    Extracts text from PDF bytes, splits into chunks, and attaches course_id metadata.

    Returns:
        List of dicts: [{"text": str, "course_id": str, "chunk_index": int, "filename": str}]
    """
    full_text = extract_text_from_pdf(file_bytes)
    raw_chunks = chunk_text(full_text, chunk_size=chunk_size, chunk_overlap=chunk_overlap)

    processed_chunks = []
    for i, chunk in enumerate(raw_chunks):
        processed_chunks.append({
            "text": chunk,
            "course_id": course_id,
            "chunk_index": i,
            "filename": filename
        })

    return processed_chunks
