from __future__ import annotations

from datetime import datetime
from uuid import uuid4

from app.db.database import get_connection
from app.models import ExecutionRecord, Task


def _parse_datetime(value: str | None) -> datetime | None:
    return datetime.fromisoformat(value) if value else None


def _task_from_row(row) -> Task:
    return Task(
        id=row["id"],
        schedule=row["schedule"],
        session_id=row["session_id"],
        prompt=row["prompt"],
        enabled=bool(row["enabled"]),
        created_at=datetime.fromisoformat(row["created_at"]),
        updated_at=datetime.fromisoformat(row["updated_at"]),
        next_run_at=_parse_datetime(row["next_run_at"]),
    )


def _execution_from_row(row) -> ExecutionRecord:
    return ExecutionRecord(
        id=row["id"],
        task_id=row["task_id"],
        session_id=row["session_id"],
        prompt=row["prompt"],
        scheduled_for=datetime.fromisoformat(row["scheduled_for"]),
        executed_at=datetime.fromisoformat(row["executed_at"]),
        status=row["status"],
        error_message=row["error_message"],
    )


class TaskRepository:
    def list_tasks(self) -> list[Task]:
        with get_connection() as connection:
            rows = connection.execute(
                "SELECT * FROM tasks ORDER BY created_at DESC"
            ).fetchall()
        return [_task_from_row(row) for row in rows]

    def get_task(self, task_id: str) -> Task | None:
        with get_connection() as connection:
            row = connection.execute(
                "SELECT * FROM tasks WHERE id = ?",
                (task_id,),
            ).fetchone()
        return _task_from_row(row) if row else None

    def create_task(
        self,
        schedule: str,
        session_id: str,
        prompt: str,
        enabled: bool,
        created_at: datetime,
        next_run_at: datetime | None,
    ) -> Task:
        task_id = uuid4().hex
        with get_connection() as connection:
            connection.execute(
                """
                INSERT INTO tasks (
                    id, schedule, session_id, prompt, enabled, created_at, updated_at, next_run_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    task_id,
                    schedule,
                    session_id,
                    prompt,
                    int(enabled),
                    created_at.isoformat(),
                    created_at.isoformat(),
                    next_run_at.isoformat() if next_run_at else None,
                ),
            )
        return self.get_task(task_id)  # type: ignore[return-value]

    def update_task(
        self,
        task_id: str,
        schedule: str,
        prompt: str,
        updated_at: datetime,
        next_run_at: datetime | None,
    ) -> Task | None:
        with get_connection() as connection:
            connection.execute(
                """
                UPDATE tasks
                SET schedule = ?, prompt = ?, updated_at = ?, next_run_at = ?
                WHERE id = ?
                """,
                (
                    schedule,
                    prompt,
                    updated_at.isoformat(),
                    next_run_at.isoformat() if next_run_at else None,
                    task_id,
                ),
            )
        return self.get_task(task_id)

    def set_enabled(
        self,
        task_id: str,
        enabled: bool,
        updated_at: datetime,
        next_run_at: datetime | None,
    ) -> Task | None:
        with get_connection() as connection:
            connection.execute(
                """
                UPDATE tasks
                SET enabled = ?, updated_at = ?, next_run_at = ?
                WHERE id = ?
                """,
                (
                    int(enabled),
                    updated_at.isoformat(),
                    next_run_at.isoformat() if next_run_at else None,
                    task_id,
                ),
            )
        return self.get_task(task_id)

    def delete_task(self, task_id: str) -> None:
        with get_connection() as connection:
            connection.execute("DELETE FROM tasks WHERE id = ?", (task_id,))

    def list_due_tasks(self, now: datetime) -> list[Task]:
        with get_connection() as connection:
            rows = connection.execute(
                """
                SELECT * FROM tasks
                WHERE enabled = 1
                  AND next_run_at IS NOT NULL
                  AND next_run_at <= ?
                ORDER BY next_run_at ASC
                """,
                (now.isoformat(),),
            ).fetchall()
        return [_task_from_row(row) for row in rows]

    def update_next_run(self, task_id: str, next_run_at: datetime | None, updated_at: datetime) -> None:
        with get_connection() as connection:
            connection.execute(
                """
                UPDATE tasks
                SET next_run_at = ?, updated_at = ?
                WHERE id = ?
                """,
                (
                    next_run_at.isoformat() if next_run_at else None,
                    updated_at.isoformat(),
                    task_id,
                ),
            )

    def add_execution(
        self,
        task_id: str,
        session_id: str,
        prompt: str,
        scheduled_for: datetime,
        executed_at: datetime,
        status: str,
        error_message: str | None,
    ) -> None:
        with get_connection() as connection:
            connection.execute(
                """
                INSERT INTO execution_history (
                    task_id, session_id, prompt, scheduled_for, executed_at, status, error_message
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    task_id,
                    session_id,
                    prompt,
                    scheduled_for.isoformat(),
                    executed_at.isoformat(),
                    status,
                    error_message,
                ),
            )

    def list_execution_history(self, task_id: str | None = None) -> list[ExecutionRecord]:
        query = "SELECT * FROM execution_history"
        params: tuple[str, ...] = ()
        if task_id:
            query += " WHERE task_id = ?"
            params = (task_id,)
        query += " ORDER BY executed_at DESC"
        with get_connection() as connection:
            rows = connection.execute(query, params).fetchall()
        return [_execution_from_row(row) for row in rows]

