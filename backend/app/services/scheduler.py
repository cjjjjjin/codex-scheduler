from __future__ import annotations

import asyncio
import logging

from app.config import SCHEDULER_POLL_SECONDS
from app.services.codex_service import CodexService
from app.services.schedule_utils import get_next_run_at, now_in_app_timezone
from app.services.task_repository import TaskRepository


logger = logging.getLogger(__name__)


class TaskScheduler:
    def __init__(self, repository: TaskRepository, codex_service: CodexService) -> None:
        self.repository = repository
        self.codex_service = codex_service
        self._task: asyncio.Task | None = None
        self._running = False

    async def start(self) -> None:
        if self._running:
            return
        self._running = True
        self._task = asyncio.create_task(self._run_loop())

    async def stop(self) -> None:
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass

    async def _run_loop(self) -> None:
        while self._running:
            await self._run_due_tasks()
            await asyncio.sleep(SCHEDULER_POLL_SECONDS)

    async def _run_due_tasks(self) -> None:
        now = now_in_app_timezone()
        due_tasks = self.repository.list_due_tasks(now)
        for task in due_tasks:
            executed_at = now_in_app_timezone()
            result = self.codex_service.send_prompt(task.session_id, task.prompt)
            self.repository.add_execution(
                task_id=task.id,
                session_id=task.session_id,
                prompt=task.prompt,
                scheduled_for=task.next_run_at or executed_at,
                executed_at=executed_at,
                status="success" if result.success else "failed",
                error_message=result.error_message,
            )

            next_run_at = get_next_run_at(task.schedule, executed_at)
            self.repository.update_next_run(task.id, next_run_at, executed_at)

            if result.success:
                logger.info("Task %s executed successfully for thread %s", task.id, task.session_id)
            else:
                logger.error(
                    "Task %s failed for thread %s: %s",
                    task.id,
                    task.session_id,
                    result.error_message,
                )
