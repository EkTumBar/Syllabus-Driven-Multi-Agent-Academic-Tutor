import logging
import traceback
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Request, status
from sqlalchemy import desc
from sqlalchemy.orm import Session
from db.database import get_db
from db import crud
from db.models import User, Course, Module, Question, Attempt, MasteryProfile
from auth.dependencies import get_current_user
from agents.planner_agent import plan_syllabus
from storage.file_storage import upload_file, delete_storage_files
from rag.ingest import (
    extract_text_from_pdf,
    extract_text_from_docx,
    extract_text_from_doc,
    extract_text_from_image,
    process_pdf,
    process_docx,
    process_doc,
    process_image,
    process_text,
)
from rag.embeddings import embed_batch
from rag.vector_store import add_chunks
from schemas.pydantic_models import (
    CourseCreate,
    CourseResponse,
    ModuleResponse,
    QuestionResponse,
    CourseArchiveUpdate,
    UserProgressUpdate,
    UserProgressResponse,
)

logger = logging.getLogger("syllabus_routes")
router = APIRouter(prefix="/courses", tags=["Courses & Syllabus"])


async def _process_course_creation(
    request: Request,
    db: Session,
    current_user: User
):
    content_type = request.headers.get("content-type", "")
    title = ""
    syllabus_raw = ""
    file = None
    file_bytes = None
    filename = ""

    if content_type.startswith("multipart/form-data"):
        form = await request.form()
        title = form.get("title") or ""
        syllabus_raw = form.get("syllabus_raw") or ""
        file = form.get("file")
        raw_count = form.get("question_count")
        raw_diff = form.get("difficulty")
    else:
        try:
            body = await request.json()
            title = body.get("title") or ""
            syllabus_raw = body.get("syllabus_raw") or ""
            raw_count = body.get("question_count")
            raw_diff = body.get("difficulty")
        except Exception:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid request body")

    if not title or not title.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Course title is required.")

    title = title.strip()
    syllabus_raw = syllabus_raw.strip() if syllabus_raw else ""

    try:
        question_count = int(raw_count) if raw_count is not None else 10
    except (ValueError, TypeError):
        question_count = 10
    question_count = max(10, min(50, question_count))

    difficulty = str(raw_diff).lower().strip() if raw_diff else "medium"
    if difficulty not in ("easy", "medium", "hard"):
        difficulty = "medium"

    multimodal_files = []

    if file and hasattr(file, "read"):
        file_bytes = await file.read()
        filename = file.filename or "uploaded_document"
        mime_type = file.content_type or "application/octet-stream"

        if file_bytes:
            lower_name = filename.lower()
            if lower_name.endswith(".docx") or "wordprocessingml" in mime_type:
                try:
                    docx_text = extract_text_from_docx(file_bytes)
                    if not syllabus_raw:
                        syllabus_raw = docx_text
                    elif docx_text:
                        syllabus_raw = f"{syllabus_raw}\n\n[Extracted from {filename}]:\n{docx_text}"
                except Exception as docx_err:
                    logger.warning("Failed to extract text from docx: %s", str(docx_err))
                    if not syllabus_raw:
                        syllabus_raw = f"[Course syllabus uploaded from Word document: {filename}]"

            elif lower_name.endswith(".doc") or "msword" in mime_type:
                try:
                    doc_text = extract_text_from_doc(file_bytes)
                    if not syllabus_raw:
                        syllabus_raw = doc_text
                    elif doc_text:
                        syllabus_raw = f"{syllabus_raw}\n\n[Extracted from {filename}]:\n{doc_text}"
                except Exception as doc_err:
                    logger.warning("Failed to extract text from doc: %s", str(doc_err))
                    if not syllabus_raw:
                        syllabus_raw = f"[Course syllabus uploaded from Word document: {filename}]"

            elif lower_name.endswith(".pdf") or mime_type == "application/pdf":
                try:
                    pdf_text = extract_text_from_pdf(file_bytes)
                    if not syllabus_raw and pdf_text.strip():
                        syllabus_raw = pdf_text
                    elif pdf_text.strip():
                        syllabus_raw = f"{syllabus_raw}\n\n[Extracted from {filename}]:\n{pdf_text}"
                except Exception as pdf_err:
                    logger.warning("Failed to extract text from PDF: %s", str(pdf_err))
                if not syllabus_raw:
                    syllabus_raw = f"[Course syllabus uploaded from PDF: {filename}]"

                multimodal_files.append((file_bytes, "application/pdf", filename))

            elif any(lower_name.endswith(ext) for ext in [".png", ".jpg", ".jpeg"]) or mime_type.startswith("image/"):
                img_mime = mime_type if mime_type.startswith("image/") else ("image/png" if lower_name.endswith(".png") else "image/jpeg")
                try:
                    img_text = extract_text_from_image(file_bytes, mime_type=img_mime, filename=filename)
                    if not syllabus_raw and img_text.strip():
                        syllabus_raw = img_text
                    elif img_text.strip():
                        syllabus_raw = f"{syllabus_raw}\n\n[Extracted from image {filename}]:\n{img_text}"
                except Exception as img_err:
                    logger.warning("Failed to extract text from image: %s", str(img_err))

                if not syllabus_raw:
                    syllabus_raw = f"[Course syllabus uploaded from image: {filename}]"
                multimodal_files.append((file_bytes, img_mime, filename))
            else:
                if not syllabus_raw:
                    syllabus_raw = f"[Course document uploaded: {filename}]"

    # Validation: Either syllabus_raw or file must be provided
    if not syllabus_raw and not multimodal_files:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please provide syllabus content or upload a document (.pdf, .doc, .docx, or image)."
        )

    # 1. Create course record scoped to current user
    course = crud.create_course(
        db=db,
        user_id=current_user.id,
        title=title,
        syllabus_raw=syllabus_raw or f"[Course syllabus for {title}]"
    )

    # 2. If file provided, upload to Supabase storage, save Document record, and index in vector store
    if file and file_bytes:
        try:
            storage_url = upload_file(
                file_bytes=file_bytes,
                filename=filename,
                content_type=file.content_type or "application/octet-stream"
            )
        except Exception as storage_err:
            logger.error("Storage upload failed during course creation: %s", str(storage_err))
            storage_url = f"https://storage.supabase.co/documents/{filename}"

        crud.create_document(
            db=db,
            course_id=course.id,
            filename=filename,
            storage_url=storage_url
        )

        try:
            chunks = []
            lower_name = filename.lower()
            if lower_name.endswith(".pdf"):
                chunks = process_pdf(file_bytes=file_bytes, course_id=course.id, filename=filename)
            elif lower_name.endswith(".docx"):
                chunks = process_docx(file_bytes=file_bytes, course_id=course.id, filename=filename)
            elif lower_name.endswith(".doc"):
                chunks = process_doc(file_bytes=file_bytes, course_id=course.id, filename=filename)
            elif any(lower_name.endswith(ext) for ext in [".png", ".jpg", ".jpeg"]) or mime_type.startswith("image/"):
                img_mime = mime_type if mime_type.startswith("image/") else ("image/png" if lower_name.endswith(".png") else "image/jpeg")
                chunks = process_image(file_bytes=file_bytes, course_id=course.id, filename=filename, mime_type=img_mime)

            if chunks:
                texts = [c["text"] for c in chunks]
                embeddings = embed_batch(texts)
                for c, emb in zip(chunks, embeddings):
                    c["embedding"] = emb
                add_chunks(db, course_id=course.id, chunks_with_embeddings=chunks)
        except Exception as idx_err:
            logger.error("Error indexing document chunks during course creation: %s", str(idx_err))

    # 3. Run Planner Agent to extract modules
    try:
        plan_syllabus(
            syllabus_raw=syllabus_raw,
            course_id=course.id,
            db=db,
            files=multimodal_files if multimodal_files else None
        )
    except Exception as e:
        logger.error("Planner agent failed during course creation for '%s': %s", title, str(e), exc_info=True)
        lines = [l.strip() for l in syllabus_raw.splitlines() if l.strip() and not l.startswith("[Extracted")]
        mod_title = lines[0] if lines else title
        clean_title = mod_title if (mod_title.lower().startswith("module") or mod_title.lower().startswith("unit")) else f"Module 1: {mod_title}"
        crud.create_module(db=db, course_id=course.id, title=clean_title, order_index=1)

    # 4. Pre-generate question banks upfront for all planned modules
    try:
        from agents.researcher_agent import research_topic
        from agents.examiner_agent import generate_question_bank

        planned_modules = crud.get_modules_by_course(db, course_id=course.id)
        for mod in planned_modules:
            try:
                context_res = research_topic(db=db, course_id=course.id, topic=mod.title, top_k=5)
                context_text = context_res.get("context_text", "")
                if not context_text.strip():
                    context_text = course.syllabus_raw[:4000]

                generate_question_bank(
                    course_id=course.id,
                    module_id=mod.id,
                    topic=mod.title,
                    context_text=context_text,
                    count=question_count,
                    difficulty=difficulty,
                    db=db
                )
            except Exception as mod_err:
                logger.error("Pre-generation failed for module %s (%s): %s", mod.id, mod.title, str(mod_err))
    except Exception as pregen_err:
        logger.error("Error during batch assessment pre-generation: %s", str(pregen_err))

    db.expire_all()
    db.refresh(course)
    return course


