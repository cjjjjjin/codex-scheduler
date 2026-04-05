export type Task = {
  id: string;
  schedule: string;
  thread_id: string;
  prompt: string;
  workspace_directory: string;
  environment_variables: Record<string, string>;
  enabled: boolean;
  created_at: string;
  updated_at: string;
  next_run_at: string | null;
};

export type ExecutionStatus = "success" | "failed";

export type ExecutionRecord = {
  id: number;
  task_id: string;
  thread_id: string;
  prompt: string;
  scheduled_for: string;
  executed_at: string;
  status: ExecutionStatus;
  error_message: string | null;
};

export type TaskPayload = {
  schedule: string;
  prompt: string;
  environment_variables?: Record<string, string>;
};

export type TaskSettingsPayload = {
  schedule: string;
  prompt: string;
  environment_variables?: Record<string, string>;
};

export type TaskEnabledPayload = {
  enabled: boolean;
};

export type TaskChatPayload = {
  message: string;
};

export type TaskChatResponse = {
  task_id: string;
  thread_id: string;
  message: string;
  response_text: string | null;
};

export type TaskHistoryMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  created_at: string | null;
};

export type TaskMessagesResponse = {
  task_id: string;
  thread_id: string;
  messages: TaskHistoryMessage[];
};

export type CodexSendResult = {
  success: boolean;
  errorMessage: string | null;
  responseText: string | null;
};
