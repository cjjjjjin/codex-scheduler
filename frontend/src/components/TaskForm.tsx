import { FormEvent, useEffect, useState } from "react";

import type { Task, TaskInput } from "../types";

type TaskFormProps = {
  initialTask?: Task | null;
  onSubmit: (payload: TaskInput) => Promise<void>;
  onCancelEdit: () => void;
  mode: "create" | "edit";
};

const EMPTY_FORM: TaskInput = {
  schedule: "*/5 * * * *",
  prompt: ""
};

export function TaskForm({ initialTask, onSubmit, onCancelEdit, mode }: TaskFormProps) {
  const [form, setForm] = useState<TaskInput>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!initialTask) {
      setForm(EMPTY_FORM);
      return;
    }

    setForm({
      schedule: initialTask.schedule,
      prompt: initialTask.prompt
    });
  }, [initialTask]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit(form);
      if (!initialTask) {
        setForm(EMPTY_FORM);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="panel" onSubmit={handleSubmit}>
      <div className="panel-header">
        <h2>{mode === "edit" ? "Task 수정" : "Task 생성"}</h2>
        <button className="ghost-button" type="button" onClick={onCancelEdit}>
          {mode === "edit" ? "편집 취소" : "닫기"}
        </button>
      </div>
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
        <span>Prompt</span>
        <textarea
          value={form.prompt}
          onChange={(event) => setForm((prev) => ({ ...prev, prompt: event.target.value }))}
          rows={7}
          placeholder="Session으로 전달할 프롬프트를 입력하세요."
          required
        />
      </label>
      <button className="primary-button" type="submit" disabled={submitting}>
        {submitting ? "저장 중..." : mode === "edit" ? "Task 저장" : "Task 생성"}
      </button>
    </form>
  );
}
