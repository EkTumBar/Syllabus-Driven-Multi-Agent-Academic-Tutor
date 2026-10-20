---
name: render-deploy
description: Guidance and workflows for managing Render services, inspecting build and deploy logs, and verifying environment variables for Syllabus-Driven-Multi-Agent-Academic-Tutor.
---

# Render Deployment & Operations

This skill outlines how to monitor, debug, and manage the `syllabus-tutor-backend` service hosted on Render.

## 1. Official Render MCP Integration
The official Render MCP server is configured at `https://mcp.render.com/mcp`.
To enable live tool interaction (service listing, deployment logs, metrics, restarts):
1. Create a Render API Key in [Render Account Settings](https://dashboard.render.com/u/settings).
2. Set the `RENDER_API_KEY` environment variable in your system or add it directly to `.agents/plugins/render/mcp_config.json` or `~/.gemini/config/mcp_config.json`:
   ```json
   {
     "mcpServers": {
       "render": {
         "serverUrl": "https://mcp.render.com/mcp",
         "headers": {
           "Authorization": "Bearer <YOUR_RENDER_API_KEY>"
         }
       }
     }
   }
   ```

## 2. Service Information
- **Service Name**: `syllabus-tutor-backend`
- **Blueprint**: `render.yaml`
- **Region**: `oregon`
- **Plan**: `free`
- **Root Dir**: `backend`
- **Build Command**: `pip install -r requirements.txt`
- **Start Command**: `python run_migrations.py && uvicorn main:app --host 0.0.0.0 --port $PORT`

## 3. Required Environment Variables on Render
Verify that the following environment variables are set in the Render Dashboard for `syllabus-tutor-backend`:
- `DATABASE_URL`: Supabase Transaction Pooler URL (`postgresql+psycopg://...:6543/postgres`)
- `GEMINI_API_KEY`: Google AI Studio Gemini API Key
- `GEMINI_MODEL`: `gemini-2.5-flash` (or `gemini-1.5-flash`)
- `JWT_SECRET`: Secret key for authentication tokens
- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_KEY`: Supabase anon or service role key
- `CORS_ORIGIN`: Frontend URL (e.g., `https://your-frontend.vercel.app` or `http://localhost:5173`)
- `ENVIRONMENT`: `production`
- `PYTHON_VERSION`: `3.11.9`
