from __future__ import annotations

from fastapi import HTTPException, status

from app.models import ExecutionRecord, Task, TaskCreate, TaskEnabledUpdate, TaskUpdate
from app.services.codex_service import CodexBridgeError, CodexService
from app.services.schedule_utils import get_next_run_at, now_in_app_timezone, validate_schedule
from app.services.task_repository import TaskRepository


class TaskService:
    def __init__(self, repository: TaskRepository, codex_service: CodexService) -> None:
        self.repository = repository
        self.codex_service = codex_service

    def list_tasks(self) -> list[Task]:
        return self.repository.list_tasks()

    def get_task(self, task_id: str) -> Task:
        task = self.repository.get_task(task_id)
        if not task:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found.")
        return task

    def create_task(self, payload: TaskCreate) -> Task:
        try:
            validate_schedule(payload.schedule)
        except ValueError as error:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)) from error

        try:
            session_id = self.codex_service.create_session()
        except CodexBridgeError as error:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Failed to create Codex thread: {error}",
            ) from error

        now = now_in_app_timezone()
        next_run_at = get_next_run_at(payload.schedule, now)
        return self.repository.create_task(
            schedule=payload.schedule,
            session_id=session_id,
            prompt=payload.prompt,
            enabled=True,
            created_at=now,
            next_run_at=next_run_at,
        )

    def update_task(self, task_id: str, payload: TaskUpdate) -> Task:
        task = self.get_task(task_id)
        try:
            validate_schedule(payload.schedule)
        except ValueError as error:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)) from error

        now = now_in_app_timezone()
        next_run_at = get_next_run_at(payload.schedule, now) if task.enabled else None
        updated = self.repository.update_task(
            task_id=task.id,
            schedule=payload.schedule,
            prompt=payload.prompt,
            updated_at=now,
            next_run_at=next_run_at,
        )
        return updated or self.get_task(task_id)

    def set_enabled(self, task_id: str, payload: TaskEnabledUpdate) -> Task:
        task = self.get_task(task_id)
        now = now_in_app_timezone()
        next_run_at = get_next_run_at(task.schedule, now) if payload.enabled else None
        updated = self.repository.set_enabled(task_id, payload.enabled, now, next_run_at)
        return updated or self.get_task(task_id)

    def delete_task(self, task_id: str) -> None:
        self.get_task(task_id)
        self.repository.delete_task(task_id)

    def list_execution_history(self, task_id: str | None = None) -> list[ExecutionRecord]:
        if task_id:
            self.get_task(task_id)
        return self.repository.list_execution_history(task_id=task_id)
