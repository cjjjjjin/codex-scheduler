import { useEffect, useState } from "react";

import { api } from "./api/client";
import { ExecutionPanel } from "./components/ExecutionPanel";
import { TaskChat } from "./components/TaskChat";
import { TaskForm } from "./components/TaskForm";
import { TaskList } from "./components/TaskList";
import type { ExecutionRecord, Task, TaskInput, TaskSessionMeta } from "./types";

type ViewMode = "list" | "create" | "edit";

function parseEnvironmentVariables(input: string): Record<string, string> {
  return Object.fromEntries(
    input
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => {
        const separatorIndex = line.indexOf("=");
        if (separatorIndex === -1) {
          return [line, ""];
        }

        return [line.slice(0, separatorIndex).trim(), line.slice(separatorIndex + 1)];
      })
      .filter(([key]) => key.length > 0)
  );
}

export default function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [history, setHistory] = useState<ExecutionRecord[]>([]);
  const [sessionMetaByTask, setSessionMetaByTask] = useState<Record<string, TaskSessionMeta>>({});
  const [sendingTaskId, setSendingTaskId] = useState<string | null>(null);
  const [draftSchedule, setDraftSchedule] = useState("*/5 * * * *");
  const [draftEnvironmentVariables, setDraftEnvironmentVariables] = useState("");
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("list");

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
        setViewMode("list");
      } else {
        await api.createTask(payload);
        setViewMode("list");
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
        setViewMode("list");
      }
      if (selectedTaskId === taskId) {
        setSelectedTaskId(null);
      }
      await refresh();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "삭제하지 못했습니다.");
    }
  }

  const selectedTask = tasks.find((task) => task.id === selectedTaskId) ?? null;
  const isChatSending = sendingTaskId === "draft";

  async function handleCreateTaskFromMessage(message: string) {
    const nextSchedule = draftSchedule.trim();

    if (!nextSchedule) {
      setError("schedule is required.");
      return;
    }

    setError(null);
    setSendingTaskId("draft");

    try {
      const createdTask = await api.createTask({
        schedule: nextSchedule,
        prompt: message,
        environment_variables: parseEnvironmentVariables(draftEnvironmentVariables)
      });

      setSelectedTaskId(createdTask.id);
      setViewMode("list");

      const response = await api.sendTaskMessage(createdTask.id, message);

      if (!response.response_text) {
        setError("응답은 완료되었지만 텍스트 출력이 비어 있습니다.");
      }

      setDraftSchedule("*/5 * * * *");
      setDraftEnvironmentVariables("");
      await refresh(createdTask.id);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Task를 생성하지 못했습니다.");
    } finally {
      setSendingTaskId((current) => (current === "draft" ? null : current));
    }
  }

  function handleSessionMetaChange(taskId: string, meta: TaskSessionMeta) {
    setSessionMetaByTask((current) => {
      const previous = current[taskId];
      if (previous && previous.message_count === meta.message_count && previous.last_message_at === meta.last_message_at) {
        return current;
      }

      return {
        ...current,
        [taskId]: meta
      };
    });
  }

  return (
    <div className="app-shell app-shell-chat">
      {error ? <div className="error-banner">{error}</div> : null}

      <main className="chat-layout">
        <aside className="sidebar">
          <section className="sidebar-shell panel">
            <header className="sidebar-minimal-header">
              <div>
                <p className="eyebrow">codex-scheduler</p>
                <h1>Workspace</h1>
              </div>
              <button
                className="sidebar-plus-button"
                type="button"
                aria-label="새 Task 추가"
                onClick={() => {
                  setEditingTask(null);
                  setSelectedTaskId(null);
                  setDraftSchedule("*/5 * * * *");
                  setDraftEnvironmentVariables("");
                  setViewMode("create");
                }}
              >
                +
              </button>
            </header>

            {viewMode === "edit" ? (
              <TaskForm
                mode="edit"
                initialTask={editingTask}
                onSubmit={handleSubmit}
                onCancelEdit={() => {
                  setEditingTask(null);
                  setViewMode("list");
                }}
                showBackButton={false}
              />
            ) : (
              <TaskList
                tasks={tasks}
                selectedTaskId={selectedTaskId}
                sessionMetaByTask={sessionMetaByTask}
                onEdit={(task) => {
                  setEditingTask(task);
                  setViewMode("edit");
                }}
                onSelect={(taskId) => {
                  setSelectedTaskId(taskId);
                  setEditingTask(null);
                  setViewMode("list");
                }}
              />
            )}
          </section>
        </aside>

        <section className="chat-main">
          <section className="workspace-shell">
            <header className="workspace-header panel">
              <div>
                <p className="stack-label">Workspace</p>
                <h2>{viewMode === "create" ? "새 Task 시작" : selectedTask ? selectedTask.prompt : "Task workspace"}</h2>
                <p className="panel-subtitle">
                  {viewMode === "create"
                    ? "첫 메시지와 스케줄을 정하면 새 thread가 생성되고 같은 흐름에서 바로 대화가 시작됩니다."
                    : selectedTask
                      ? "선택한 Task의 thread를 재사용해 Codex와 상호작용합니다."
                      : "Task를 선택하면 prompt, 대화, 실행 기록을 한 흐름으로 볼 수 있습니다."}
                </p>
              </div>
              <div className="workspace-header-meta">
                <span className="meta-pill">{viewMode === "create" ? "Draft session" : "Thread session"}</span>
                <span className="meta-pill subtle">{selectedTask ? selectedTask.schedule : "schedule pending"}</span>
              </div>
            </header>

            <div className="workspace-grid">
              <TaskChat
                mode={viewMode === "create" ? "create" : "chat"}
                history={history}
                selectedTask={selectedTask}
                isSending={isChatSending}
                draftSchedule={draftSchedule}
                draftEnvironmentVariables={draftEnvironmentVariables}
                onDraftScheduleChange={setDraftSchedule}
                onDraftEnvironmentVariablesChange={setDraftEnvironmentVariables}
                onCreateTaskFromMessage={handleCreateTaskFromMessage}
                onSessionMetaChange={handleSessionMetaChange}
              />

              <ExecutionPanel selectedTask={selectedTask} history={history} />
            </div>
          </section>
        </section>
      </main>
    </div>
  );
}
