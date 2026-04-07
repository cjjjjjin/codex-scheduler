import { AppServerClient } from "./app-server-client.js";
import { CODEX_APP_SERVER_URL, DEFAULT_WORKSPACE_DIRECTORY } from "./config.js";
import { CodexServiceError } from "./errors.js";
import type { CodexSendResult } from "./types.js";

type ThreadStartResult = {
  thread?: {
    id?: string;
  };
};

type ThreadResumeResult = {
  thread?: {
    id?: string;
  };
};

type TurnStartResult = {
  turn?: {
    id?: string;
  };
};

type TurnCompletedNotification = {
  threadId?: string;
  turn?: {
    id?: string;
    status?: string;
    error?: {
      message?: string;
      additionalDetails?: string | null;
    } | null;
  };
};

type ThreadUnsubscribeResult = {
  status?: string;
};

type ThreadClosedNotification = {
  threadId?: string;
};

type ThreadStatusChangedNotification = {
  threadId?: string;
  status?: {
    type?: string;
  };
};

type ItemCompletedNotification = {
  threadId?: string;
  turnId?: string;
  item?: {
    type?: string;
    id?: string;
    text?: string;
  };
};

type AgentMessageDeltaNotification = {
  threadId?: string;
  turnId?: string;
  itemId?: string;
  delta?: string;
};

function resolveWorkspaceDirectory(workspaceDirectory?: string): string {
  return workspaceDirectory ?? DEFAULT_WORKSPACE_DIRECTORY;
}

function ensureEnvironmentVariablesSupported(environmentVariables?: Record<string, string>): void {
  if (!environmentVariables || Object.keys(environmentVariables).length === 0) {
    return;
  }

  throw new CodexServiceError(
    "Codex App Server execution does not support per-task environment variable overrides."
  );
}

function buildThreadStartParams(workspaceDirectory?: string): Record<string, unknown> {
  return {
    cwd: resolveWorkspaceDirectory(workspaceDirectory),
    approvalPolicy: "never",
    sandbox: "workspaceWrite",
    experimentalRawEvents: false,
    persistExtendedHistory: true
  };
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = globalThis.setTimeout(() => {
      reject(new CodexServiceError(`Timed out waiting for Codex App Server after ${ms}ms.`));
    }, ms);

    promise.then(
      (value) => {
        globalThis.clearTimeout(timeoutId);
        resolve(value);
      },
      (error) => {
        globalThis.clearTimeout(timeoutId);
        reject(error);
      }
    );
  });
}

export class CodexService {
  private readonly client: AppServerClient;

  constructor(serverUrl: string = CODEX_APP_SERVER_URL) {
    this.client = new AppServerClient(serverUrl);
  }

  async createThread(workspaceDirectory?: string, environmentVariables?: Record<string, string>): Promise<string> {
    ensureEnvironmentVariablesSupported(environmentVariables);

    try {
      const response = await this.client.request<ThreadStartResult>("thread/start", buildThreadStartParams(workspaceDirectory));
      const threadId = response.thread?.id;
      if (!threadId || typeof threadId !== "string") {
        throw new CodexServiceError("Codex App Server did not return a valid thread ID.");
      }

      return threadId;
    } catch (error) {
      throw error instanceof CodexServiceError
        ? error
        : new CodexServiceError(
            `Failed to initialize Codex thread: ${error instanceof Error ? error.message : String(error)}`
          );
    }
  }

