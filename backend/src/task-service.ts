import { DEFAULT_WORKSPACE_DIRECTORY } from "./config.js";
import { AppError, CodexServiceError } from "./errors.js";
import { getNextRunAt, nowInAppTimezone, validateSchedule } from "./schedule-utils.js";
import type { CodexService } from "./codex-service.js";
import type { TaskRepository } from "./task-repository.js";
import type { TaskChatPayload, TaskEnabledPayload, TaskPayload } from "./types.js";

export class TaskService {
  taskRepository: TaskRepository;
  codexService: CodexService;

  constructor(taskRepository: TaskRepository, codexService: CodexService) {
    this.taskRepository = taskRepository;
    this.codexService = codexService;
  }

  listTasks() {
    return this.taskRepository.listTasks();
  }

  getTask(taskId: string) {
    const task = this.taskRepository.getTask(taskId);
    if (!task) {
      throw new AppError(404, "Task not found.");
    }
    return task;
  }

  async createTask(payload: TaskPayload) {
    validateTaskPayload(payload);

    let threadId: string;
    try {
      threadId = await this.codexService.createThread(DEFAULT_WORKSPACE_DIRECTORY);
    } catch (error) {
      const message = error instanceof CodexServiceError ? error.message : String(error);
      throw new AppError(502, `Failed to create Codex thread: ${message}`);
    }

    const now = nowInAppTimezone();
    const nextRunAt = getNextRunAt(payload.schedule, now);
    return this.taskRepository.createTask({
      schedule: payload.schedule.trim(),
      threadId,
      prompt: payload.prompt.trim(),
      workspaceDirectory: DEFAULT_WORKSPACE_DIRECTORY,
      enabled: true,
      createdAt: now.toISOString(),
      nextRunAt: nextRunAt.toISOString()
    });
  }

  updateTask(taskId: string, payload: TaskPayload) {
    validateTaskPayload(payload);
    const task = this.getTask(taskId);
    const now = nowInAppTimezone();
    const nextRunAt = task.enabled ? getNextRunAt(payload.schedule, now).toISOString() : null;
    return this.taskRepository.updateTask(taskId, {
      schedule: payload.schedule.trim(),
      prompt: payload.prompt.trim(),
      updatedAt: now.toISOString(),
      nextRunAt
    });
  }

  setEnabled(taskId: string, payload: TaskEnabledPayload) {
    if (typeof payload?.enabled !== "boolean") {
      throw new AppError(422, "enabled must be a boolean.");
    }

    const task = this.getTask(taskId);
    const now = nowInAppTimezone();
    const nextRunAt = payload.enabled ? getNextRunAt(task.schedule, now).toISOString() : null;
    return this.taskRepository.setEnabled(taskId, payload.enabled, now.toISOString(), nextRunAt);
  }

  deleteTask(taskId: string): void {
    this.getTask(taskId);
    this.taskRepository.deleteTask(taskId);
  }

  listExecutionHistory(taskId: string | null = null) {
    if (taskId) {
      this.getTask(taskId);
    }
    return this.taskRepository.listExecutionHistory(taskId);
  }

  async sendChatMessage(taskId: string, payload: TaskChatPayload) {
    const task = this.getTask(taskId);
    const message = payload?.message?.trim();

    if (!message) {
      throw new AppError(422, "message is required.");
    }

    const result = await this.codexService.sendPrompt(task.thread_id, message, task.workspace_directory);

    if (!result.success) {
      throw new AppError(502, result.errorMessage ?? "Failed to send message to Codex.");
    }

    return {
      task_id: task.id,
      thread_id: task.thread_id,
      message,
      response_text: result.responseText
    };
  }
}

function validateTaskPayload(payload: TaskPayload): void {
  if (typeof payload?.schedule !== "string" || !payload.schedule.trim()) {
    throw new AppError(422, "schedule is required.");
  }

  if (typeof payload?.prompt !== "string" || !payload.prompt.trim()) {
    throw new AppError(422, "prompt is required.");
  }

  try {
    validateSchedule(payload.schedule.trim());
  } catch (error) {
    throw new AppError(422, error instanceof Error ? error.message : "Invalid CRON schedule.");
  }
}
