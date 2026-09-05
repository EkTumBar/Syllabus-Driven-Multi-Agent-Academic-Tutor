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


def extract_text_from_docx(file_bytes: bytes) -> str:
    """Extracts text from DOCX byte content including paragraphs and tables."""
    import docx
    doc = docx.Document(io.BytesIO(file_bytes))
    paragraphs = [p.text.strip() for p in doc.paragraphs if p.text.strip()]
    table_rows = []
    for table in doc.tables:
        for row in table.rows:
            row_text = [cell.text.strip() for cell in row.cells if cell.text.strip()]
            if row_text:
                table_rows.append(" | ".join(row_text))
    
    combined = paragraphs + table_rows
    return "\n\n".join(combined)


def process_docx(
    file_bytes: bytes,
    course_id: str,
    filename: str,
    chunk_size: int = 200,
    chunk_overlap: int = 30
) -> List[Dict[str, Any]]:
    """Extracts text from DOCX bytes, splits into chunks, and attaches course_id metadata."""
    full_text = extract_text_from_docx(file_bytes)
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


def extract_text_from_doc(file_bytes: bytes) -> str:
    """Extracts readable text from legacy Word .doc (Word 97-2003 OLE binary format) bytes."""
    import re

    # 1. If actually a zipped DOCX file renamed as .doc
    if file_bytes.startswith(b"PK\x03\x04"):
        return extract_text_from_docx(file_bytes)

    # 2. Try parsing OLE container via olefile
    try:
        import olefile
        if olefile.isOleFile(io.BytesIO(file_bytes)):
            ole = olefile.OleFileIO(io.BytesIO(file_bytes))
            if ole.exists("WordDocument"):
                stream = ole.openstream("WordDocument").read()
                text_pieces = []
                # Extract UTF-16LE strings (common in Word 97-2003)
                utf16_matches = re.findall(rb'(?:[\x20-\x7e\n\r\t]\x00){3,}', stream)
                for m in utf16_matches:
                    try:
                        decoded = m.decode("utf-16le", errors="ignore").strip()
                        if len(decoded) > 2:
                            text_pieces.append(decoded)
                    except Exception:
                        pass

                # Also extract 8-bit text runs
                ascii_matches = re.findall(rb'[\x20-\x7e\n\r\t]{4,}', stream)
                for m in ascii_matches:
                    try:
                        decoded = m.decode("latin-1", errors="ignore").strip()
                        if len(decoded) > 3 and not decoded.startswith("Normal") and not decoded.startswith("Default"):
                            if decoded not in text_pieces:
                                text_pieces.append(decoded)
                    except Exception:
                        pass

                if text_pieces:
                    return "\n\n".join(text_pieces)
    except Exception:
        pass

    # 3. Fallback: extract printable strings from raw bytes
    utf16_matches = re.findall(rb'(?:[\x20-\x7e\n\r\t]\x00){3,}', file_bytes)
    res = [m.decode("utf-16le", errors="ignore").strip() for m in utf16_matches if len(m) > 6]
    if res:
        return "\n\n".join(res)

    ascii_matches = re.findall(rb'[\x20-\x7e\n\r\t]{5,}', file_bytes)
    res_ascii = [m.decode("latin-1", errors="ignore").strip() for m in ascii_matches if len(m) > 6]
    if res_ascii:
        return "\n\n".join(res_ascii)

    return file_bytes.decode("utf-8", errors="ignore")


def process_doc(
    file_bytes: bytes,
    course_id: str,
    filename: str,
    chunk_size: int = 200,
    chunk_overlap: int = 30
) -> List[Dict[str, Any]]:
    """Extracts text from legacy .doc bytes, splits into chunks, and attaches course_id metadata."""
    full_text = extract_text_from_doc(file_bytes)
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


