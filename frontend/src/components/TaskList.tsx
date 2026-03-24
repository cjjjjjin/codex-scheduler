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

export function TaskList({
  tasks,
  selectedTaskId,
  onEdit,
  onToggle,
  onDelete,
  onSelect
}: TaskListProps) {
  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Task 목록</h2>
        <span className="meta">{tasks.length}개</span>
      </div>
      <div className="task-table">
        <div className="task-table-header">
          <span>상태</span>
          <span>스케줄</span>
          <span>Prompt</span>
          <span>Session</span>
          <span>다음 실행</span>
          <span>작업</span>
        </div>
        {tasks.map((task) => (
          <article
            key={task.id}
            className={`task-row ${selectedTaskId === task.id ? "selected" : ""}`}
            onClick={() => onSelect(task.id)}
          >
            <div className="task-row-cell">
              <span className={`status-chip ${task.enabled ? "enabled" : "disabled"}`}>
                {task.enabled ? "Enabled" : "Disabled"}
              </span>
            </div>
            <div className="task-row-cell">
              <strong>{task.schedule}</strong>
            </div>
            <div className="task-row-cell task-row-prompt" title={task.prompt}>
              {task.prompt}
            </div>
            <div className="task-row-cell task-row-session" title={task.session_id}>
              {task.session_id}
            </div>
            <div className="task-row-cell">{formatDateTime(task.next_run_at)}</div>
            <div className="task-row-cell task-actions">
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
        ))}
        {tasks.length === 0 ? <p className="empty-state">등록된 Task가 없습니다.</p> : null}
      </div>
    </section>
  );
}
