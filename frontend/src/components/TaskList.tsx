import type { Task } from "../types";

type TaskListProps = {
  tasks: Task[];
  selectedTaskId: string | null;
  onEdit: (task: Task) => void;
  onToggle: (task: Task) => Promise<void>;
  onDelete: (taskId: string) => Promise<void>;
  onSelect: (taskId: string | null) => void;
};

function formatDateTime(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function TaskList({ tasks, selectedTaskId, onEdit, onToggle, onDelete, onSelect }: TaskListProps) {
  return (
    <section className="task-list-panel">
      <header className="stack-panel-header">
        <div>
          <p className="stack-label">Task Rail</p>
          <h3>등록된 Task</h3>
        </div>
        <span className="stack-count">{tasks.length}</span>
      </header>
      <div className="task-list">
        {tasks.map((task) => {
          const isSelected = selectedTaskId === task.id;

          return (
            <article
              key={task.id}
              className={`task-card ${isSelected ? "selected" : ""}`}
              onClick={() => onSelect(task.id)}
            >
              <div className="task-card-topline">
                <span className="task-card-id">{task.id.slice(0, 8)}</span>
                <div className="task-card-topline-pills">
                  {isSelected ? <span className="task-session-chip selected">open</span> : null}
                  <span className={`status-chip ${task.enabled ? "enabled" : "disabled"}`}>
                    {task.enabled ? "활성" : "비활성"}
                  </span>
                </div>
              </div>
              <div className="task-card-main">
                <div className="task-card-title-row">
                  <h2>{task.prompt}</h2>
                </div>
                <div className="task-card-meta-row task-card-schedule-row">
                  <span className="task-card-meta-label">스케줄</span>
                  <code>{task.schedule}</code>
                </div>
                <div className="task-card-info-grid">
                  <div>
                    <span className="task-card-meta-label">Thread</span>
                    <p className="task-card-mono" title={task.thread_id}>{task.thread_id}</p>
                  </div>
                  <div>
                    <span className="task-card-meta-label">Workspace</span>
                    <p title={task.workspace_directory}>{task.workspace_directory}</p>
                  </div>
                  <div>
                    <span className="task-card-meta-label">다음 실행</span>
                    <p>{formatDateTime(task.next_run_at)}</p>
                  </div>
                </div>
              </div>
              <div className="task-actions">
                <button
                  className="ghost-button"
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onEdit(task);
                  }}
                >
                  수정
                </button>
                <button
                  className="ghost-button"
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    void onToggle(task);
                  }}
                >
                  {task.enabled ? "비활성화" : "활성화"}
                </button>
                <button
                  className="danger-button"
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    void onDelete(task.id);
                  }}
                >
                  삭제
                </button>
              </div>
            </article>
          );
        })}
        {tasks.length === 0 ? (
          <section className="panel empty-panel">
            <p className="empty-title">등록된 Task가 없습니다</p>
            <p className="empty-state">좌측 레일에 표시할 Task가 아직 없습니다. 첫 Task를 추가해 스케줄 실행을 시작하세요.</p>
          </section>
        ) : null}
      </div>
    </section>
  );
}
