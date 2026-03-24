import { useEffect, useState } from "react";

import { api } from "./api/client";
import { ExecutionHistory } from "./components/ExecutionHistory";
import { TaskForm } from "./components/TaskForm";
import { TaskList } from "./components/TaskList";
import type { ExecutionRecord, Task, TaskInput } from "./types";

export default function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [history, setHistory] = useState<ExecutionRecord[]>([]);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  async function loadTasks() {
    const items = await api.listTasks();
    setTasks(items);
    if (items.length === 0) {
      setSelectedTaskId(null);
      return;
    }

    setSelectedTaskId((current) => current ?? items[0].id);
  }

  async function loadHistory(taskId?: string | null) {
    const items = await api.listExecutions(taskId || undefined);
    setHistory(items);
  }

  useEffect(() => {
    void (async () => {
      try {
        await loadTasks();
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : "Task를 불러오지 못했습니다.");
      }
    })();
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        await loadHistory(selectedTaskId);
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : "실행 이력을 불러오지 못했습니다.");
      }
    })();
  }, [selectedTaskId]);

  async function refresh(taskId?: string | null) {
    await loadTasks();
    await loadHistory(taskId ?? selectedTaskId);
  }

  async function handleSubmit(payload: TaskInput) {
    try {
      setError(null);
      if (editingTask) {
        await api.updateTask(editingTask.id, payload);
      } else {
        await api.createTask(payload);
        setIsCreateOpen(false);
      }
      setEditingTask(null);
      await refresh();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "저장하지 못했습니다.");
    }
  }

  async function handleToggle(task: Task) {
    try {
      setError(null);
      await api.setTaskEnabled(task.id, !task.enabled);
      await refresh(task.id);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "상태를 변경하지 못했습니다.");
    }
  }

  async function handleDelete(taskId: string) {
    try {
      setError(null);
      await api.deleteTask(taskId);
      if (editingTask?.id === taskId) {
        setEditingTask(null);
      }
      if (selectedTaskId === taskId) {
        setSelectedTaskId(null);
      }
      await refresh();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "삭제하지 못했습니다.");
    }
  }

  return (
    <div className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">codex-schedule</p>
          <h1>Codex Session Scheduler</h1>
        </div>
        <div className="hero-actions">
          <p className="hero-copy">
            CRON 스케줄 기반으로 Prompt를 Session에 전달하고, 실행 이력을 확인하는 관리 화면입니다.
          </p>
          <button
            className="primary-button"
            type="button"
            onClick={() => {
              setEditingTask(null);
              setIsCreateOpen(true);
            }}
          >
            Task 추가
          </button>
        </div>
      </header>

      {error ? <div className="error-banner">{error}</div> : null}

      <main className="layout">
        <div className="left-column">
          {isCreateOpen ? (
            <TaskForm
              mode="create"
              initialTask={null}
              onSubmit={handleSubmit}
              onCancelEdit={() => setIsCreateOpen(false)}
            />
          ) : null}
          {editingTask ? (
            <TaskForm
              mode="edit"
              initialTask={editingTask}
              onSubmit={handleSubmit}
              onCancelEdit={() => setEditingTask(null)}
            />
          ) : null}
          <ExecutionHistory history={history} />
        </div>
        <TaskList
          tasks={tasks}
          selectedTaskId={selectedTaskId}
          onEdit={(task) => {
            setIsCreateOpen(false);
            setEditingTask(task);
          }}
          onToggle={handleToggle}
          onDelete={handleDelete}
          onSelect={setSelectedTaskId}
        />
      </main>
    </div>
  );
}
