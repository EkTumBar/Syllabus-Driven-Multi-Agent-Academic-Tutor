from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from config import settings
from auth.auth_routes import router as auth_router
from api.syllabus_routes import router as syllabus_router
from api.quiz_routes import router as quiz_router
from api.chat_routes import router as chat_router
from api.profile_routes import router as profile_router
from api.admin_routes import router as admin_router

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Backend API for Syllabus-Driven Multi-Agent Academic Tutor"
)

# CORS Middleware setup
origins = [
    settings.CORS_ORIGIN,
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "*"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API routers
app.include_router(auth_router, prefix="/auth", tags=["Authentication"])
app.include_router(syllabus_router)
app.include_router(quiz_router)
app.include_router(chat_router)
app.include_router(profile_router)
app.include_router(admin_router)


@app.get("/health", tags=["Health"])
def health_check():
    return {"status": "ok"}


@app.get("/", tags=["Root"])
def root():
    return {
        "name": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "status": "running"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=settings.PORT, reload=True)
