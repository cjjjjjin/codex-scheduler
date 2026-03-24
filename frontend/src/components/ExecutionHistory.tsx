import type { ExecutionRecord } from "../types";

type ExecutionHistoryProps = {
  history: ExecutionRecord[];
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function ExecutionHistory({ history }: ExecutionHistoryProps) {
  return (
    <section className="panel">
      <div className="panel-header">
        <h2>실행 이력</h2>
        <span className="meta">{history.length}건</span>
      </div>
      <div className="history-list">
        {history.map((item) => (
          <article key={item.id} className="history-card">
            <div className="history-card-header">
              <strong>{formatDateTime(item.executed_at)}</strong>
              <span className={`status-chip ${item.status === "success" ? "enabled" : "disabled"}`}>
                {item.status}
              </span>
            </div>
            <p>Task ID: {item.task_id}</p>
            <p>Session: {item.session_id}</p>
            <p>Scheduled: {formatDateTime(item.scheduled_for)}</p>
            {item.error_message ? <p className="error-text">{item.error_message}</p> : null}
          </article>
        ))}
        {history.length === 0 ? <p className="empty-state">실행 이력이 없습니다.</p> : null}
      </div>
    </section>
  );
}

