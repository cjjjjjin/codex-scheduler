from app.services.codex_service import CodexService
from app.services.scheduler import TaskScheduler
from app.services.task_repository import TaskRepository
from app.services.task_service import TaskService


task_repository = TaskRepository()
codex_service = CodexService()
task_service = TaskService(task_repository, codex_service)
task_scheduler = TaskScheduler(task_repository, codex_service)
