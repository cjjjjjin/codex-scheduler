import { CodexService } from "./codex-service.js";
import { createDatabase } from "./db.js";
import { SkillService } from "./skill-service.js";
import { TaskRepository } from "./task-repository.js";
import { TaskScheduler } from "./scheduler.js";
import { TaskService } from "./task-service.js";

export function createRuntime() {
  const database = createDatabase();
  const taskRepository = new TaskRepository(database);
  const codexService = new CodexService();
  const skillService = new SkillService();
  const taskService = new TaskService(taskRepository, codexService, skillService);
  const taskScheduler = new TaskScheduler(taskRepository, codexService);

  return {
    database,
    taskRepository,
    skillService,
    taskService,
    taskScheduler
  };
}

export type AppRuntime = ReturnType<typeof createRuntime>;
