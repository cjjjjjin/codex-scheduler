from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


ExecutionStatus = Literal["success", "failed"]


class TaskBase(BaseModel):
    schedule: str = Field(..., examples=["*/5 * * * *"])
    prompt: str = Field(..., min_length=1)


class TaskCreate(TaskBase):
    pass


class TaskUpdate(TaskBase):
    pass


class TaskEnabledUpdate(BaseModel):
    enabled: bool


class Task(TaskBase):
    id: str
    session_id: str
    enabled: bool
    created_at: datetime
    updated_at: datetime
    next_run_at: datetime | None = None


class ExecutionRecord(BaseModel):
    id: int
    task_id: str
    session_id: str
    prompt: str
    scheduled_for: datetime
    executed_at: datetime
    status: ExecutionStatus
    error_message: str | None = None


class HealthResponse(BaseModel):
    status: str

