# Antigravity Build Prompts — Syllabus-Driven Multi-Agent Academic Tutor

Each section below is a **standalone prompt** meant to be pasted directly into Google Antigravity, one at a time, in order.

---

## Prompt 1 — Project Scaffolding & Environment

```text
CONTEXT:
I'm building a hosted, multi-user, multi-agent academic tutor web app called
"syllabus-tutor". It has a Python FastAPI backend with 4 LLM-powered agents
orchestrated via LangGraph, a Postgres database, and a React frontend. 
It will be deployed later to Render (backend) and Vercel (frontend), so 
structure everything to be deployment-ready from the start.

TASK:
Scaffold the full project skeleton — folder structure, dependency files,
and empty/stub files — without implementing business logic yet.

TECH STACK:
- Backend: Python 3.11, FastAPI, SQLAlchemy, Alembic, LangGraph, LangChain,
  LlamaIndex, google-genai, supabase, python-jose, passlib, uvicorn
- Frontend: React (Vite), Tailwind CSS
- Local dev DB: Postgres via docker-compose (simulating Supabase)

REQUIREMENTS:
1. Create the exact folder/file structure below.
2. `backend/requirements.txt` with pinned versions for all packages above.
3. `backend/Dockerfile` — production-ready, multi-stage, runs uvicorn on $PORT.
4. `docker-compose.yml` at the repo root — spins up a local Postgres instance.
5. `frontend/` scaffolded via Vite + React, Tailwind configured.
6. `.env.example` files in both backend/ and frontend/ listing every env var
   needed (DATABASE_URL, GEMINI_API_KEY, JWT_SECRET, SUPABASE_URL, SUPABASE_KEY,
   VITE_API_URL) with placeholder values.
7. `.gitignore` covering venv, node_modules, .env, __pycache__, build artifacts.
8. Root `README.md` explaining the project.

FOLDER STRUCTURE TO CREATE:
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

ACCEPTANCE CRITERIA:
- `docker-compose up` starts Postgres and the backend without errors.
- `main.py` exposes a `GET /health` route returning `{"status": "ok"}`.
- `npm run dev` in frontend/ starts the Vite dev server with Tailwind.
```

---

## Prompt 2 — Database Models & Migrations

```text
CONTEXT:
Continuing the syllabus-tutor backend. Now build the persistence layer. 
This is a multi-tenant app: every row of user data must be scoped to a user_id.

TASK:
Implement the full Postgres schema using SQLAlchemy ORM models, wire up
the database connection, and set up Alembic.

TECH STACK:
Python, SQLAlchemy 2.x, Alembic, Postgres, Pydantic v2.

REQUIREMENTS:
1. `backend/db/models.py` — SQLAlchemy models for these tables:
   users(id, email UNIQUE, hashed_password, role, created_at)
   courses(id, user_id, title, syllabus_raw, created_at)
   modules(id, course_id, title, order_index, prerequisites_json)
   documents(id, course_id, filename, storage_url, indexed_at)
   questions(id, module_id, question_text, options_json, correct_answer, difficulty)
   attempts(id, question_id, user_id, answer_given, is_correct, timestamp)
   mastery_profile(id, user_id, module_id, topic, score_0to1, last_updated, attempts_count)
   orchestrator_state(id, course_id, user_id, current_module, last_evaluation, status, updated_at)
   admin_logs(id, admin_id, action, target_user_id, details_json, timestamp)

2. `backend/db/database.py` — SQLAlchemy engine + session factory.
3. `backend/schemas/pydantic_models.py` — Pydantic request/response models.
4. `backend/db/crud.py` — basic CRUD helper functions taking a `user_id`.
5. Set up Alembic: `alembic init` and generate the initial migration.

ACCEPTANCE CRITERIA:
- `alembic upgrade head` creates all tables with correct types and foreign keys.
- Every table with ownership has an index on it.
- CRUD tests confirm tenant isolation.
```

---

## Prompt 3 — Authentication + Role-Based Access

