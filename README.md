# Syllabus-Driven Multi-Agent Academic Tutor ("syllabus-tutor")

A hosted, multi-user, multi-agent academic tutoring web application.

## Overview
`syllabus-tutor` breaks down academic course syllabi into structured modules, conducts targeted retrieval-augmented generation (RAG) over lecture materials/textbooks, delivers adaptive quizzes calibrated to student mastery levels, and provides personalized remedial feedback.

## Architecture
- **Frontend**: React (Vite) + Tailwind CSS (Deployable to Vercel)
- **Backend**: Python 3.11+ FastAPI (Deployable to Render)
- **Agents**: 4 specialized agents orchestrated via LangGraph:
  1. **Planner Agent**: Parses syllabus into structured ordered modules and prerequisites.
  2. **Researcher Agent**: Retrieves module-specific context via RAG over indexed documents.
  3. **Examiner Agent**: Generates adaptive quiz questions calibrated to student mastery.
  4. **Evaluator Agent**: Evaluates student answers, updates mastery scores, and triggers remediation loops.
- **LLM & Embeddings**: Google Gemini API (`gemini-2.5-flash` & `text-embedding-004`) via `google-genai` SDK.
- **Database & Storage**: Supabase PostgreSQL with `pgvector` extension and Supabase Storage.
- **Authentication**: JWT authentication with Role-Based Access Control (Student and Admin).

## Project Structure
```text
syllabus-tutor/
├── README.md
├── docker-compose.yml
├── .gitignore
├── backend/
│   ├── main.py
│   ├── config.py
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── .env.example
│   ├── auth/
│   ├── agents/
│   ├── rag/
│   ├── llm/
│   ├── storage/
│   ├── db/
│   │   └── migrations/
│   ├── schemas/
│   ├── api/
│   └── tests/
└── frontend/
    ├── package.json
    ├── tailwind.config.js
    ├── vite.config.js
    ├── vercel.json
    ├── .env.example
    ├── index.html
    └── src/
        ├── main.jsx
        ├── App.jsx
        ├── api/
        ├── auth/
        ├── components/
        ├── admin/
        ├── pages/
        ├── hooks/
        └── styles/
```

## Quickstart

### 1. Backend Setup
```bash
cd backend
python -m venv venv
# On Windows:
.\venv\Scripts\activate
# On macOS/Linux:
# source venv/bin/activate

pip install -r requirements.txt
cp .env.example .env
uvicorn main:app --reload --port 8000
```

### 2. Frontend Setup
```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

### 3. Local Development with Docker Compose
```bash
docker-compose up --build
```
This spins up a local PostgreSQL container (`localhost:5432`) and the FastAPI backend service (`localhost:8000`).
