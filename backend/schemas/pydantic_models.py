from datetime import datetime
from typing import List, Optional, Any, Dict
from pydantic import BaseModel, EmailStr, ConfigDict, Field


# ---------------------------------------------------------
# User & Auth Schemas
# ---------------------------------------------------------
class UserBase(BaseModel):
    email: EmailStr
    role: str = "student"
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    username: Optional[str] = None
    phone_number: Optional[str] = None
    location: Optional[str] = None
    avatar_url: Optional[str] = None
    preferences_json: Optional[Dict[str, Any]] = None


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


class UserProfileUpdate(BaseModel):
    name: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    username: Optional[str] = None
    phone_number: Optional[str] = None
    location: Optional[str] = None
    avatar_url: Optional[str] = None
    preferences_json: Optional[Dict[str, Any]] = None


class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8)
    otp: str


class SendOtpRequest(BaseModel):
    phone_number: Optional[str] = None


class OtpResponse(BaseModel):
    message: str
    phone_masked: str
    simulated_otp: Optional[str] = None


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ForgotPasswordResponse(BaseModel):
    message: str = "If an account with that email exists, we have sent a password reset link."
    status: str = "success"


class SessionItem(BaseModel):
    id: str
    device: str
    ip: str
    location: str
    last_active: str
    is_current: bool = False


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class TokenPayload(BaseModel):
    sub: Optional[str] = None
    role: Optional[str] = None
    exp: Optional[int] = None


# ---------------------------------------------------------
# Question & Attempt Schemas
# ---------------------------------------------------------
class QuestionBase(BaseModel):
    question_text: str
    options_json: List[str]
    correct_answer: str
    difficulty: str = "medium"
    explanation: Optional[str] = None
    order_index: Optional[int] = 0


class QuestionCreate(QuestionBase):
    module_id: str


class QuestionResponse(QuestionBase):
    id: str
    module_id: str

    model_config = ConfigDict(from_attributes=True)


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
    questions: List[QuestionResponse] = []

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
    syllabus_raw: Optional[str] = ""


class CourseCreate(CourseBase):
    question_count: Optional[int] = 10
    difficulty: Optional[str] = "medium"


class CourseResponse(CourseBase):
    id: str
    user_id: str
    is_archived: bool = False
    created_at: datetime
    modules: List[ModuleResponse] = []
    documents: List[DocumentResponse] = []

    model_config = ConfigDict(from_attributes=True)


class CourseArchiveUpdate(BaseModel):
    is_archived: bool = True


class UserProgressUpdate(BaseModel):
    module_id: Optional[str] = None
    current_question_index: int = 0
    answers_submitted: Optional[List[Any]] = None


class UserProgressResponse(BaseModel):
    id: str
    user_id: str
    course_id: str
    module_id: Optional[str] = None
    current_question_index: int = 0
    answers_submitted: List[Any] = []
    updated_at: datetime

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


MasteryResponse = MasteryProfileResponse


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
