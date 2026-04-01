import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";

import { SCHEDULER_POLL_MS } from "./config.js";
import { AppError } from "./errors.js";
import type { AppRuntime } from "./runtime.js";
import type { TaskChatPayload, TaskEnabledPayload, TaskPayload, TaskSettingsPayload } from "./types.js";

function allowLocalOrigin(origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void): void {
  if (!origin) {
    callback(null, true);
    return;
  }

  const allowed = /^https?:\/\/(localhost|127\.0\.0\.1|[0-9]{1,3}(?:\.[0-9]{1,3}){3})(:\d+)?$/.test(origin);
  callback(allowed ? null : new Error("Not allowed by CORS"), allowed);
}

export function createApp(runtime: AppRuntime) {
  const app = express();
  app.use(cors({ origin: allowLocalOrigin, credentials: true }));
  app.use(express.json());

  app.get("/api/health", (_request: Request, response: Response) => {
    response.json({ status: "ok" });
  });

  app.get("/api/tasks", (_request: Request, response: Response) => {
    response.json(runtime.taskService.listTasks());
  });

  app.get("/api/tasks/:taskId", (request: Request<{ taskId: string }>, response: Response, next: NextFunction) => {
    try {
      response.json(runtime.taskService.getTask(request.params.taskId));
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/tasks", async (request: Request<unknown, unknown, TaskPayload>, response: Response, next: NextFunction) => {
    try {
      const task = await runtime.taskService.createTask(request.body);
      response.status(201).json(task);
    } catch (error) {
      next(error);
    }
  });

  app.put("/api/tasks/:taskId", (request: Request<{ taskId: string }, unknown, TaskPayload>, response: Response, next: NextFunction) => {
    try {
      response.json(runtime.taskService.updateTask(request.params.taskId, request.body));
    } catch (error) {
      next(error);
    }
  });

  app.patch(
    "/api/agent/tasks/:taskId/settings",
    (request: Request<{ taskId: string }, unknown, TaskSettingsPayload>, response: Response, next: NextFunction) => {
      try {
        response.json(runtime.taskService.updateTaskSettings(request.params.taskId, request.body));
      } catch (error) {
        next(error);
      }
    }
  );

  app.patch(
    "/api/tasks/:taskId/enabled",
    (request: Request<{ taskId: string }, unknown, TaskEnabledPayload>, response: Response, next: NextFunction) => {
      try {
        response.json(runtime.taskService.setEnabled(request.params.taskId, request.body));
      } catch (error) {
        next(error);
      }
    }
  );

  app.delete("/api/tasks/:taskId", (request: Request<{ taskId: string }>, response: Response, next: NextFunction) => {
    try {
      runtime.taskService.deleteTask(request.params.taskId);
      response.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/executions", (request: Request, response: Response, next: NextFunction) => {
    try {
      const taskId = typeof request.query.task_id === "string" ? request.query.task_id : null;
      response.json(runtime.taskService.listExecutionHistory(taskId));
    } catch (error) {
      next(error);
    }
  });

  app.post(
    "/api/tasks/:taskId/chat",
    async (request: Request<{ taskId: string }, unknown, TaskChatPayload>, response: Response, next: NextFunction) => {
      try {
        response.json(await runtime.taskService.sendChatMessage(request.params.taskId, request.body));
      } catch (error) {
        next(error);
      }
    }
  );

  app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
    if (error instanceof AppError) {
      response.status(error.statusCode).send(error.message);
      return;
    }

    if (error instanceof SyntaxError) {
      response.status(400).send("Invalid JSON payload.");
      return;
    }

    response.status(500).send(error instanceof Error ? error.message : "Internal server error.");
  });

  return Object.assign(app, {
    async startRuntime(): Promise<void> {
      await runtime.taskScheduler.runDueTasks();
      runtime.taskScheduler.start(SCHEDULER_POLL_MS);
    },
    async stopRuntime(): Promise<void> {
      runtime.taskScheduler.stop();
      runtime.database.close();
    }
  });
}

export type CodexScheduleApp = ReturnType<typeof createApp>;
