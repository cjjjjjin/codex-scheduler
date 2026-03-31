export type Task = {
  id: string;
  schedule: string;
  thread_id: string;
  prompt: string;
  workspace_directory: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
  next_run_at: string | null;
};

export type TaskInput = {
  schedule: string;
  prompt: string;
};

export type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
  created_at: string;
  status?: "sending" | "error";
};

export type TaskSessionMeta = {
  message_count: number;
  last_message_at: string | null;
};

export type ExecutionRecord = {
  id: number;
  task_id: string;
  thread_id: string;
  prompt: string;
  scheduled_for: string;
  executed_at: string;
  status: "success" | "failed";
  error_message: string | null;
};

export type TaskChatResponse = {
  task_id: string;
  thread_id: string;
  message: string;
  response_text: string | null;
};
