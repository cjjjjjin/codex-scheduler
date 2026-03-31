import { FormEvent, useEffect, useState } from "react";

import type { Task, TaskInput } from "../types";

type TaskFormProps = {
  initialTask?: Task | null;
  onSubmit: (payload: TaskInput) => Promise<void>;
  onCancelEdit: () => void;
  mode: "create" | "edit";
  showBackButton?: boolean;
};

const EMPTY_FORM: TaskInput = {
  schedule: "*/5 * * * *",
  prompt: "",
  environment_variables: {}
};

function serializeEnvironmentVariables(environmentVariables: Record<string, string>): string {
  return Object.entries(environmentVariables)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
}

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

export function TaskForm({ initialTask, onSubmit, onCancelEdit, mode, showBackButton = true }: TaskFormProps) {
  const [form, setForm] = useState<TaskInput>(EMPTY_FORM);
  const [environmentVariablesText, setEnvironmentVariablesText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!initialTask) {
      setForm(EMPTY_FORM);
      setEnvironmentVariablesText("");
      return;
    }

    setForm({
      schedule: initialTask.schedule,
      prompt: initialTask.prompt,
      environment_variables: initialTask.environment_variables
    });
    setEnvironmentVariablesText(serializeEnvironmentVariables(initialTask.environment_variables));
  }, [initialTask]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit({
        ...form,
        environment_variables: parseEnvironmentVariables(environmentVariablesText)
      });
      if (!initialTask) {
        setForm(EMPTY_FORM);
        setEnvironmentVariablesText("");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="form-shell">
      {showBackButton ? (
        <button className="back-button" type="button" onClick={onCancelEdit}>
          Task rail로 돌아가기
        </button>
      ) : null}
      <form className="panel form-panel" onSubmit={handleSubmit}>
        <div className="form-header">
          <div>
            <p className="stack-label">Inspector</p>
            <h2>{mode === "edit" ? "Task 수정" : "새로운 Task 추가"}</h2>
            <p className="form-description">
              {mode === "edit"
                ? "다음 스케줄 실행부터 적용될 Task 정보를 수정합니다."
                : "자동으로 실행될 Task의 정보를 입력하세요."}
            </p>
          </div>
        </div>
        <label className="field field-inline">
          <span>{mode === "edit" ? "Task 상태" : "생성 안내"}</span>
          <div className="readonly-box">
            {mode === "edit"
              ? "활성화 상태는 목록 화면에서 변경할 수 있습니다."
              : "Thread ID는 생성 시 시스템이 자동으로 만듭니다."}
          </div>
        </label>
        <label className="field">
          <span>Prompt</span>
          <textarea
            value={form.prompt}
            onChange={(event) => setForm((prev) => ({ ...prev, prompt: event.target.value }))}
            rows={8}
            placeholder="Thread로 전달할 프롬프트를 입력하세요."
            required
          />
        </label>
        <label className="field">
          <span>CRON 스케줄</span>
          <input
            value={form.schedule}
            onChange={(event) => setForm((prev) => ({ ...prev, schedule: event.target.value }))}
            placeholder="*/5 * * * *"
            required
          />
        </label>
        <label className="field">
          <span>환경 변수</span>
          <textarea
            value={environmentVariablesText}
            onChange={(event) => setEnvironmentVariablesText(event.target.value)}
            rows={6}
            placeholder={"KEY=value\nANOTHER_KEY=another value"}
          />
        </label>
        {initialTask ? (
          <>
            <label className="field">
              <span>Thread ID</span>
              <input value={initialTask.thread_id} readOnly />
            </label>
            <label className="field">
              <span>Workspace Directory</span>
              <input value={initialTask.workspace_directory} readOnly />
            </label>
          </>
        ) : null}
        <div className="form-actions">
          <button className="primary-button" type="submit" disabled={submitting}>
            {submitting ? "저장 중..." : mode === "edit" ? "Task 저장" : "Task 추가"}
          </button>
          <button className="ghost-button" type="button" onClick={onCancelEdit}>
            취소
          </button>
        </div>
      </form>
    </section>
  );
}
