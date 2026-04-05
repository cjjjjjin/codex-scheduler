import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { DEFAULT_WORKSPACE_DIRECTORY } from "./config.js";
import { TaskService } from "./task-service.js";

type CreatedTaskPayload = {
  id: string;
  workspaceDirectory: string;
};

test("createTask stores workspace directory as default workspace plus task id", async () => {
  let installedWorkspaceDirectory: string | null = null;
  let createdThreadWorkspaceDirectory: string | null = null;
  const createdTaskPayloads: CreatedTaskPayload[] = [];

  const service = new TaskService(
    {
      listTasks: () => [],
      getTask: () => null,
      createTask: (payload: CreatedTaskPayload) => {
        createdTaskPayloads.push(payload);
        return {
          id: payload.id,
          workspace_directory: payload.workspaceDirectory
        };
      },
      updateTask: () => null,
      setEnabled: () => null,
      deleteTask: () => {},
      listExecutionHistory: () => [],
      updateNextRun: () => {},
      addExecution: () => {}
    } as never,
    {
      createThread: async (workspaceDirectory?: string) => {
        createdThreadWorkspaceDirectory = workspaceDirectory ?? null;
        return "thread-1";
      },
      sendPrompt: async () => ({
        success: true,
        errorMessage: null,
        responseText: null
      })
    } as never,
    {
      ensureTaskSettingsSkillInstalled: (workspaceDirectory: string) => {
        installedWorkspaceDirectory = workspaceDirectory;
        return path.join(workspaceDirectory, ".agents", "skills", "task-settings", "SKILL.md");
      }
    } as never,
    null
  );

  const createdTask = await service.createTask({
    schedule: "*/5 * * * *",
    prompt: "hello"
  });

  const payload = createdTaskPayloads[0];
  if (!payload) {
    throw new Error("task payload was not captured");
  }
  assert.equal(typeof payload.id, "string");
  const expectedWorkspaceDirectory = path.join(DEFAULT_WORKSPACE_DIRECTORY, payload.id);

  assert.equal(installedWorkspaceDirectory, expectedWorkspaceDirectory);
  assert.equal(createdThreadWorkspaceDirectory, expectedWorkspaceDirectory);
  assert.equal(payload.workspaceDirectory, expectedWorkspaceDirectory);
  assert.deepEqual(createdTask, {
    id: payload.id,
    workspace_directory: expectedWorkspaceDirectory
  });
});
