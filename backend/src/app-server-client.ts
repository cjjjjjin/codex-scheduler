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

type AppServerNotification = {
  method: string;
  params: unknown;
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

export class AppServerSession {
  private requestCounter = 1;
  private isClosed = false;
  private readonly listeners = new Set<(notification: AppServerNotification) => void>();
  private readonly pending = new Map<
    number,
    {
      resolve: (value: unknown) => void;
      reject: (error: Error) => void;
    }
  >();

  constructor(private readonly socket: WebSocketLike) {
    socket.addEventListener("message", (event) => {
      try {
        const payload = parseJsonRpcMessage(String(event.data));
        if (payload.id !== undefined && payload.id !== null) {
          const requestId = Number(payload.id);
          const pending = this.pending.get(requestId);
          if (!pending) {
            return;
          }

          this.pending.delete(requestId);
          if (payload.error) {
            pending.reject(new Error(payload.error.message ?? "App Server request failed."));
            return;
          }

          pending.resolve(payload.result);
          return;
        }

        if (typeof payload.method === "string") {
          const notification = {
            method: payload.method,
            params: payload.params
          };

          for (const listener of this.listeners) {
            listener(notification);
          }
        }
      } catch (error) {
        this.rejectAll(error instanceof Error ? error : new Error(String(error)));
      }
    });

    socket.addEventListener("error", () => {
      this.rejectAll(new Error("Codex App Server connection error."));
    });

    socket.addEventListener("close", () => {
      this.rejectAll(new Error("Codex App Server connection closed unexpectedly."));
    });
  }

  request<TResult>(method: string, params: Record<string, unknown> = {}): Promise<TResult> {
    if (this.isClosed) {
      return Promise.reject(new Error("Codex App Server session is closed."));
    }

    const id = ++this.requestCounter;
    const promise = new Promise<TResult>((resolve, reject) => {
      this.pending.set(id, {
        resolve: (value) => resolve((value ?? {}) as TResult),
        reject
      });
    });

    this.socket.send(JSON.stringify({ id, method, params }));
    return promise;
  }

  onNotification(listener: (notification: AppServerNotification) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  close(): void {
    if (this.isClosed) {
      return;
    }

    this.isClosed = true;
    this.socket.close();
  }

  private rejectAll(error: Error): void {
    if (this.isClosed) {
      return;
    }

    this.isClosed = true;
    for (const pending of this.pending.values()) {
      pending.reject(error);
    }
    this.pending.clear();
    this.listeners.clear();
  }
}

export class AppServerClient {
  constructor(private readonly serverUrl: string) {}

  async withSession<TResult>(callback: (session: AppServerSession) => Promise<TResult>): Promise<TResult> {
    const socket = new (globalThis as { WebSocket: new (url: string) => WebSocketLike }).WebSocket(this.serverUrl);

    const session = await new Promise<AppServerSession>((resolve, reject) => {
      let settled = false;

      const settle = (handler: () => void) => {
        if (settled) {
          return;
        }

        settled = true;
        handler();
      };

      socket.addEventListener("open", () => {
        socket.send(
          JSON.stringify({
            id: 1,
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
          if (payload.id !== 1) {
            return;
          }

          if (payload.error) {
            const errorMessage = payload.error.message ?? "Failed to initialize Codex App Server.";
            settle(() => reject(new Error(errorMessage)));
            return;
          }

          socket.send(JSON.stringify({ method: "initialized", params: {} }));
          settle(() => resolve(new AppServerSession(socket)));
        } catch (error) {
          settle(() => reject(error instanceof Error ? error : new Error(String(error))));
        }
      });

      socket.addEventListener("error", () => {
        settle(() => reject(new Error(`Failed to connect to Codex App Server at ${this.serverUrl}.`)));
      });

      socket.addEventListener("close", () => {
        settle(() => reject(new Error("Codex App Server connection closed during initialization.")));
      });
    });

    try {
      return await callback(session);
    } finally {
      session.close();
    }
  }

  async request<TResult>(method: string, params: Record<string, unknown>): Promise<TResult> {
    return this.withSession((session) => session.request<TResult>(method, params));
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
