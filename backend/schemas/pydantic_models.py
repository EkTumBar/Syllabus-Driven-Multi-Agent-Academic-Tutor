from datetime import datetime
from typing import List, Optional, Any, Dict
from pydantic import BaseModel, EmailStr, ConfigDict, Field


# ---------------------------------------------------------
# User & Auth Schemas
# ---------------------------------------------------------
class UserBase(BaseModel):
    email: EmailStr
    role: str = "student"


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6)
    role: Optional[str] = "student"


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(UserBase):
    id: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class TokenPayload(BaseModel):
    sub: Optional[str] = None
    role: Optional[str] = None
    exp: Optional[int] = None


# ---------------------------------------------------------
# Module Schemas
# ---------------------------------------------------------
class ModuleBase(BaseModel):
    title: str
    order_index: int = 0
    prerequisites_json: Optional[List[str]] = None


class ModuleCreate(ModuleBase):
    course_id: Optional[str] = None


class ModuleResponse(ModuleBase):
    id: str
    course_id: str

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------
# Document Schemas
# ---------------------------------------------------------
class DocumentBase(BaseModel):
    filename: str
    storage_url: str


class DocumentCreate(DocumentBase):
    course_id: str


class DocumentResponse(DocumentBase):
    id: str
    course_id: str
    indexed_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------
# Course Schemas
# ---------------------------------------------------------
class CourseBase(BaseModel):
    title: str
    syllabus_raw: str


class CourseCreate(CourseBase):
    pass


class CourseResponse(CourseBase):
    id: str
    user_id: str
    created_at: datetime
    modules: List[ModuleResponse] = []
    documents: List[DocumentResponse] = []

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------
# Question & Attempt Schemas
# ---------------------------------------------------------
class QuestionBase(BaseModel):
    question_text: str
    options_json: List[str]
    correct_answer: str
    difficulty: str = "medium"


class QuestionCreate(QuestionBase):
    module_id: str


class QuestionResponse(QuestionBase):
    id: str
    module_id: str

    model_config = ConfigDict(from_attributes=True)


class AnswerSubmission(BaseModel):
    answer_given: str


class AttemptResponse(BaseModel):
    id: str
    question_id: str
    user_id: str
    answer_given: str
    is_correct: bool
    timestamp: datetime

    model_config = ConfigDict(from_attributes=True)


class EvaluationResult(BaseModel):
    is_correct: bool
    score_change: float
    feedback: str
    remediate: bool = False
    mastery_score: float = 0.0


# ---------------------------------------------------------
# Mastery Profile Schemas
# ---------------------------------------------------------
class MasteryProfileBase(BaseModel):
    topic: str
    score_0to1: float
    attempts_count: int = 0


class MasteryProfileCreate(MasteryProfileBase):
    user_id: str
    module_id: str


class MasteryProfileResponse(MasteryProfileBase):
    id: str
    user_id: str
    module_id: str
    last_updated: datetime

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------
# Orchestrator State Schemas
# ---------------------------------------------------------
class OrchestratorStateBase(BaseModel):
    current_module: Optional[str] = None
    last_evaluation: Optional[Dict[str, Any]] = None
    status: str = "idle"


class OrchestratorStateCreate(OrchestratorStateBase):
    course_id: str
    user_id: str


class OrchestratorStateResponse(OrchestratorStateBase):
    id: str
    course_id: str
    user_id: str
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------
# Admin Log Schemas
# ---------------------------------------------------------
class AdminLogBase(BaseModel):
    action: str
    target_user_id: Optional[str] = None
    details_json: Optional[Dict[str, Any]] = None


class AdminLogCreate(AdminLogBase):
    admin_id: Optional[str] = None


class AdminLogResponse(AdminLogBase):
    id: str
    admin_id: Optional[str] = None
    timestamp: datetime

    model_config = ConfigDict(from_attributes=True)
