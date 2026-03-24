import type { ExecutionRecord, Task, TaskInput } from "../types";

const API_BASE = "http://localhost:8000/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json"
    },
    ...init
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Request failed");
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export const api = {
  listTasks: () => request<Task[]>("/tasks"),
  createTask: (payload: TaskInput) =>
    request<Task>("/tasks", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  updateTask: (taskId: string, payload: TaskInput) =>
    request<Task>(`/tasks/${taskId}`, {
      method: "PUT",
      body: JSON.stringify(payload)
    }),
  setTaskEnabled: (taskId: string, enabled: boolean) =>
    request<Task>(`/tasks/${taskId}/enabled`, {
      method: "PATCH",
      body: JSON.stringify({ enabled })
    }),
  deleteTask: (taskId: string) =>
    request<void>(`/tasks/${taskId}`, {
      method: "DELETE"
    }),
  listExecutions: (taskId?: string) =>
    request<ExecutionRecord[]>(taskId ? `/executions?task_id=${taskId}` : "/executions")
};

