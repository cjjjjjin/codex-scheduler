import crypto from "node:crypto";

import type Database from "better-sqlite3";

import type { ExecutionRecord, ExecutionStatus, Task } from "./types.js";

function parseTaskRow(row: Record<string, unknown> | undefined): Task | null {
  if (!row) {
    return null;
  }

  return {
    id: String(row.id),
    schedule: String(row.schedule),
    thread_id: String(row.thread_id),
    prompt: String(row.prompt),
    workspace_directory: String(row.workspace_directory),
    enabled: Boolean(row.enabled),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    next_run_at: row.next_run_at ? String(row.next_run_at) : null
  };
}

function parseExecutionRow(row: Record<string, unknown>): ExecutionRecord {
  return {
    id: Number(row.id),
    task_id: String(row.task_id),
    thread_id: String(row.thread_id),
    prompt: String(row.prompt),
    scheduled_for: String(row.scheduled_for),
    executed_at: String(row.executed_at),
    status: String(row.status) as ExecutionStatus,
    error_message: row.error_message ? String(row.error_message) : null
  };
}

type CreateTaskParams = {
  schedule: string;
  threadId: string;
  prompt: string;
  workspaceDirectory: string;
  enabled: boolean;
  createdAt: string;
  nextRunAt: string | null;
};

type UpdateTaskParams = {
  schedule: string;
  prompt: string;
  updatedAt: string;
  nextRunAt: string | null;
};

type AddExecutionParams = {
  taskId: string;
  threadId: string;
  prompt: string;
  scheduledFor: string;
  executedAt: string;
  status: ExecutionStatus;
  errorMessage: string | null;
};

export class TaskRepository {
  database: Database.Database;

  constructor(database: Database.Database) {
    this.database = database;
  }

  listTasks(): Task[] {
    const rows = this.database
      .prepare("SELECT * FROM tasks ORDER BY created_at DESC")
      .all() as Array<Record<string, unknown>>;
    return rows.map((row) => parseTaskRow(row)).filter((task): task is Task => task !== null);
  }

  getTask(taskId: string): Task | null {
    const row = this.database
      .prepare("SELECT * FROM tasks WHERE id = ?")
      .get(taskId) as Record<string, unknown> | undefined;
    return parseTaskRow(row);
  }

  createTask({ schedule, threadId, prompt, workspaceDirectory, enabled, createdAt, nextRunAt }: CreateTaskParams): Task {
    const id = crypto.randomUUID();
    this.database
      .prepare(`
        INSERT INTO tasks (
          id, schedule, thread_id, prompt, workspace_directory, enabled, created_at, updated_at, next_run_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        id,
        schedule,
        threadId,
        prompt,
        workspaceDirectory,
        enabled ? 1 : 0,
        createdAt,
        createdAt,
        nextRunAt
      );
    return this.getTask(id) as Task;
  }

  updateTask(taskId: string, { schedule, prompt, updatedAt, nextRunAt }: UpdateTaskParams): Task | null {
    this.database
      .prepare(`
        UPDATE tasks
        SET schedule = ?, prompt = ?, updated_at = ?, next_run_at = ?
        WHERE id = ?
      `)
      .run(schedule, prompt, updatedAt, nextRunAt, taskId);
    return this.getTask(taskId);
  }

  setEnabled(taskId: string, enabled: boolean, updatedAt: string, nextRunAt: string | null): Task | null {
    this.database
      .prepare(`
        UPDATE tasks
        SET enabled = ?, updated_at = ?, next_run_at = ?
        WHERE id = ?
      `)
      .run(enabled ? 1 : 0, updatedAt, nextRunAt, taskId);
    return this.getTask(taskId);
  }

  deleteTask(taskId: string): void {
    this.database.prepare("DELETE FROM tasks WHERE id = ?").run(taskId);
  }

  listDueTasks(nowIso: string): Task[] {
    const rows = this.database
      .prepare(`
        SELECT * FROM tasks
        WHERE enabled = 1
          AND next_run_at IS NOT NULL
          AND next_run_at <= ?
        ORDER BY next_run_at ASC
      `)
      .all(nowIso) as Array<Record<string, unknown>>;
    return rows.map((row) => parseTaskRow(row)).filter((task): task is Task => task !== null);
  }

  updateNextRun(taskId: string, nextRunAt: string | null, updatedAt: string): void {
    this.database
      .prepare(`
        UPDATE tasks
        SET next_run_at = ?, updated_at = ?
        WHERE id = ?
      `)
      .run(nextRunAt, updatedAt, taskId);
  }

  addExecution({ taskId, threadId, prompt, scheduledFor, executedAt, status, errorMessage }: AddExecutionParams): void {
    this.database
      .prepare(`
        INSERT INTO execution_history (
          task_id, thread_id, prompt, scheduled_for, executed_at, status, error_message
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      .run(taskId, threadId, prompt, scheduledFor, executedAt, status, errorMessage);
  }

  listExecutionHistory(taskId: string | null = null): ExecutionRecord[] {
    if (taskId) {
      const rows = this.database
        .prepare("SELECT * FROM execution_history WHERE task_id = ? ORDER BY executed_at DESC")
        .all(taskId) as Array<Record<string, unknown>>;
      return rows.map(parseExecutionRow);
    }

    const rows = this.database
      .prepare("SELECT * FROM execution_history ORDER BY executed_at DESC")
      .all() as Array<Record<string, unknown>>;
    return rows.map(parseExecutionRow);
  }
}
