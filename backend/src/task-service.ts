import crypto from "node:crypto";
import path from "node:path";

import { DEFAULT_WORKSPACE_DIRECTORY } from "./config.js";
import type { CodexHistoryService } from "./codex-history-service.js";
import { AppError, CodexServiceError } from "./errors.js";
import { getNextRunAt, nowInAppTimezone, validateSchedule } from "./schedule-utils.js";
import type { CodexService } from "./codex-service.js";
import type { SkillService } from "./skill-service.js";
import type { TaskRepository } from "./task-repository.js";
import type { TaskChatPayload, TaskEnabledPayload, TaskPayload, TaskSettingsPayload } from "./types.js";

function normalizeEnvironmentVariables(value: Record<string, string> | undefined): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter((entry): entry is [string, string] => typeof entry[0] === "string" && typeof entry[1] === "string")
      .map(([key, entryValue]) => [key.trim(), entryValue])
      .filter(([key]) => key.length > 0)
  );
}

function buildTaskWorkspaceDirectory(taskId: string): string {
  return path.join(DEFAULT_WORKSPACE_DIRECTORY, taskId);
}

export class TaskService {
  taskRepository: TaskRepository;
  codexService: CodexService;
  skillService: SkillService;
  codexHistoryService: CodexHistoryService | null;

  constructor(
    taskRepository: TaskRepository,
    codexService: CodexService,
    skillService: SkillService,
    codexHistoryService: CodexHistoryService | null
  ) {
    this.taskRepository = taskRepository;
    this.codexService = codexService;
    this.skillService = skillService;
    this.codexHistoryService = codexHistoryService;
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
    const taskId = crypto.randomUUID();
    const workspaceDirectory = buildTaskWorkspaceDirectory(taskId);
    const environmentVariables = normalizeEnvironmentVariables(payload.environment_variables);

    try {
      this.skillService.ensureTaskSettingsSkillInstalled(workspaceDirectory);
    } catch (error) {
      throw new AppError(
        500,
        `Failed to install default task skill: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    let threadId: string;
    try {
      threadId = await this.codexService.createThread(workspaceDirectory, environmentVariables);
    } catch (error) {
      const message = error instanceof CodexServiceError ? error.message : String(error);
      throw new AppError(502, `Failed to create Codex thread: ${message}`);
    }

    return this.createTaskRecord(taskId, threadId, workspaceDirectory, environmentVariables, payload);
  }

  updateTask(taskId: string, payload: TaskPayload) {
    return this.updateTaskSettings(taskId, payload);
  }

  updateTaskSettings(taskId: string, payload: TaskSettingsPayload) {
    validateTaskPayload(payload);
    const task = this.getTask(taskId);
    const now = nowInAppTimezone();
    const nextRunAt = task.enabled ? getNextRunAt(payload.schedule, now).toISOString() : null;
    return this.taskRepository.updateTask(taskId, {
      schedule: payload.schedule.trim(),
      prompt: payload.prompt.trim(),
      environmentVariables: normalizeEnvironmentVariables(payload.environment_variables),
      updatedAt: now.toISOString(),
      nextRunAt
    });
  }

  private createTaskRecord(
    taskId: string,
    threadId: string,
    workspaceDirectory: string,
    environmentVariables: Record<string, string>,
    payload: TaskPayload
  ) {
    const now = nowInAppTimezone();
    const nextRunAt = getNextRunAt(payload.schedule, now);
    return this.taskRepository.createTask({
      id: taskId,
      schedule: payload.schedule.trim(),
      threadId,
      prompt: payload.prompt.trim(),
      workspaceDirectory,
      environmentVariables,
      enabled: true,
      createdAt: now.toISOString(),
      nextRunAt: nextRunAt.toISOString()
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

  async getTaskMessages(taskId: string) {
    const task = this.getTask(taskId);

    if (!this.codexHistoryService) {
      throw new AppError(503, "Codex App Server is not configured.");
    }

    return {
      task_id: task.id,
      thread_id: task.thread_id,
      messages: await this.codexHistoryService.listMessages(task.thread_id)
    };
  }

  async sendChatMessage(taskId: string, payload: TaskChatPayload) {
    const task = this.getTask(taskId);
    const message = payload?.message?.trim();

    if (!message) {
      throw new AppError(422, "message is required.");
    }

    const result = await this.codexService.sendPrompt(task.thread_id, message, task.workspace_directory, task.environment_variables);

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

function validateTaskPayload(payload: TaskPayload | TaskSettingsPayload): void {
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

  if (payload.environment_variables !== undefined) {
    if (!payload.environment_variables || typeof payload.environment_variables !== "object" || Array.isArray(payload.environment_variables)) {
      throw new AppError(422, "environment_variables must be an object.");
    }

    for (const [key, value] of Object.entries(payload.environment_variables)) {
      if (!key.trim()) {
        throw new AppError(422, "environment_variables keys must be non-empty strings.");
      }

      if (typeof value !== "string") {
        throw new AppError(422, "environment_variables values must be strings.");
      }
    }
  }
}
