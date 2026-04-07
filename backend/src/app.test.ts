import assert from "node:assert/strict";
import test from "node:test";

import { createApp } from "./app.js";

test("agent task settings route is separate from normal task update", async () => {
  let agentBody: unknown = null;
  let humanBody: unknown = null;

  const runtime = {
    taskService: {
      listTasks: () => [],
      getTask: () => ({ id: "task-1" }),
      getTaskMessages: async () => ({ messages: [] }),
      createTask: async () => ({ id: "task-1" }),
      updateTask: (_taskId: string, body: unknown) => {
        humanBody = body;
        return { route: "human" };
      },
      updateTaskSettings: (_taskId: string, body: unknown) => {
        agentBody = body;
        return { route: "agent" };
      },
      setEnabled: () => ({}),
      deleteTask: () => {},
      listExecutionHistory: () => [],
      sendChatMessage: async () => ({})
    },
    taskScheduler: {
      runDueTasks: async () => {},
      start: () => {},
      stop: () => {}
    },
    database: {
      close: () => {}
    }
  };

  const app = createApp(runtime as never);
  const server = app.listen(0);

  try {
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const address = server.address();
    if (address === null || typeof address === "string") {
      throw new Error("failed to resolve server address");
    }

    const base = `http://127.0.0.1:${address.port}`;

    const agent = await fetch(`${base}/api/agent/tasks/task-1/settings`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ schedule: "*/10 * * * *", prompt: "agent" })
    });
    assert.equal(agent.status, 200);
    assert.deepEqual(await agent.json(), { route: "agent" });
    assert.deepEqual(agentBody, { schedule: "*/10 * * * *", prompt: "agent" });
    assert.equal(humanBody, null);

    const human = await fetch(`${base}/api/tasks/task-1`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ schedule: "*/5 * * * *", prompt: "human" })
    });
    assert.equal(human.status, 200);
    assert.deepEqual(await human.json(), { route: "human" });
    assert.deepEqual(humanBody, { schedule: "*/5 * * * *", prompt: "human" });
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
