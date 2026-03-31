import type { ExecutionRecord, Task } from "../types";

type ExecutionPanelProps = {
  selectedTask: Task | null;
  history: ExecutionRecord[];
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function ExecutionPanel({ selectedTask, history }: ExecutionPanelProps) {
  return (
    <section className="panel activity-panel">
      <header className="stack-panel-header">
        <div>
          <p className="stack-label">Activity</p>
          <h3>실행 이력</h3>
        </div>
        <span className="stack-count">{history.length}</span>
      </header>

      {selectedTask ? (
        <div className="activity-summary">
          <div className="activity-summary-card">
            <span className="activity-summary-label">현재 선택</span>
            <strong>{selectedTask.prompt}</strong>
          </div>
          <div className="activity-summary-card">
            <span className="activity-summary-label">최근 실행</span>
            <strong>{history[0] ? formatDateTime(history[0].executed_at) : "기록 없음"}</strong>
          </div>
        </div>
      ) : (
        <div className="activity-empty-callout">
          <p className="empty-title">선택된 Task 없음</p>
          <p className="empty-state">왼쪽 목록에서 Task를 선택하면 실행 이력을 함께 확인할 수 있습니다.</p>
        </div>
      )}

      <div className="activity-list">
        {history.length === 0 ? (
          <div className="activity-empty-callout">
            <p className="empty-title">아직 실행된 기록이 없습니다</p>
            <p className="empty-state">스케줄이 실행되면 성공 및 실패 이력이 여기에 쌓입니다.</p>
          </div>
        ) : (
          history.map((record) => (
            <article key={record.id} className="activity-item">
              <div className="activity-item-header">
                <div className="activity-item-status">
                  <span className={`status-dot ${record.status}`}></span>
                  <strong>{record.status === "success" ? "성공" : "실패"}</strong>
                </div>
                <time>{formatDateTime(record.executed_at)}</time>
              </div>
              <p className="activity-item-prompt">{record.prompt}</p>
              <div className="activity-item-meta">
                <span>예정 시각 {formatDateTime(record.scheduled_for)}</span>
                <span className="task-card-mono" title={record.thread_id}>{record.thread_id}</span>
              </div>
              {record.error_message ? <p className="activity-item-error">{record.error_message}</p> : null}
            </article>
          ))
        )}
      </div>
    </section>
  );
}
