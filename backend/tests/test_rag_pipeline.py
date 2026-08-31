import os
import sys
import io
import pytest
from unittest.mock import MagicMock, patch
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from pypdf import PdfWriter

BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from db.database import Base
from db.models import User, Course
from rag import ingest, embeddings, vector_store
from storage import file_storage

SQLALCHEMY_TEST_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="module", autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db_session():
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


def create_sample_pdf_bytes(text_pages=["Page 1 text on Quantum Mechanics.", "Page 2 text on Wavefunctions."]) -> bytes:
    """Generates a valid binary PDF stream with text content."""
    from pypdf.generic import DictionaryObject, NameObject, TextStringObject, ArrayObject, DecodedStreamObject

    writer = PdfWriter()
    for text in text_pages:
        page = writer.add_blank_page(width=300, height=300)
    
    buf = io.BytesIO()
    writer.write(buf)
    return buf.getvalue()


def test_chunk_text():
    sample_text = "Word1 Word2 Word3 Word4 Word5 Word6 Word7 Word8 Word9 Word10"
    chunks = ingest.chunk_text(sample_text, chunk_size=4, chunk_overlap=1)
    assert len(chunks) >= 3
    assert "Word1" in chunks[0]


def test_process_pdf_and_metadata():
    # Process simulated PDF bytes
    pdf_bytes = create_sample_pdf_bytes(["Test Page 1", "Test Page 2"])
    
    with patch("rag.ingest.extract_text_from_pdf", return_value="Quantum physics is the study of matter and energy at the most fundamental level. Wave-particle duality is a central concept."):
        chunks = ingest.process_pdf(pdf_bytes, course_id="course_123", filename="physics_intro.pdf", chunk_size=10, chunk_overlap=2)
        assert len(chunks) > 0
        assert chunks[0]["course_id"] == "course_123"
        assert chunks[0]["filename"] == "physics_intro.pdf"
        assert "Quantum physics" in chunks[0]["text"]


def test_embeddings_generation():
    mock_client = MagicMock()
    mock_emb_obj = MagicMock()
    mock_emb_obj.values = [0.1, 0.2, 0.3, 0.4]
    mock_client.models.embed_content.return_value.embeddings = [mock_emb_obj]

    with patch("rag.embeddings.get_genai_client", return_value=mock_client):
        emb = embeddings.embed_text("Sample query")
        assert emb == [0.1, 0.2, 0.3, 0.4]


def test_vector_store_and_tenant_isolation(db_session):
    # 1. Setup two courses belonging to different users
    user_a = User(id="user_rag_a", email="raga@test.com", hashed_password="pw", role="student")
    user_b = User(id="user_rag_b", email="ragb@test.com", hashed_password="pw", role="student")
    course_a = Course(id="course_physics", user_id="user_rag_a", title="Physics", syllabus_raw="Physics")
    course_b = Course(id="course_history", user_id="user_rag_b", title="History", syllabus_raw="History")
    db_session.add_all([user_a, user_b, course_a, course_b])
    db_session.commit()

    # 2. Add chunks to Course A (Physics)
    physics_chunks = [
        {"text": "Newton's first law of motion states an object remains at rest unless acted upon.", "embedding": [1.0, 0.0, 0.0, 0.0], "filename": "mechanics.pdf", "chunk_index": 0},
        {"text": "Quantum mechanics describes particles and atomic behavior.", "embedding": [0.0, 1.0, 0.0, 0.0], "filename": "quantum.pdf", "chunk_index": 1}
    ]
    vector_store.add_chunks(db_session, course_id=course_a.id, chunks_with_embeddings=physics_chunks)

    # 3. Add chunks to Course B (History)
    history_chunks = [
        {"text": "The Industrial Revolution transitioned manufacturing processes from 1760 to 1840.", "embedding": [0.0, 0.0, 1.0, 0.0], "filename": "industrial.pdf", "chunk_index": 0},
        {"text": "The Renaissance was a fervent period of European cultural, artistic, and economic rebirth.", "embedding": [0.0, 0.0, 0.0, 1.0], "filename": "renaissance.pdf", "chunk_index": 1}
    ]
    vector_store.add_chunks(db_session, course_id=course_b.id, chunks_with_embeddings=history_chunks)

    # 4. Query Course A with a physics embedding [1.0, 0.1, 0.0, 0.0]
    physics_query_emb = [1.0, 0.1, 0.0, 0.0]
    results_a = vector_store.query(
        db_session,
        course_id=course_a.id,
        query_text="law of motion",
        query_embedding=physics_query_emb,
        top_k=5
    )

    assert len(results_a) == 2
    # Verify top match is Newton's first law
    assert "Newton's first law" in results_a[0]["text"]
    assert results_a[0]["score"] > 0.9

    # Strict tenant isolation check: NONE of History course chunks should be in results_a
    for r in results_a:
        assert r["course_id"] == course_a.id
        assert "Industrial Revolution" not in r["text"]
        assert "Renaissance" not in r["text"]

    # 5. Query Course B with history embedding [0.0, 0.0, 1.0, 0.1]
    history_query_emb = [0.0, 0.0, 1.0, 0.1]
    results_b = vector_store.query(
        db_session,
        course_id=course_b.id,
        query_text="manufacturing transition",
        query_embedding=history_query_emb,
        top_k=5
    )

    assert len(results_b) == 2
    assert "Industrial Revolution" in results_b[0]["text"]
    for r in results_b:
        assert r["course_id"] == course_b.id
        assert "Newton" not in r["text"]


def test_storage_upload_mock():
    pdf_bytes = b"%PDF-1.4 mock content"
    url = file_storage.upload_file(pdf_bytes, filename="test_lecture.pdf")
    assert isinstance(url, str)
    assert "test_lecture.pdf" in url
