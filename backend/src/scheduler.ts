import { getNextRunAt, nowInAppTimezone } from "./schedule-utils.js";
import type { CodexService } from "./codex-service.js";
import type { TaskRepository } from "./task-repository.js";

type Logger = Pick<Console, "error" | "info">;

export class TaskScheduler {
  taskRepository: TaskRepository;
  codexService: CodexService;
  logger: Logger;
  timer: NodeJS.Timeout | null;
  isRunningTick: boolean;

  constructor(taskRepository: TaskRepository, codexService: CodexService, logger: Logger = console) {
    this.taskRepository = taskRepository;
    this.codexService = codexService;
    this.logger = logger;
    this.timer = null;
    this.isRunningTick = false;
  }

  start(pollMs: number): void {
    if (this.timer) {
      return;
    }

    this.timer = setInterval(() => {
      void this.runDueTasks();
    }, pollMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async runDueTasks(): Promise<void> {
    if (this.isRunningTick) {
      return;
    }

    this.isRunningTick = true;
    try {
      const now = nowInAppTimezone().toISOString();
      const dueTasks = this.taskRepository.listDueTasks(now);

      for (const task of dueTasks) {
        const executedAt = nowInAppTimezone();
        const result = await this.codexService.sendPrompt(
          task.thread_id,
          task.prompt,
          task.workspace_directory,
          task.environment_variables
        );

        this.taskRepository.addExecution({
          taskId: task.id,
          threadId: task.thread_id,
          prompt: task.prompt,
          scheduledFor: task.next_run_at ?? executedAt.toISOString(),
          executedAt: executedAt.toISOString(),
          status: result.success ? "success" : "failed",
          errorMessage: result.errorMessage
        });

        const nextRunAt = getNextRunAt(task.schedule, executedAt).toISOString();
        this.taskRepository.updateNextRun(task.id, nextRunAt, executedAt.toISOString());

        if (result.success) {
          this.logger.info(`Task ${task.id} executed successfully for thread ${task.thread_id}`);
        } else {
          this.logger.error(
            `Task ${task.id} failed for thread ${task.thread_id}: ${result.errorMessage}`
          );
        }
      }
    } finally {
      this.isRunningTick = false;
    }
  }
}
