import fs from "node:fs";

import Database from "better-sqlite3";

import { DATA_DIR, DB_PATH, DEFAULT_WORKSPACE_DIRECTORY } from "./config.js";

const TASKS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  schedule TEXT NOT NULL CHECK (length(trim(schedule)) > 0),
  thread_id TEXT NOT NULL CHECK (length(trim(thread_id)) > 0),
  prompt TEXT NOT NULL CHECK (length(trim(prompt)) > 0),
  workspace_directory TEXT NOT NULL CHECK (length(trim(workspace_directory)) > 0),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  next_run_at TEXT
)
`;

const EXECUTION_HISTORY_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS execution_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id TEXT NOT NULL,
  thread_id TEXT NOT NULL CHECK (length(trim(thread_id)) > 0),
  prompt TEXT NOT NULL CHECK (length(trim(prompt)) > 0),
  scheduled_for TEXT NOT NULL,
  executed_at TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'failed')),
  error_message TEXT,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
)
`;

function tableExists(database: Database.Database, tableName: string): boolean {
  const row = database
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(tableName);
  return Boolean(row);
}

function getColumnNames(database: Database.Database, tableName: string): Set<string> {
  const rows = database.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
  return new Set(rows.map((row) => row.name));
}

function recreateTasksTable(database: Database.Database): void {
  const columns = getColumnNames(database, "tasks");
  const threadColumn = columns.has("thread_id") ? "thread_id" : "session_id";
  const usesWorkspaceColumn = columns.has("workspace_directory");

  database.exec(TASKS_TABLE_SQL.replace("tasks", "tasks_new"));
  const insert = database.prepare(`
    INSERT INTO tasks_new (
      id, schedule, thread_id, prompt, workspace_directory, enabled, created_at, updated_at, next_run_at
    )
    SELECT
      id,
      schedule,
      ${threadColumn},
      prompt,
      ${usesWorkspaceColumn ? "workspace_directory" : "?"},
      CASE WHEN enabled = 0 THEN 0 ELSE 1 END,
      created_at,
      updated_at,
      next_run_at
    FROM tasks
  `);
  if (usesWorkspaceColumn) {
    insert.run();
  } else {
    insert.run(DEFAULT_WORKSPACE_DIRECTORY);
  }
  database.exec("DROP TABLE tasks");
  database.exec("ALTER TABLE tasks_new RENAME TO tasks");
}

function recreateExecutionHistoryTable(database: Database.Database): void {
  const columns = getColumnNames(database, "execution_history");
  const threadColumn = columns.has("thread_id") ? "thread_id" : "session_id";

  database.exec(EXECUTION_HISTORY_TABLE_SQL.replace("execution_history", "execution_history_new"));
  database.exec(`
    INSERT INTO execution_history_new (
      id, task_id, thread_id, prompt, scheduled_for, executed_at, status, error_message
    )
    SELECT
      id,
      task_id,
      ${threadColumn},
      prompt,
      scheduled_for,
      executed_at,
      status,
      error_message
    FROM execution_history
  `);
  database.exec("DROP TABLE execution_history");
  database.exec("ALTER TABLE execution_history_new RENAME TO execution_history");
}

function ensureTables(database: Database.Database): void {
  if (!tableExists(database, "tasks")) {
    database.exec(TASKS_TABLE_SQL);
  } else {
    const taskColumns = getColumnNames(database, "tasks");
    if (!taskColumns.has("thread_id") || !taskColumns.has("workspace_directory") || taskColumns.has("session_id")) {
      recreateTasksTable(database);
    }
  }

  if (!tableExists(database, "execution_history")) {
    database.exec(EXECUTION_HISTORY_TABLE_SQL);
  } else {
    const executionColumns = getColumnNames(database, "execution_history");
    if (!executionColumns.has("thread_id") || executionColumns.has("session_id")) {
      recreateExecutionHistoryTable(database);
    }
  }
}

function ensureIndexes(database: Database.Database): void {
  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_tasks_enabled_next_run_at
    ON tasks (enabled, next_run_at)
  `);
  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_tasks_created_at
    ON tasks (created_at DESC)
  `);
  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_execution_history_task_executed_at
    ON execution_history (task_id, executed_at DESC)
  `);
  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_execution_history_executed_at
    ON execution_history (executed_at DESC)
  `);
}

export function createDatabase(): Database.Database {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const database = new Database(DB_PATH);
  database.pragma("foreign_keys = OFF");
  ensureTables(database);
  ensureIndexes(database);
  database.pragma("foreign_keys = ON");
  return database;
}
