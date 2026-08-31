# Syllabus-Driven Multi-Agent Academic Tutor 🎓🤖

An intelligent, multi-tenant academic tutoring web application powered by **Google Gemini 2.5**, **LangGraph**, **FastAPI**, **Postgres (with pgvector & Supabase Storage)**, and **React**.

---

## 🌟 System Architecture

```mermaid
graph TD
    A[Student / Admin React UI] -->|JWT REST API & CORS| B[FastAPI Backend]
    B -->|State Persistence & Audit Trail| C[(Supabase Postgres + pgvector)]
    B -->|Document Storage| D[(Supabase Storage Bucket)]
    
    subgraph Multi-Agent Orchestrator [LangGraph State Machine]
        E[Planner Agent] -->|Extract Modules| F[Researcher Agent]
        F -->|Context Excerpts| G[Examiner Agent]
        G -->|Adaptive Quiz| H[Evaluator Agent]
        H -->|Failures >= 2| I[Remediation Node]
        I -->|Targeted Context| G
    end

    B --> Multi-Agent Orchestrator
    Multi-Agent Orchestrator -->|Gemini 2.5 Flash & text-embedding-004| J[Google Gemini API]
```

### The Four Collaborative AI Agents:
1. **Planner Agent (`planner_agent.py`)**: Parses unstructured course syllabi and outputs ordered learning modules with prerequisites.
2. **Researcher Agent (`researcher_agent.py`)**: Performs semantic vector searches over course lecture PDFs; automatically expands query retrieval ($top\_k + 3$) when remediation is triggered.
3. **Examiner Agent (`examiner_agent.py`)**: Generates dynamically calibrated multiple-choice questions matching student mastery levels (`easy` $< 0.4$, `medium` $0.4 \dots 0.75$, `hard` $\ge 0.75$).
4. **Evaluator Agent (`evaluator_agent.py`)**: Evaluates responses, computes granular mastery scores ($\pm 0.15$), updates Postgres mastery profile, and activates adaptive remediation after consecutive errors.

---

## 📋 Required Environment Variables

### Backend Configuration (`backend/.env` or Render Dashboard)
| Variable | Description | Example |
| :--- | :--- | :--- |
| `DATABASE_URL` | Postgres connection string with async/sync driver | `postgresql://postgres.[ref]:[pwd]@aws-0-[region].pooler.supabase.com:6543/postgres` |
| `GEMINI_API_KEY` | Google Gemini API Key | `AIzaSy...` |
| `JWT_SECRET` | Secret key for signing HS256 auth tokens | `generate-a-strong-random-hex-string` |
| `SUPABASE_URL` | Supabase Project REST Endpoint URL | `https://[project-ref].supabase.co` |
| `SUPABASE_KEY` | Supabase Service Role Key or Anon Key | `eyJhbGciOi...` |
| `CORS_ORIGIN` | Allowed Frontend URL origin for CORS | `https://your-app.vercel.app` or `http://localhost:5173` |
| `PORT` | Port for ASGI Uvicorn Server | `8000` |

### Frontend Configuration (`frontend/.env` or Vercel Dashboard)
| Variable | Description | Example |
| :--- | :--- | :--- |
| `VITE_API_URL` | Base URL pointing to deployed FastAPI backend | `https://syllabus-tutor-backend.onrender.com` |

---

## 🚀 First Deploy Checklist

Follow these steps to deploy the application to production on free-tier infrastructure (**Render** + **Vercel** + **Supabase**):

### 1. Supabase Database & Storage Setup
1. Create a free project at [supabase.com](https://supabase.com).
2. Enable the **Vector** extension in Supabase:
   - Navigate to **Database** → **Extensions** → Search for `vector` → Click **Enable**.
3. Create the Document Storage Bucket:
   - Navigate to **Storage** → Click **New Bucket**.
   - Name the bucket: `documents`.
   - Toggle **Public bucket** to `ON` (or configure appropriate download policies).
4. Retrieve Connection String:
   - Navigate to **Project Settings** → **Database** → Copy the **Connection URI** (use Transaction pooler port `6543` or session port `5432`).

### 2. Backend Deployment on Render
1. Create a new **Web Service** on [render.com](https://render.com) and connect your GitHub repository.
2. Configure build settings:
   - **Root Directory**: `backend`
   - **Environment**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Pre-Deploy / Release Command**: `alembic upgrade head`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
3. Add Environment Variables:
   - `DATABASE_URL` = *(Your Supabase connection string)*
   - `GEMINI_API_KEY` = *(Your Google Gemini API Key)*
   - `JWT_SECRET` = *(Strong random 64-char string)*
   - `SUPABASE_URL` = *(Your Supabase Project URL)*
   - `SUPABASE_KEY` = *(Your Supabase Service Key)*
   - `CORS_ORIGIN` = `https://<your-vercel-app>.vercel.app` (update once frontend is deployed)
4. Click **Create Web Service**. Render will automatically run migrations (`alembic upgrade head`) and boot the FastAPI API.

### 3. Frontend Deployment on Vercel
1. Import your GitHub repository on [vercel.com](https://vercel.com).
2. Configure project settings:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
3. Add Environment Variable:
   - `VITE_API_URL` = `https://<your-render-service>.onrender.com`
4. Click **Deploy**. Vercel will build the SPA and route all requests through `vercel.json` rewrites.
5. Copy your live Vercel URL and update the `CORS_ORIGIN` environment variable in your Render backend settings.

---

## 🔑 Manual DB Admin Promotion Step

By default, any new user signing up through the UI receives the `student` role. To promote an account to platform `admin`:

1. Sign up a new user account through the application UI or via `POST /auth/signup`.
2. Open the **Supabase SQL Editor** (or connect via `psql`) and run:
   ```sql
   UPDATE users 
   SET role = 'admin' 
   WHERE email = 'your-email@university.edu';
   ```
3. Verify the role change:
   ```sql
   SELECT id, email, role, created_at FROM users WHERE email = 'your-email@university.edu';
   ```
4. Log in with that account. The user will immediately gain access to the `/admin` route, User Management table, student mastery drill-down inspector, and immutable audit logs.

---

## 💻 Local Development Quickstart

### Backend Setup
```bash
cd backend
python -m venv venv
.\venv\Scripts\activate  # On Linux/macOS: source venv/bin/activate
pip install -r requirements.txt

# Run migrations
alembic upgrade head

# Run tests
pytest backend/tests -v

# Start development server
uvicorn main:app --reload --port 8000
```

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.