```text
CONTEXT:
Continuing syllabus-tutor. Database models exist. Now build backend JWT auth 
with role-based access control, AND the frontend sliding login/register UI.

TASK:
Implement signup, login, JWT issuing, and role gating.

TECH STACK:
Backend: FastAPI, python-jose, passlib[bcrypt].
Frontend: React, Tailwind CSS, Framer Motion.

BACKEND REQUIREMENTS:
1. `backend/auth/jwt_handler.py` — create/decode JWTs.
2. `backend/auth/auth_routes.py`: `POST /auth/signup` and `POST /auth/login`.
3. `backend/auth/dependencies.py`: `get_current_user` and `require_admin`.

FRONTEND REQUIREMENTS:
1. `frontend/src/auth/AuthPage.jsx` — ONE component for login/register with a sliding transition.
2. `frontend/src/auth/useAuth.js` — hook exposing auth state.
3. `frontend/src/api/client.js` — fetch/axios wrapper that attaches the JWT.

ACCEPTANCE CRITERIA:
- Backend: test signup, login, and protected route access.
- Frontend: toggling login/register slides panel, URL stays same.
```

---

## Prompt 4 — LLM Client Wrapper (Google Gemini)

```text
CONTEXT:
Continuing syllabus-tutor. Now build the single shared LLM wrapper for the agents.

TASK:
Implement backend/llm/llm_client.py as a thin wrapper around the Google Gemini API.

TECH STACK: Python, google-genai SDK.

REQUIREMENTS:
1. A `generate(prompt: str, system: str = None, json_mode: bool = False)` 
   function that calls `client.models.generate_content` (using `gemini-2.5-flash`).
2. Read `GEMINI_API_KEY` from `config.py`/env.
3. Basic retry logic on transient errors.
4. When `json_mode=True`, use `response_mime_type="application/json"` in the `GenerateContentConfig`.
5. Log token usage if possible.
6. Isolate all Gemini SDK imports to this file.

ACCEPTANCE CRITERIA:
- Test confirms `generate()` returns text.
- Test with `json_mode=True` confirms output parses via `json.loads()`.
```

---

## Prompt 5 — RAG Pipeline (Supabase Storage + pgvector)

```text
CONTEXT:
Continuing syllabus-tutor backend. Now build the RAG pipeline.

TASK:
Implement PDF ingestion, chunking, Gemini embedding, and storage in Supabase.

TECH STACK: LlamaIndex/LangChain, pypdf, supabase python client.

REQUIREMENTS:
1. `backend/storage/file_storage.py` — upload PDF to Supabase Storage bucket 
   ("documents") via the `supabase` SDK, return public URL.
2. `backend/rag/ingest.py` — extract text, chunk it, attach metadata `{course_id}`.
3. `backend/rag/embeddings.py` — embed chunks using Gemini's `text-embedding-004`.
4. `backend/rag/vector_store.py`:
   - `add_chunks(course_id, chunks_with_embeddings)` -> uses pgvector inside Postgres.
   - `query(course_id, query_text, top_k=5)` -> strictly filtered by `course_id`.

ACCEPTANCE CRITERIA:
- Test ingests PDF, embeds it, queries it, and proves tenant isolation.
```

---

## Prompt 6 — The Four Agents (Planner, Researcher, Examiner, Evaluator)

```text
CONTEXT:
Continuing syllabus-tutor backend. DB, auth, LLM client, and RAG pipeline exist. 
Now implement the four core agents.

TASK:
Implement planner_agent.py, researcher_agent.py, examiner_agent.py, evaluator_agent.py.

TECH STACK: Python, llm_client.generate(), db/crud.py, rag/vector_store.py.

REQUIREMENTS:
1. planner_agent.py — extracts ordered list of modules from syllabus via Gemini.
2. researcher_agent.py — queries vector store; adjusts retrieval for remediation.
3. examiner_agent.py — generates N difficulty-calibrated quiz questions via Gemini.
4. evaluator_agent.py — grades MC/short-answer, updates Postgres mastery_profile.

ACCEPTANCE CRITERIA:
- Unit tests for each agent utilizing a mocked `llm_client.generate`.
- Test that evaluator_agent correctly flips remediate=True after two consecutive low scores.
```

---

## Prompt 7 — LangGraph Orchestrator

```text
CONTEXT:
Continuing syllabus-tutor. Agents exist. Wire them into a LangGraph state machine.

TASK:
Implement backend/agents/orchestrator.py.

TECH STACK: LangGraph (StateGraph), db/crud.py.

REQUIREMENTS:
1. Graph state: {course_id, user_id, current_module_id, last_evaluation, status}.
2. Nodes for each agent, conditional edge for remediation.
3. Load state from Postgres before run, save state to Postgres after run.
4. Expose `run_step(course_id, user_id, step_input)`.

ACCEPTANCE CRITERIA:
- Test simulates multi-step loop loading/saving entirely from DB state.
```

