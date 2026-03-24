export type Task = {
  id: string;
  schedule: string;
  session_id: string;
  prompt: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
  next_run_at: string | null;
};

export type TaskInput = {
  schedule: string;
  prompt: string;
};

export type ExecutionRecord = {
  id: number;
  task_id: string;
  session_id: string;
  prompt: string;
  scheduled_for: string;
  executed_at: string;
  status: "success" | "failed";
  error_message: string | null;
};

