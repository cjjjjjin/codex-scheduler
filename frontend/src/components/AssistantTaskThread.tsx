import { useEffect, useMemo, useState } from "react";

import { AssistantRuntimeProvider, ThreadPrimitive, useLocalRuntime, useMessage, useThread, type ChatModelAdapter, type ThreadMessage, type ThreadMessageLike } from "@assistant-ui/react";
import { Thread, makeMarkdownText } from "@assistant-ui/react-ui";

import { api } from "../api/client";
import type { Task, TaskHistoryMessage, TaskSessionMeta } from "../types";

type AssistantTaskThreadProps = {
  task: Task;
  onMetaChange: (taskId: string, meta: TaskSessionMeta) => void;
};

const MarkdownText = makeMarkdownText();

function formatTime(value: Date | undefined) {
  if (!value) {
    return "time unknown";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(value);
}

function AssistantMessageFooter({ task }: { task: Task }) {
  const status = useMessage((state) => state.status);
  const createdAt = useMessage((state) => state.createdAt);
  const statusLabel = status?.type === "running" ? "responding" : "completed";

  return (
    <div className="task-assistant-footer">
      <span className="task-assistant-footer-pill">thread session</span>
      <span className="task-assistant-footer-pill task-card-mono">{task.thread_id.slice(0, 12)}</span>
      <span className="task-assistant-footer-meta">{statusLabel}</span>
      <span className="task-assistant-footer-meta">{formatTime(createdAt)}</span>
    </div>
  );
}

function TaskWelcome({ task }: { task: Task }) {
  const suggestions = task.enabled
    ? [
        "현재 Task 목적을 한 줄로 요약해줘",
        "다음 스케줄 실행 전에 점검할 항목을 정리해줘",
        "이 Task의 prompt를 더 명확하게 다듬어줘"
      ]
    : [
        "이 Task를 다시 활성화하기 전에 확인할 점을 정리해줘",
        "현재 prompt를 유지한 채 더 안전한 실행 전략을 제안해줘",
        "비활성 Task 상태에서 검토할 체크리스트를 만들어줘"
      ];

  return (
    <ThreadPrimitive.Empty>
      <section className="task-thread-welcome">
        <div className="task-thread-welcome-copy">
          <p className="stack-label">Thread Session</p>
          <h3>{task.prompt}</h3>
          <p>이 대화는 Task의 기존 thread를 그대로 사용합니다. scheduler 상태와 관계없이 같은 Codex context를 이어서 사용할 수 있습니다.</p>
        </div>

        <div className="task-thread-welcome-facts">
          <div className="task-thread-fact">
            <span className="task-card-meta-label">Schedule</span>
            <code>{task.schedule}</code>
          </div>
          <div className="task-thread-fact">
            <span className="task-card-meta-label">Status</span>
            <strong>{task.enabled ? "scheduler enabled" : "scheduler paused"}</strong>
          </div>
          <div className="task-thread-fact task-thread-fact-wide">
            <span className="task-card-meta-label">Thread</span>
            <p className="task-card-mono" title={task.thread_id}>{task.thread_id}</p>
          </div>
        </div>

        <div className="task-thread-suggestions">
          {suggestions.map((prompt) => (
            <ThreadPrimitive.Suggestion key={prompt} className="task-thread-suggestion" prompt={prompt} method="replace" autoSend>
              {prompt}
            </ThreadPrimitive.Suggestion>
          ))}
        </div>
      </section>
    </ThreadPrimitive.Empty>
  );
}

function toMessageText(message: ThreadMessage) {
  if (!Array.isArray(message.content)) {
    return "";
  }

  return message.content
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n\n");
}

function toInitialThreadMessage(message: TaskHistoryMessage): ThreadMessageLike {
  return {
    id: message.id,
    role: message.role,
    createdAt: message.created_at ? new Date(message.created_at) : new Date(),
    content: message.text
  };
}

function TaskThreadMetaSync({ taskId, onMetaChange }: Pick<AssistantTaskThreadProps, "onMetaChange"> & { taskId: string }) {
  const messageCount = useThread((state) => state.messages.filter((message) => message.role === "assistant" || message.role === "user").length);
  const lastMessageAt = useThread((state) => {
    const lastMessage = [...state.messages]
      .reverse()
      .find((message) => message.role === "assistant" || message.role === "user");

    return lastMessage?.createdAt instanceof Date ? lastMessage.createdAt.toISOString() : null;
  });

  useEffect(() => {
    onMetaChange(taskId, {
      message_count: messageCount,
      last_message_at: lastMessageAt
    });
  }, [lastMessageAt, messageCount, onMetaChange, taskId]);

  return null;
}

function TaskThreadRuntime({ task, onMetaChange, initialMessages }: AssistantTaskThreadProps & { initialMessages: ThreadMessageLike[] }) {
  const model = useMemo<ChatModelAdapter>(
    () => ({
      async run({ messages: threadMessages, abortSignal }) {
        const userMessage = [...threadMessages].reverse().find((message) => message.role === "user");
        const text = userMessage ? toMessageText(userMessage) : "";
        const response = await api.sendTaskMessage(task.id, text, abortSignal);

        return {
          content: [
            {
              type: "text",
              text: response.response_text ?? "응답은 완료되었지만 텍스트 출력이 비어 있습니다."
            }
          ]
        };
      }
    }),
    [task.id]
  );

  const runtime = useLocalRuntime(model, { initialMessages });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <TaskThreadMetaSync taskId={task.id} onMetaChange={onMetaChange} />
      <div className="task-session-shell">
        <Thread
          assistantAvatar={{ fallback: "C" }}
          welcome={{
            message: `Task \"${task.prompt}\"에 연결된 Codex thread입니다. 이 창에서 같은 thread를 계속 사용합니다.`,
            suggestions: [
              {
                prompt: "현재 Task 목적을 한 줄로 요약해줘"
              },
              {
                prompt: "다음 스케줄 실행 전에 확인할 점을 정리해줘"
              }
            ]
          }}
          composer={{ allowAttachments: false }}
          userMessage={{ allowEdit: false }}
          assistantMessage={{
            allowCopy: true,
            allowReload: false,
            allowSpeak: false,
            allowFeedbackPositive: false,
            allowFeedbackNegative: false,
            components: {
              Text: MarkdownText,
              Footer: () => <AssistantMessageFooter task={task} />
            }
          }}
          components={{
            ThreadWelcome: () => <TaskWelcome task={task} />
          }}
          strings={{
            thread: {
              scrollToBottom: {
                tooltip: "맨 아래로 이동"
              }
            },
            composer: {
              send: {
                tooltip: "전송"
              },
              cancel: {
                tooltip: "중단"
              },
              input: {
                placeholder: "Codex에게 바로 물어보세요. 이 Task의 thread context를 이어서 사용합니다."
              }
            }
          }}
        />
      </div>
    </AssistantRuntimeProvider>
  );
}

export function AssistantTaskThread(props: AssistantTaskThreadProps) {
  const [initialMessages, setInitialMessages] = useState<ThreadMessageLike[] | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    setInitialMessages(null);
    setHistoryError(null);

    api
      .getTaskMessages(props.task.id)
      .then((response) => {
        if (!isCancelled) {
          setInitialMessages(response.messages.map(toInitialThreadMessage));
        }
      })
      .catch((error) => {
        if (!isCancelled) {
          setHistoryError(error instanceof Error ? error.message : String(error));
          setInitialMessages([]);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [props.task.id]);

  if (initialMessages === null) {
    return <div className="task-session-shell">Thread history loading...</div>;
  }

  return (
    <>
      {historyError ? <div className="task-thread-history-error">{historyError}</div> : null}
      <TaskThreadRuntime key={props.task.id} {...props} initialMessages={initialMessages} />
    </>
  );
}
