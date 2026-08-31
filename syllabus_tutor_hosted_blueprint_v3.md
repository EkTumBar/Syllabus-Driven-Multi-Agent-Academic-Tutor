# Architecture Blueprint v3: Hosted Syllabus-Driven Multi-Agent Academic Tutor

*(100% Free, Cloud-hosted, multi-user, admin-managed version)*

---

## 1. System Overview

```text
┌───────────────────────────────────────────────────────────────────┐
│                    FRONTEND (React, hosted on Vercel)               │
│   Login/Signup → Upload → Module View → Quiz Loop → Dashboard       │
│   Admin Panel (role-gated): users, courses, logs, model settings    │
└───────────────────────────┬─────────────────────────────────────────┘
                             │ HTTPS (REST/WebSocket)
┌───────────────────────────▼─────────────────────────────────────────┐
│               BACKEND (FastAPI, hosted on Render Free Tier)         │
│                                                                        │
│   Auth Layer (JWT) → Role Check (student/admin) → Orchestrator        │
│                                                                        │
│  ┌──────────┐   ┌────────────┐   ┌───────────┐   ┌─────────┐         │
│  │ Planner  │→→│ Researcher │→→│ Examiner  │→→│Evaluator│         │
│  └──────────┘   └────────────┘   └───────────┘   └─────────┘         │
│        ↑                                              │               │
│        └──────────────── feedback loop ────────────────┘               │
└───────────────────────────┬─────────────────────────────────────────┘
                             │
        ┌────────────────────┼────────────────────┬──────────────────┐
        ▼                    ▼                     ▼                  ▼
  Google Gemini API     Vector Store (Supabase   Supabase Postgres  Supabase Storage
 (Google AI Studio)     pgvector, Free Tier)        (Free Tier)       (Free Tier)
```

**Key Free-Tier Tech Stack Swaps:**

| Service Type | Tool | Why it's the best free choice |
|---|---|---|
| **LLM & Embeddings** | Google Gemini API | Google AI Studio offers a highly generous free tier for `gemini-2.5-flash` and `text-embedding-004`. |
| **Database** | Supabase PostgreSQL | Hosted servers have ephemeral disks. Supabase provides a permanent free-tier database (unlike Render's 90-day limit). |
| **Vector Store** | Supabase pgvector | `pgvector` comes pre-installed in Supabase, meaning you don't need to pay for Chroma Cloud. |
| **File Storage** | Supabase Storage | Gives you 1GB of S3-compatible cloud storage free, without requiring an AWS account or credit card. |
| **Hosting** | Render (Backend) + Vercel (Frontend) | Standard, reliable free tiers for web apps and static sites. |

---

## 2. Agent Responsibilities (unchanged logic, new plumbing)

| Agent | Input | Output | Notes |
|---|---|---|---|
| **Planner** | Parsed syllabus text | Ordered modules `{id, title, topics[], prerequisites[]}` | Calls Gemini API with structured output |
| **Researcher** | Module topic + uploaded PDFs | Relevant excerpts + citations (RAG) | Queries pgvector store scoped to `course_id` |
| **Examiner** | Excerpts + student's mastery profile | N quiz questions, difficulty-calibrated | Reads mastery from Postgres |
| **Evaluator** | Student answers + correct answers | Updated mastery scores, remediation flag | Writes to Postgres |

### How agents integrate into the hosted system

1. **Agents live inside the FastAPI backend**, not as separate services.
2. **Every agent call goes through one `llm_client.py`** — a thin wrapper around the `google-genai` SDK.
3. **Every agent is user/course-scoped**.
4. **Orchestrator state is stored in Postgres**.
5. **Agents are stateless functions**.

```python
# llm/llm_client.py — the one file every agent depends on
from google import genai
from google.genai import types
import os

client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))

def generate(prompt: str, system: str = None, json_mode: bool = False) -> str:
    config = types.GenerateContentConfig(
        system_instruction=system,
        response_mime_type="application/json" if json_mode else "text/plain",
        temperature=0.2
    )
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
        config=config
    )
    return response.text
```

---

## 3. Data Model (Postgres via Supabase)

Multi-tenant version — every table now scoped by user ownership.

```sql
users(id, email, hashed_password, role, created_at)
  -- role: 'student' | 'admin'

courses(id, user_id, title, syllabus_raw, created_at)

modules(id, course_id, title, order_index, prerequisites_json)

documents(id, course_id, filename, storage_url, indexed_at)
  -- storage_url points to Supabase Storage, not a local filepath

questions(id, module_id, question_text, options_json, correct_answer, difficulty)

attempts(id, question_id, user_id, answer_given, is_correct, timestamp)

mastery_profile(id, user_id, module_id, topic, score_0to1, last_updated, attempts_count)

orchestrator_state(id, course_id, user_id, current_module, last_evaluation, status, updated_at)

admin_logs(id, admin_id, action, target_user_id, details_json, timestamp)
```

---

## 4. Build Order (Step-by-Step)

**Phase 0 — Accounts & Environment**
1. Create free accounts: Google AI Studio (API key), Render (backend hosting), Vercel (frontend), and Supabase (Database + Storage).
2. `python -m venv venv && pip install fastapi uvicorn sqlalchemy alembic langchain langgraph llama-index google-genai supabase python-jose passlib`
3. `npm create vite@latest frontend -- --template react` then add Tailwind.

**Phase 1 — Database & Auth**
5. Define `models.py` with tables above; set up Alembic using the Supabase Connection URI.
6. Build `auth_routes.py` (JWT auth, role-gated).

**Phase 2 — File storage & RAG pipeline**
8. `file_storage.py`: upload PDFs to Supabase Storage using the python `supabase` client.
9. `ingest.py` + `embeddings.py` + `vector_store.py`: use Gemini's `text-embedding-004` and Supabase's `pgvector`.

**Phase 3 — LLM wrapper**
10. `llm_client.py`: wraps the `google-genai` SDK.

**Phase 4 — Agents & Orchestration**
11. Build Planner, Researcher, Examiner, and Evaluator agents.
12. `orchestrator.py`: LangGraph StateGraph stored in Postgres.

**Phase 5 — API & Frontend Deployment**
13. Wire FastAPI routes and React (Vite) app.
14. Deploy backend to Render, frontend to Vercel.

---

## 5. Necessary Accounts & Zero-Cost Resources

| Category | What | Cost |
|---|---|---|
| **LLM & Embeddings** | Google AI Studio (Gemini API) | $0 |
| **Backend hosting** | Render (Web Service Free Tier) | $0 |
| **Database & Vector** | Supabase (Free Tier PostgreSQL + pgvector) | $0 |
| **Frontend hosting** | Vercel (Free Tier) | $0 |
| **File storage** | Supabase Storage (1GB free) | $0 |
| **Domain** | Use default `.onrender.com` / `.vercel.app` | $0 |
