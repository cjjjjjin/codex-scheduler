import type { Task, TaskSessionMeta } from "../types";

type TaskListProps = {
  tasks: Task[];
  selectedTaskId: string | null;
  sessionMetaByTask: Record<string, TaskSessionMeta>;
  onEdit: (task: Task) => void;
  onSelect: (taskId: string | null) => void;
};

export function TaskList({ tasks, selectedTaskId, sessionMetaByTask, onEdit, onSelect }: TaskListProps) {
  return (
    <section className="task-list-panel">
      <div className="task-list">
        {tasks.map((task) => {
          const isSelected = selectedTaskId === task.id;
          const sessionMeta = sessionMetaByTask[task.id];
          const sessionLabel = sessionMeta?.message_count ? `${sessionMeta.message_count}` : null;

          return (
            <article
              key={task.id}
              className={`task-card task-card-compact ${isSelected ? "selected" : ""} ${task.enabled ? "" : "disabled"}`}
              onClick={() => onSelect(task.id)}
            >
              <div className="task-card-compact-main">
                <div className="task-card-compact-copy">
                  <h2 title={task.prompt}>{task.prompt}</h2>
                  {sessionLabel ? (
                    <span className="task-card-compact-meta">{sessionLabel}</span>
                  ) : null}
                </div>
                <button
                  className="ghost-button task-card-edit-button"
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onEdit(task);
                  }}
                >
                  수정
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
