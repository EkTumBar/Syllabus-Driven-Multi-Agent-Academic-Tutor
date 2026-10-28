---
name: vercel-deploy
description: Guidance and workflows for managing Vercel projects, monitoring deployments, inspecting build logs, and promoting builds for Syllabus-Driven-Multi-Agent-Academic-Tutor.
---

# Vercel Deployment & Operations

This skill outlines how to monitor, debug, and manage frontend deployments on Vercel using the Vercel Model Context Protocol (MCP) server.

## 1. Vercel MCP Server Configuration
The Vercel MCP server is configured via `vercel-mcp`:
```json
{
  "mcpServers": {
    "vercel": {
      "command": "npx",
      "args": [
        "-y",
        "--package=ajv",
        "--package=@vineethnkrishnan/vercel-mcp",
        "vercel-mcp"
      ],
      "env": {
        "VERCEL_TOKEN": "<VERCEL_ACCESS_TOKEN>",
        "VERCEL_TEAM_ID": "team_DZNbcdeNVvf4aS47lEq1AuOX"
      }
    }
  }
}
```

## 2. Project Information
- **Project Name**: `syllabus-driven-multi-agent-academic-tutor`
- **Project ID**: `prj_8mR8Nt0Cg6BYr3XvW7rzQlZkMc3d`
- **Team**: `etb3` (`team_DZNbcdeNVvf4aS47lEq1AuOX`)
- **Git Repository**: `EkTumBar/Syllabus-Driven-Multi-Agent-Academic-Tutor`
- **Production URL**: `https://syllabus-driven-multi-agent-academic-tutor-etb3.vercel.app`

## 3. Available MCP Tools
- `list_projects`: Lists all projects under the team account.
- `get_project`: Retrieves detailed configuration, build settings, and environment variables.
- `list_deployments`: Queries recent deployments, their status (`READY`, `BUILDING`, `ERROR`), and commit metadata.
- `get_deployment`: Fetches detailed status and runtime timings for a specific deployment ID.
- `get_deployment_build_logs`: Inspects build output logs (last 150 lines) to troubleshoot compile or bundling errors.
- `create_deployment`: Triggers a new deployment from a Git branch or commit SHA.
- `cancel_deployment`: Cancels a queued or building deployment.
- `promote_deployment`: Promotes a successful deployment to production.
