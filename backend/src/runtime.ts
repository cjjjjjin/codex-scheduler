import { CodexService } from "./codex-service.js";
import { createDatabase } from "./db.js";
import { TaskRepository } from "./task-repository.js";
import { TaskScheduler } from "./scheduler.js";
import { TaskService } from "./task-service.js";

export function createRuntime() {
  const database = createDatabase();
  const taskRepository = new TaskRepository(database);
  const codexService = new CodexService();
  const taskService = new TaskService(taskRepository, codexService);
  const taskScheduler = new TaskScheduler(taskRepository, codexService);

  return {
    database,
    taskRepository,
    taskService,
    taskScheduler
  };
}

export type AppRuntime = ReturnType<typeof createRuntime>;
