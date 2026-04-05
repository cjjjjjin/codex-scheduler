import { readFile } from "node:fs/promises";

import { AppError } from "./errors.js";
import type { TaskHistoryMessage } from "./types.js";

type JsonRpcMessage = {
  id?: string | number | null;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: {
    code?: number;
    message?: string;
  };
};

type ThreadReadResult = {
  thread?: {
    path?: string | null;
    turns?: AppServerTurn[];
  };
};

type AppServerTurn = {
  id?: string;
  items?: AppServerThreadItem[];
};

type AppServerThreadItem =
  | {
      type?: "userMessage";
      id?: string;
      content?: Array<{
        type?: string;
        text?: string;
      }>;
    }
  | {
      type?: "agentMessage";
      id?: string;
      text?: string;
    }
  | {
      type?: string;
      id?: string;
      [key: string]: unknown;
    };

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseJsonRpcMessage(raw: string): JsonRpcMessage {
  const parsed: unknown = JSON.parse(raw);
  if (!isObject(parsed)) {
    throw new Error("App Server returned a non-object JSON-RPC frame.");
  }

  return parsed as JsonRpcMessage;
}

function readUserMessageTexts(item: AppServerThreadItem): string[] {
  if (item.type !== "userMessage" || !Array.isArray(item.content)) {
    return [];
  }

  return item.content
    .filter((entry): entry is { type?: string; text?: string } => isObject(entry))
    .filter((entry) => entry.type === "text" && typeof entry.text === "string" && entry.text.trim().length > 0)
    .map((entry) => entry.text!.trim());
}

function flattenTurns(turns: AppServerTurn[]): TaskHistoryMessage[] {
  const messages: TaskHistoryMessage[] = [];

  for (const turn of turns) {
    const turnId = typeof turn.id === "string" ? turn.id : `turn-${messages.length}`;
    const items = Array.isArray(turn.items) ? turn.items : [];

    for (const item of items) {
      const itemId = typeof item.id === "string" ? item.id : `${turnId}-${messages.length}`;
      for (const text of readUserMessageTexts(item)) {
        messages.push({
          id: `${itemId}:user:${messages.length}`,
          role: "user",
          text,
          created_at: null
        });
      }

      if (item.type === "agentMessage" && typeof item.text === "string" && item.text.trim()) {
        messages.push({
          id: `${itemId}:assistant:${messages.length}`,
          role: "assistant",
          text: item.text.trim(),
          created_at: null
        });
      }
    }
  }

  return messages;
}

function normalizeIsoTimestamp(value: unknown): string | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

async function readMessagesFromRollout(path: string): Promise<TaskHistoryMessage[]> {
  const text = await readFile(path, "utf8");
  const messages: TaskHistoryMessage[] = [];

  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    const parsed: unknown = JSON.parse(trimmed);
    if (!isObject(parsed) || parsed.type !== "event_msg" || !isObject(parsed.payload)) {
      continue;
    }

    const createdAt = normalizeIsoTimestamp(parsed.timestamp);
    const payload = parsed.payload;

    if (payload.type === "user_message" && typeof payload.message === "string" && payload.message.trim()) {
      messages.push({
        id: `rollout:user:${messages.length}`,
        role: "user",
        text: payload.message.trim(),
        created_at: createdAt
      });
      continue;
    }

    if (payload.type === "agent_message" && typeof payload.message === "string" && payload.message.trim()) {
      messages.push({
        id: `rollout:assistant:${messages.length}`,
        role: "assistant",
        text: payload.message.trim(),
        created_at: createdAt
      });
    }
  }

  return messages;
}

export class CodexHistoryService {
  constructor(private readonly serverUrl: string) {}

  async listMessages(threadId: string): Promise<TaskHistoryMessage[]> {
    const response = await this.sendRequest<ThreadReadResult>("thread/read", {
      threadId,
      includeTurns: true
    });

    if (typeof response.thread?.path === "string" && response.thread.path.length > 0) {
      try {
        const rolloutMessages = await readMessagesFromRollout(response.thread.path);
        if (rolloutMessages.length > 0) {
          return rolloutMessages;
        }
      } catch {
        // Fall back to thread/read turns when rollout parsing is unavailable.
      }
    }

    const turns = Array.isArray(response.thread?.turns) ? response.thread.turns : [];
    return flattenTurns(turns);
  }

  private async sendRequest<TResult>(method: string, params: Record<string, unknown>): Promise<TResult> {
    const socket = new (globalThis as { WebSocket: new (url: string) => WebSocketLike }).WebSocket(this.serverUrl);

    return await new Promise<TResult>((resolve, reject) => {
      let isSettled = false;
      let requestCounter = 0;
      const initializeRequestId = ++requestCounter;
      const methodRequestId = ++requestCounter;

      const settle = (callback: () => void) => {
        if (isSettled) {
          return;
        }

        isSettled = true;
        callback();
        socket.close();
      };

      socket.addEventListener("open", () => {
        socket.send(
          JSON.stringify({
            id: initializeRequestId,
            method: "initialize",
            params: {
              clientInfo: {
                name: "codex_scheduler_backend",
                version: "0.1.0"
              }
            }
          })
        );
      });

      socket.addEventListener("message", (event) => {
        try {
          const payload = parseJsonRpcMessage(String(event.data));

          if (payload.error) {
            const errorMessage = payload.error.message ?? `App Server ${method} request failed.`;
            settle(() => reject(new Error(errorMessage)));
            return;
          }

          if (payload.id === initializeRequestId) {
            socket.send(JSON.stringify({ method: "initialized", params: {} }));
            socket.send(JSON.stringify({ id: methodRequestId, method, params }));
            return;
          }

          if (payload.id === methodRequestId) {
            settle(() => resolve((payload.result ?? {}) as TResult));
          }
        } catch (error) {
          settle(() => reject(error));
        }
      });

      socket.addEventListener("error", () => {
        settle(() => reject(new Error(`Failed to connect to Codex App Server at ${this.serverUrl}.`)));
      });

      socket.addEventListener("close", () => {
        if (!isSettled) {
          isSettled = true;
          reject(new Error(`Codex App Server connection closed before ${method} completed.`));
        }
      });
    }).catch((error) => {
      throw new AppError(502, error instanceof Error ? error.message : String(error));
    });
  }
}

type WebSocketLike = {
  send(data: string): void;
  close(): void;
  addEventListener(type: "open", listener: () => void): void;
  addEventListener(type: "message", listener: (event: { data: unknown }) => void): void;
  addEventListener(type: "error", listener: () => void): void;
  addEventListener(type: "close", listener: () => void): void;
};
