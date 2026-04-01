---
name: task-settings
description: Use when you need to inspect or update codex-scheduler task settings through the backend API.
---

# Task Settings

Use this skill when changing a codex-scheduler task's schedule, prompt, or enabled state.

## Workflow

1. Find the task ID from the current context or by calling GET /api/tasks.
2. Read the current task with GET /api/tasks/:taskId before changing it.
3. Update the schedule and prompt with PATCH /api/agent/tasks/:taskId/settings using only those fields.
4. Change enabled state with PATCH /api/tasks/:taskId/enabled and a body like { "enabled": true }.
5. Re-read the task to confirm the saved values.

## Rules

- Do not edit thread_id or workspace_directory.
- Keep CRON syntax valid.
- Use the backend API; do not edit the database or files directly.
- If the backend base URL is not http://localhost:8000/api, ask for the correct URL before calling it.