---

## Prompt 8 — API Layer & Role Gating

```text
CONTEXT:
Continuing syllabus-tutor backend. Auth, agents, and orchestrator all
exist. Now expose everything as a REST API, with every route protected
appropriately by user or admin auth.

TASK:
Implement backend/api/syllabus_routes.py, quiz_routes.py, chat_routes.py,
profile_routes.py, and admin_routes.py, and register them in main.py.

TECH STACK: FastAPI routers, Depends(get_current_user) /
Depends(require_admin) from Prompt 3.

REQUIREMENTS:
1. syllabus_routes.py:
   - POST /courses — create a course from syllabus text.
   - POST /courses/{course_id}/documents — upload a PDF.
2. quiz_routes.py:
   - GET /courses/{course_id}/next-question.
   - POST /questions/{question_id}/answer.
3. chat_routes.py:
   - POST /courses/{course_id}/explain — free-form "explain this again" endpoint.
4. profile_routes.py:
   - GET /profile/{user_id}/mastery — returns current user's mastery.
5. admin_routes.py (ALL routes protected by require_admin):
   - GET /admin/users
   - GET /admin/users/{user_id}/mastery
   - DELETE /admin/courses/{course_id}
   - GET /admin/logs
   - Every admin action must write a row to admin_logs.
6. Add CORS middleware in main.py.

ACCEPTANCE CRITERIA:
- Full integration test verifies student gets 403 on /admin/* routes.
- Admin actions correctly produce admin_logs rows.
```

---

## Prompt 9 — Frontend Core App (Student Flow)

```text
CONTEXT:
Continuing syllabus-tutor. Backend API and auth screen are done. Now build
the main authenticated student experience.

TASK:
Implement the core student-facing React pages and components.

TECH STACK: React, Tailwind, React Router.

REQUIREMENTS:
1. App.jsx — route structure: `/auth`, `/`, `/course/:id`, `/progress`.
2. Home.jsx — SyllabusUpload.jsx component.
3. Course.jsx — QuizPanel.jsx and ConceptExplainer.jsx (chat panel).
4. Progress.jsx — MasteryDashboard.jsx (bar chart).
5. Handle loading and error states gracefully.

ACCEPTANCE CRITERIA:
- End-to-end UI flow from syllabus upload to quiz answering works without errors.
- Unauthenticated access to protected routes redirects to `/auth`.
```

---

## Prompt 10 — Admin Dashboard (Frontend)

```text
CONTEXT:
Continuing syllabus-tutor frontend. Student flow is done. Now build the
admin-only interface.

TASK:
Implement frontend/src/admin/AdminDashboard.jsx, UserList.jsx, and
AdminLogs.jsx.

TECH STACK: React, Tailwind, api/client.js, useAuth() hook.

REQUIREMENTS:
1. Protected `/admin` route, guarded by `role === 'admin'`.
2. UserList.jsx — table of all users, drill-down to mastery data.
3. Action to delete a course with confirmation dialog.
4. AdminLogs.jsx — paginated table of admin_logs.

ACCEPTANCE CRITERIA:
- Non-admin never sees admin UI elements.
- Admin can view user mastery and logs.
```

---

## Prompt 11 — Deployment Configuration

```text
CONTEXT:
Continuing syllabus-tutor. Finalize configuration for production deployment to 
Render (backend) and Vercel (frontend).

TASK:
Finalize deployment files and checklists.

REQUIREMENTS:
1. Confirm backend/Dockerfile runs `uvicorn main:app --host 0.0.0.0 --port $PORT`.
2. Ensure migrations run via `alembic upgrade head` as a release command.
3. frontend/vercel.json — ensure React Router SPA rewrites are configured.
4. Document required environment variables:
   - Backend: DATABASE_URL, GEMINI_API_KEY, JWT_SECRET, SUPABASE_URL, SUPABASE_KEY, CORS_ORIGIN
   - Frontend: VITE_API_URL

ACCEPTANCE CRITERIA:
- README.md has a "First Deploy Checklist".
- Document the manual DB admin promotion step clearly.
```
