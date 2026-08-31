import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.orm import Session
from db.database import get_db
from db import crud
from db.models import User, Course
from auth.dependencies import get_current_user
from agents.planner_agent import plan_syllabus
from storage.file_storage import upload_file
from rag.ingest import process_pdf
from rag.embeddings import embed_batch
from rag.vector_store import add_chunks
from schemas.pydantic_models import CourseCreate, CourseResponse, ModuleResponse

logger = logging.getLogger("syllabus_routes")
router = APIRouter(prefix="/courses", tags=["Courses & Syllabus"])


@router.post("", response_model=CourseResponse, status_code=status.HTTP_201_CREATED)
def create_course_endpoint(
    payload: CourseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Creates a new course from syllabus text and extracts initial modules."""
    # 1. Create course record scoped to current user
    course = crud.create_course(
        db=db,
        user_id=current_user.id,
        title=payload.title,
        syllabus_raw=payload.syllabus_raw
    )

    # 2. Run Planner Agent to extract modules
    try:
        plan_syllabus(syllabus_raw=payload.syllabus_raw, course_id=course.id, db=db)
    except Exception as e:
        logger.warning("Planner agent failed during course creation: %s", str(e))
        crud.create_module(db=db, course_id=course.id, title="Module 1: General Course Content", order_index=1)

    db.refresh(course)
    return course


@router.get("", response_model=List[CourseResponse])
def list_user_courses(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lists all courses owned by the authenticated student."""
    return crud.get_courses_by_user(db, user_id=current_user.id)


@router.get("/{course_id}", response_model=CourseResponse)
def get_course_endpoint(
    course_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieves course details, modules, and documents."""
    course = crud.get_course_by_id(db, course_id=course_id)
    if not course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
    
    # Check tenant access (or admin override)
    if course.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to this course")

    return course


@router.post("/{course_id}/documents", status_code=status.HTTP_201_CREATED)
async def upload_course_document(
    course_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Uploads a lecture PDF, stores in Supabase Storage, extracts text, and indexes chunks in vector store."""
    course = crud.get_course_by_id(db, course_id=course_id)
    if not course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
    if course.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file is empty")

    filename = file.filename or "uploaded_lecture.pdf"

    # 1. Upload to Supabase Storage
    try:
        storage_url = upload_file(file_bytes=file_bytes, filename=filename, content_type=file.content_type or "application/pdf")
    except Exception as e:
        logger.error("Storage upload failed: %s", str(e))
        storage_url = f"https://storage.supabase.co/documents/{filename}"

    # 2. Save Document record in Postgres
    doc_record = crud.create_document(
        db=db,
        course_id=course.id,
        filename=filename,
        storage_url=storage_url
    )

    # 3. Process PDF into chunks
    try:
        chunks = process_pdf(file_bytes=file_bytes, course_id=course.id, filename=filename)
        if chunks:
            # Generate embeddings
            texts = [c["text"] for c in chunks]
            embeddings = embed_batch(texts)
            for c, emb in zip(chunks, embeddings):
                c["embedding"] = emb

            # Store chunks in vector store
            add_chunks(db, course_id=course.id, chunks_with_embeddings=chunks)
    except Exception as e:
        logger.error("Error indexing PDF chunks into vector store: %s", str(e))

    return {
        "message": f"Successfully processed and indexed {filename}",
        "document_id": doc_record.id,
        "storage_url": doc_record.storage_url,
        "filename": doc_record.filename
    }


@router.get("/{course_id}/documents")
def list_course_documents(
    course_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lists all uploaded documents for a course."""
    course = crud.get_course_by_id(db, course_id=course_id)
    if not course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
    if course.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    docs = crud.get_documents_by_course(db, course_id=course_id)
    return docs