  async sendPrompt(
    threadId: string,
    prompt: string,
    workspaceDirectory?: string,
    environmentVariables?: Record<string, string>
  ): Promise<CodexSendResult> {
    if (!threadId || !prompt.trim()) {
      return {
        success: false,
        errorMessage: "Missing thread or prompt.",
        responseText: null
      };
    }

    try {
      ensureEnvironmentVariablesSupported(environmentVariables);

      return await this.client.withSession(async (session) => {
        const completedAgentMessages = new Map<string, string>();
        const streamedAgentMessages = new Map<string, string>();

        await session.request<ThreadResumeResult>("thread/resume", {
          threadId,
          ...buildThreadStartParams(workspaceDirectory)
        });

        let turnId: string | null = null;
        let settleTurnCompletion: ((result: CodexSendResult) => void) | null = null;
        let settleTurnFailure: ((error: Error) => void) | null = null;
        let settleThreadPersisted: (() => void) | null = null;
        const resultPromise = new Promise<CodexSendResult>((resolve, reject) => {
          settleTurnCompletion = resolve;
          settleTurnFailure = reject;
        });
        const persistencePromise = new Promise<void>((resolve) => {
          settleThreadPersisted = resolve;
        });

        const detach = session.onNotification((notification) => {
          try {
            if (notification.method === "item/agentMessage/delta") {
              const params = notification.params as AgentMessageDeltaNotification;
              if (
                params.threadId !== threadId ||
                (turnId !== null && params.turnId !== turnId) ||
                typeof params.itemId !== "string"
              ) {
                return;
              }

              if (turnId === null && typeof params.turnId === "string") {
                turnId = params.turnId;
              }

              const previous = streamedAgentMessages.get(params.itemId) ?? "";
              streamedAgentMessages.set(params.itemId, previous + (params.delta ?? ""));
              return;
            }

            if (notification.method === "item/completed") {
              const params = notification.params as ItemCompletedNotification;
              if (
                params.threadId !== threadId ||
                (turnId !== null && params.turnId !== turnId) ||
                params.item?.type !== "agentMessage"
              ) {
                return;
              }

              if (turnId === null && typeof params.turnId === "string") {
                turnId = params.turnId;
              }

              if (typeof params.item.id === "string" && typeof params.item.text === "string") {
                completedAgentMessages.set(params.item.id, params.item.text);
              }
              return;
            }

            if (notification.method === "turn/completed") {
              const params = notification.params as TurnCompletedNotification;
              if (
                params.threadId !== threadId ||
                (turnId !== null && params.turn?.id !== turnId)
              ) {
                return;
              }

              if (turnId === null && typeof params.turn?.id === "string") {
                turnId = params.turn.id;
              }

              const responseText = [...completedAgentMessages.values(), ...streamedAgentMessages.values()]
                .filter((text, index, values) => text.trim().length > 0 && values.indexOf(text) === index)
                .join("\n\n") || null;

              if (params.turn?.status === "completed") {
                settleTurnCompletion?.({
                  success: true,
                  errorMessage: null,
                  responseText
                });
                settleTurnCompletion = null;
                settleTurnFailure = null;
                return;
              }

              const errorMessage =
                params.turn?.error?.message ??
                params.turn?.error?.additionalDetails ??
                `Codex App Server turn ended with status ${params.turn?.status ?? "unknown"}.`;
              settleTurnCompletion?.({
                success: false,
                errorMessage,
                responseText
              });
              settleTurnCompletion = null;
              settleTurnFailure = null;
              return;
            }

            if (notification.method === "thread/status/changed") {
              const params = notification.params as ThreadStatusChangedNotification;
              if (params.threadId === threadId && params.status?.type === "notLoaded") {
                settleThreadPersisted?.();
                settleThreadPersisted = null;
              }
              return;
            }

            if (notification.method === "thread/closed") {
              const params = notification.params as ThreadClosedNotification;
              if (params.threadId === threadId) {
                settleThreadPersisted?.();
                settleThreadPersisted = null;
              }
            }
          } catch (error) {
            const normalized = error instanceof Error ? error : new Error(String(error));
            settleTurnFailure?.(normalized);
            settleTurnCompletion = null;
            settleTurnFailure = null;
          }
        });

        try {
          const turn = await session.request<TurnStartResult>("turn/start", {
            threadId,
            input: [{ type: "text", text: prompt.trim() }],
            cwd: resolveWorkspaceDirectory(workspaceDirectory),
            approvalPolicy: "never"
          });

          if (!turn.turn?.id || typeof turn.turn.id !== "string") {
            throw new CodexServiceError("Codex App Server did not return a valid turn ID.");
          }

          turnId = turn.turn.id;
          const result = await withTimeout(resultPromise, 120000);

          const unsubscribeWait = withTimeout(persistencePromise, 10000).catch(() => undefined);
          const unsubscribe = await session.request<ThreadUnsubscribeResult>("thread/unsubscribe", {
            threadId
          });

          if (unsubscribe.status === "unsubscribed") {
            await unsubscribeWait;
          }

          return result;
        } finally {
          detach();
        }
      });

    } catch (error) {
      return {
        success: false,
        errorMessage: error instanceof Error ? error.message : String(error),
        responseText: null
      };
    }
  }
}
