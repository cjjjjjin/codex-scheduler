import { Suspense, lazy, useEffect, useRef, useState, type FormEvent } from "react";

import type { ExecutionRecord, Task } from "../types";

const AssistantTaskThread = lazy(async () => {
  const module = await import("./AssistantTaskThread");
  return { default: module.AssistantTaskThread };
});

type TaskChatProps = {
  mode: "create" | "chat";
  selectedTask: Task | null;
  history: ExecutionRecord[];
  isSending: boolean;
  draftSchedule: string;
  onDraftScheduleChange: (value: string) => void;
  onSendMessage: (message: string) => Promise<void>;
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatRelativeTaskState(task: Task) {
  return task.enabled ? "Live thread" : "Paused thread";
}

function SessionThreadLoading({ task }: { task: Task }) {
  return (
    <div className="assistant-thread-loading">
      <div className="assistant-thread-loading-card">
        <p className="stack-label">Loading Session</p>
        <h3>{task.prompt}</h3>
        <p>assistant-ui workspace를 불러오는 중입니다. 선택한 Task의 thread session을 곧 이어서 표시합니다.</p>
      </div>
      <div className="assistant-thread-loading-grid">
        <div className="assistant-thread-loading-block" />
        <div className="assistant-thread-loading-block" />
        <div className="assistant-thread-loading-block assistant-thread-loading-block-wide" />
      </div>
    </div>
  );
}

export function TaskChat({
  mode,
  selectedTask,
  history,
  isSending,
  draftSchedule,
  onDraftScheduleChange,
  onSendMessage
}: TaskChatProps) {
  const [draft, setDraft] = useState("");
  const composerRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    setDraft("");
  }, [selectedTask?.id]);

  useEffect(() => {
    if (!isSending) {
      composerRef.current?.focus();
    }
  }, [mode, selectedTask?.id, isSending]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const nextMessage = draft.trim();
    if ((!selectedTask && mode !== "create") || !nextMessage || isSending) {
      return;
    }

    setDraft("");
    await onSendMessage(nextMessage);
  }

  if (mode === "create") {
    return (
      <section className="chat-shell panel conversation-panel">
        <header className="chat-header">
          <div>
            <p className="chat-label">New Session</p>
            <h2>첫 메시지로 Task 생성</h2>
            <p className="panel-subtitle">
              아래 첫 메시지를 보내면 새 Task가 생성되고, 생성된 thread에서 바로 Codex와 대화가 시작됩니다.
            </p>
          </div>
          <div className="chat-task-summary">
            <span className="chat-meta-pill">Draft</span>
            <span className="chat-meta-pill subtle">pending thread</span>
          </div>
        </header>

        <section className="chat-context-bar">
          <label className="chat-context-card">
            <span className="task-card-meta-label">CRON Schedule</span>
            <input
              className="chat-inline-input"
              value={draftSchedule}
              onChange={(event) => onDraftScheduleChange(event.target.value)}
              placeholder="*/5 * * * *"
              disabled={isSending}
            />
          </label>
          <div className="chat-context-card">
            <span className="task-card-meta-label">Thread</span>
            <p>첫 메시지 전송 후 자동 생성</p>
          </div>
          <div className="chat-context-card">
            <span className="task-card-meta-label">Workspace</span>
            <p>서버 기본 workspace 사용</p>
          </div>
        </section>

        <div className="chat-thread">
          <article className="chat-message assistant">
            <div className="chat-avatar">C</div>
            <div className="chat-bubble assistant">
              <div className="chat-bubble-header">
                <strong>Codex</strong>
                <span>준비됨</span>
              </div>
              <p>Task를 시작할 첫 메시지를 입력하세요. 이 메시지는 기본 prompt로 저장되고 같은 내용으로 첫 대화도 전송됩니다.</p>
            </div>
          </article>
        </div>

        <footer className="chat-composer-shell">
          <form className="chat-composer" onSubmit={(event) => void handleSubmit(event)}>
            <textarea
              ref={composerRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="예: 매일 아침 배치 상태를 점검하고 실패 원인을 요약해줘"
              rows={4}
              disabled={isSending}
            />
            <div className="chat-composer-actions">
              <div className="chat-composer-meta">
                <span>첫 메시지 = Task 생성 + 첫 chat 전송</span>
              </div>
              <button className="primary-button" type="submit" disabled={isSending || !draft.trim() || !draftSchedule.trim()}>
                {isSending ? "Creating..." : "Create Task"}
              </button>
            </div>
          </form>
        </footer>
      </section>
    );
  }

  if (!selectedTask) {
    return (
      <section className="chat-shell panel conversation-panel">
        <header className="chat-header">
          <div>
            <p className="chat-label">Session</p>
            <h2>Task를 먼저 선택하세요</h2>
            <p className="panel-subtitle">
              왼쪽에서 Task를 선택하면 같은 thread에 이어서 대화할 수 있습니다. 새 Task를 만들고 싶다면 `New Task`를 눌러주세요.
            </p>
          </div>
        </header>

        <div className="chat-thread">
          <article className="chat-message assistant">
            <div className="chat-avatar">C</div>
            <div className="chat-bubble assistant">
              <div className="chat-bubble-header">
                <strong>Codex</strong>
                <span>대기 중</span>
              </div>
              <p>현재 전송 대상 Task가 없습니다. 입력은 가능하지만, 실제 전송은 Task를 선택하거나 새 Task 생성 모드로 들어간 뒤 진행됩니다.</p>
            </div>
          </article>
        </div>

        <footer className="chat-composer-shell">
          <form className="chat-composer" onSubmit={(event) => event.preventDefault()}>
            <textarea
              ref={composerRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="먼저 왼쪽에서 Task를 선택하거나 New Task를 눌러 주세요."
              rows={4}
            />
            <div className="chat-composer-actions">
              <div className="chat-composer-meta">
                <span>전송하려면 먼저 Task 선택이 필요합니다.</span>
              </div>
              <button className="primary-button" type="submit" disabled>
                Send
              </button>
            </div>
          </form>
        </footer>
      </section>
    );
  }

  return (
    <section className="chat-shell panel conversation-panel">
      <header className="chat-header">
        <div>
          <p className="chat-label">Session</p>
          <h2>{selectedTask.prompt}</h2>
          <p className="panel-subtitle">
            선택한 Task의 `thread_id`를 그대로 사용해 Codex와 대화합니다.
          </p>
        </div>
        <div className="chat-task-summary">
          <span className={`status-chip ${selectedTask.enabled ? "enabled" : "disabled"}`}>
            {formatRelativeTaskState(selectedTask)}
          </span>
          <span className="chat-meta-pill">{selectedTask.schedule}</span>
        </div>
      </header>

      <section className="chat-context-bar">
        <div className="chat-context-card">
          <span className="task-card-meta-label">Thread</span>
          <p className="task-card-mono" title={selectedTask.thread_id}>{selectedTask.thread_id}</p>
        </div>
        <div className="chat-context-card">
          <span className="task-card-meta-label">Workspace</span>
          <p title={selectedTask.workspace_directory}>{selectedTask.workspace_directory}</p>
        </div>
        <div className="chat-context-card">
          <span className="task-card-meta-label">최근 실행</span>
          <p>{history[0] ? formatDateTime(history[0].executed_at) : "아직 없음"}</p>
        </div>
      </section>

      <div className="chat-thread assistant-chat-thread">
        <Suspense fallback={<SessionThreadLoading task={selectedTask} />}>
          <AssistantTaskThread task={selectedTask} />
        </Suspense>
      </div>

      <footer className="chat-composer-shell assistant-chat-meta-shell">
        <div className="chat-composer-meta">
          <span>{history.length}개의 스케줄 실행 이력</span>
          <span>{selectedTask.enabled ? "scheduler enabled" : "scheduler paused"}</span>
        </div>
      </footer>
    </section>
  );
}