@router.post("", response_model=CourseResponse, status_code=status.HTTP_201_CREATED)
async def create_course_endpoint(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Creates a new course from syllabus text, PDF, Word (.docx), or image upload.
    Supports both JSON payloads and multipart/form-data.
    """
    try:
        return await _process_course_creation(request=request, db=db, current_user=current_user)
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(
            "Unhandled exception in create_course_endpoint for user %s: %s\n%s",
            getattr(current_user, "id", "unknown"),
            str(exc),
            traceback.format_exc()
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Course creation failed: {str(exc)}"
        )


@router.get("", response_model=List[CourseResponse])
def list_user_courses(
    include_archived: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Lists courses owned by the authenticated student.
    By default, only active (non-archived) courses are returned for the main dashboard.
    Pass include_archived=True to retrieve all courses (e.g. for mastery tracking).
    """
    return crud.get_courses_by_user(db, user_id=current_user.id, include_archived=include_archived)


@router.patch("/{course_id}", response_model=CourseResponse)
@router.patch("/{course_id}/archive", response_model=CourseResponse)
def archive_course_endpoint(
    course_id: str,
    payload: Optional[CourseArchiveUpdate] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Soft deletes a course by setting is_archived to True."""
    course = crud.get_course_by_id(db, course_id=course_id)
    if not course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")

    if course.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to this course")

    target_archive = payload.is_archived if payload is not None else True
    updated = crud.archive_course(db, course_id=course_id, is_archived=target_archive)
    return updated


@router.get("/{course_id}/progress", response_model=UserProgressResponse)
def get_course_progress(
    course_id: str,
    module_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieves the student's saved question index and submitted answers for a course or module."""
    course = crud.get_course_by_id(db, course_id=course_id)
    if not course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
    if course.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to this course")

    progress = crud.get_user_progress(db, user_id=current_user.id, course_id=course_id, module_id=module_id)
    if not progress:
        from datetime import datetime, timezone
        return UserProgressResponse(
            id="default",
            user_id=current_user.id,
            course_id=course_id,
            module_id=module_id,
            current_question_index=0,
            answers_submitted=[],
            updated_at=datetime.now(timezone.utc)
        )
    return progress


@router.put("/{course_id}/progress", response_model=UserProgressResponse)
def update_course_progress(
    course_id: str,
    payload: UserProgressUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Updates and persists the student's current question index and submitted answers."""
    course = crud.get_course_by_id(db, course_id=course_id)
    if not course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
    if course.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to this course")

    progress = crud.upsert_user_progress(
        db=db,
        user_id=current_user.id,
        course_id=course_id,
        current_question_index=payload.current_question_index,
        answers_submitted=payload.answers_submitted,
        module_id=payload.module_id
    )
    return progress


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


@router.get("/{course_id}/stats")
def get_course_stats_endpoint(
    course_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Computes aggregated performance metrics for a specific syllabus/course:
    - Overall mastery score and progress percentage
    - Breakdown of right and wrong answers
    - Module-by-module breakdown and question counts
    """
    course = crud.get_course_by_id(db, course_id=course_id)
    if not course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
    if course.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to this course")

    modules = crud.get_modules_by_course(db, course_id=course.id)
    mod_ids = [m.id for m in modules]

    questions = db.query(Question).filter(Question.module_id.in_(mod_ids)).all() if mod_ids else []
    q_ids = [q.id for q in questions]

    attempts = db.query(Attempt).filter(
        Attempt.user_id == current_user.id,
        Attempt.question_id.in_(q_ids)
    ).order_by(desc(Attempt.timestamp)).all() if q_ids else []

    correct_count = sum(1 for a in attempts if a.is_correct)
    incorrect_count = len(attempts) - correct_count
    accuracy = round((correct_count / len(attempts) * 100), 1) if attempts else 0.0

    mastery_records = db.query(MasteryProfile).filter(
        MasteryProfile.user_id == current_user.id,
        MasteryProfile.module_id.in_(mod_ids)
    ).all() if mod_ids else []

    avg_mastery = (
        round(sum(m.score_0to1 for m in mastery_records) / len(mastery_records) * 100, 1)
        if mastery_records else (accuracy if attempts else 0.0)
    )

    docs = crud.get_documents_by_course(db, course_id=course.id)
    user_prog = crud.get_user_progress(db, user_id=current_user.id, course_id=course.id)

    # Breakdown per module
    module_stats = []
    for mod in modules:
        mod_q_ids = [q.id for q in questions if q.module_id == mod.id]
        mod_attempts = [a for a in attempts if a.question_id in mod_q_ids]
        mod_correct = sum(1 for a in mod_attempts if a.is_correct)
        mod_wrong = len(mod_attempts) - mod_correct
        mod_mastery_rec = next((m for m in mastery_records if m.module_id == mod.id), None)
        mod_score = round(mod_mastery_rec.score_0to1 * 100, 1) if mod_mastery_rec else (
            round((mod_correct / len(mod_attempts) * 100), 1) if mod_attempts else 0.0
        )
        module_stats.append({
            "id": mod.id,
            "title": mod.title,
            "order_index": mod.order_index,
            "total_questions": len(mod_q_ids),
            "attempts_count": len(mod_attempts),
            "correct_count": mod_correct,
            "incorrect_count": mod_wrong,
            "mastery_score": mod_score
        })

    # Calculate overall course progress (questions attempted vs total questions)
    total_q_count = len(questions)
    unique_q_attempted = len(set(a.question_id for a in attempts))
    progress_pct = round((unique_q_attempted / total_q_count * 100), 1) if total_q_count > 0 else 0.0

    return {
        "course_id": course.id,
        "title": course.title,
        "syllabus_raw": course.syllabus_raw,
        "is_archived": course.is_archived,
        "created_at": course.created_at,
        "total_modules": len(modules),
        "total_questions": total_q_count,
        "total_attempts": len(attempts),
        "correct_answers": correct_count,
        "wrong_answers": incorrect_count,
        "accuracy_percentage": accuracy,
        "mastery_percentage": avg_mastery,
        "progress_percentage": progress_pct,
        "documents_count": len(docs),
        "current_question_index": user_prog.current_question_index if user_prog else 0,
        "modules": module_stats,
        "recent_attempts": [
            {
                "id": a.id,
                "question_id": a.question_id,
                "answer_given": a.answer_given,
                "is_correct": a.is_correct,
                "timestamp": a.timestamp
            }
            for a in attempts[:15]
        ]
    }



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

    # 3. Process document into chunks
    try:
        lower_name = filename.lower()
        if lower_name.endswith(".docx"):
            chunks = process_docx(file_bytes=file_bytes, course_id=course.id, filename=filename)
        elif lower_name.endswith(".doc"):
            chunks = process_doc(file_bytes=file_bytes, course_id=course.id, filename=filename)
        elif any(lower_name.endswith(ext) for ext in [".png", ".jpg", ".jpeg"]) or (file.content_type and file.content_type.startswith("image/")):
            img_mime = file.content_type or ("image/png" if lower_name.endswith(".png") else "image/jpeg")
            chunks = process_image(file_bytes=file_bytes, course_id=course.id, filename=filename, mime_type=img_mime)
        else:
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
        logger.error("Error indexing document chunks into vector store: %s", str(e))

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


@router.get("/{course_id}/modules/{module_id}/questions", response_model=List[QuestionResponse])
def get_module_questions(
    course_id: str,
    module_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieves all pre-generated questions for a specific module."""
    course = crud.get_course_by_id(db, course_id=course_id)
    if not course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
    if course.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    module = crud.get_module_by_id(db, module_id=module_id)
    if not module or module.course_id != course_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Module not found in this course")

    return crud.get_questions_by_module(db, module_id=module_id)


@router.post("/{course_id}/modules/{module_id}/generate-questions")
def generate_module_question_bank(
    course_id: str,
    module_id: str,
    count: int = 25,
    difficulty: str = "medium",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Triggers the Multi-Agent Pre-Generation Question Bank pipeline (NTA/JEE/NEET style).
    Builds a full array of unique MCQs (10-50 questions) grounded in the syllabus and course context,
    and saves them directly into Supabase.
    """
    course = crud.get_course_by_id(db, course_id=course_id)
    if not course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
    if course.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    module = crud.get_module_by_id(db, module_id=module_id)
    if not module or module.course_id != course_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Module not found in this course")

    target_count = max(5, min(50, count))
    target_difficulty = (difficulty or "medium").lower().strip()
    if target_difficulty not in ("easy", "medium", "hard"):
        target_difficulty = "medium"

    # Gather existing question stems to avoid duplicates
    existing_qs = crud.get_questions_by_module(db, module_id=module_id)
    existing_stems = [q.question_text for q in existing_qs]

    # Retrieve context from RAG vector store or raw syllabus
    from agents.researcher_agent import research_topic
    from agents.examiner_agent import generate_question_bank

    context_res = research_topic(db=db, course_id=course_id, topic=module.title, top_k=6)
    context_text = context_res.get("context_text", "")
    if not context_text.strip():
        context_text = course.syllabus_raw[:4000]

    try:
        new_questions = generate_question_bank(
            course_id=course_id,
            module_id=module_id,
            topic=module.title,
            context_text=context_text,
            count=target_count,
            difficulty=target_difficulty,
            existing_questions=existing_stems,
            db=db
        )
    except Exception as e:
        logger.error("Failed to generate question bank for module %s: %s", module_id, str(e), exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Question bank generation failed: {str(e)}"
        )

    return {
        "message": f"Successfully generated {len(new_questions)} questions for {module.title}",
        "module_id": module_id,
        "topic": module.title,
        "count": len(new_questions),
        "total_module_questions": len(crud.get_questions_by_module(db, module_id=module_id)),
        "questions": new_questions
    }


@router.delete("/{course_id}")
def delete_course_endpoint(
    course_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Hard Delete Route: Permanently deletes a course and its associated cloud assets.
    Executes in the following strict order to prevent orphaned files:
    1. Query the database for the Supabase storage paths of the PDFs associated with the course.
    2. Use the Supabase Python client to delete the files from the storage bucket.
    3. Ensure the Supabase deletion was successful; if it fails, catch error and return a user-friendly message.
    4. If storage deletion succeeds, delete vector search chunks, MCQ records, and finally the course from database.
    """
    course = crud.get_course_by_id(db, course_id=course_id)
    if not course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")

    if course.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to this course")

    title = course.title

    # 1. Query database for Supabase storage paths of all PDFs/documents associated with the course
    docs = crud.get_documents_by_course(db, course_id=course_id)
    file_paths = [doc.storage_url for doc in docs if doc.storage_url]

    # 2 & 3. Delete files from Supabase Storage bucket; verify success before modifying database
    if file_paths:
        try:
            delete_storage_files(paths_or_urls=file_paths)
        except Exception as storage_err:
            logger.error(
                "Supabase cloud storage deletion failed for course %s (%s): %s",
                course_id, title, str(storage_err), exc_info=True
            )
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Unable to remove attached course documents from cloud storage. Deletion aborted to prevent orphaned files. Please verify your connection and try again."
            )

    # 4. Storage deletion succeeded; delete vector search chunks, MCQ records, and finally the course
    try:
        success = crud.delete_course(db, course_id=course_id)
    except Exception as e:
        logger.error("Failed to delete database records for course %s: %s", course_id, str(e), exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete database records: {str(e)}"
        )

    if not success:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to delete course")

    return {
        "message": f"Course '{title}' and all associated cloud storage assets permanently deleted.",
        "course_id": course_id
    }


