from __future__ import annotations

from fastapi import APIRouter, Response

from app.models import ExecutionRecord, HealthResponse, Task, TaskCreate, TaskEnabledUpdate, TaskUpdate
from app.runtime import task_service


router = APIRouter()


@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status="ok")


@router.get("/tasks", response_model=list[Task])
def list_tasks() -> list[Task]:
    return task_service.list_tasks()


@router.get("/tasks/{task_id}", response_model=Task)
def get_task(task_id: str) -> Task:
    return task_service.get_task(task_id)


@router.post("/tasks", response_model=Task, status_code=201)
def create_task(payload: TaskCreate) -> Task:
    return task_service.create_task(payload)


@router.put("/tasks/{task_id}", response_model=Task)
def update_task(task_id: str, payload: TaskUpdate) -> Task:
    return task_service.update_task(task_id, payload)


@router.patch("/tasks/{task_id}/enabled", response_model=Task)
def set_enabled(task_id: str, payload: TaskEnabledUpdate) -> Task:
    return task_service.set_enabled(task_id, payload)


@router.delete("/tasks/{task_id}", status_code=204)
def delete_task(task_id: str) -> Response:
    task_service.delete_task(task_id)
    return Response(status_code=204)


@router.get("/executions", response_model=list[ExecutionRecord])
def list_executions(task_id: str | None = None) -> list[ExecutionRecord]:
    return task_service.list_execution_history(task_id=task_id)
