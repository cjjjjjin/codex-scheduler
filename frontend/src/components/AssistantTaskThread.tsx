import { useEffect, useMemo } from "react";

import { AssistantRuntimeProvider, ThreadPrimitive, useLocalRuntime, useThread, type ChatModelAdapter, type ThreadMessage, type ThreadMessageLike } from "@assistant-ui/react";
import { Thread } from "@assistant-ui/react-ui";

import { api } from "../api/client";
import type { ChatMessage, Task } from "../types";

type AssistantTaskThreadProps = {
  task: Task;
  messages: ChatMessage[];
  onSyncMessages: (taskId: string, messages: ChatMessage[]) => void;
};

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

function toThreadMessages(messages: ChatMessage[]): ThreadMessageLike[] {
  return messages.map((message) => ({
    id: message.id,
    role: message.role,
    createdAt: new Date(message.created_at),
    content: [
      {
        type: "text",
        text: message.content
      }
    ]
  }));
}

function toMessageText(message: ThreadMessage | ThreadMessageLike) {
  if (!Array.isArray(message.content)) {
    return "";
  }

  return message.content
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n\n");
}

function toChatMessage(message: ThreadMessage | ThreadMessageLike): ChatMessage {
  return {
    id: message.id ?? crypto.randomUUID(),
    role: message.role === "assistant" ? "assistant" : "user",
    content: toMessageText(message),
    created_at: (message.createdAt instanceof Date ? message.createdAt : new Date()).toISOString()
  };
}

function ThreadStateSync({ taskId, onSyncMessages }: Pick<AssistantTaskThreadProps, "onSyncMessages"> & { taskId: string }) {
  const threadMessages = useThread((state) => state.messages);

  useEffect(() => {
    onSyncMessages(
      taskId,
      threadMessages
        .filter((message) => message.role === "assistant" || message.role === "user")
        .map((message) => toChatMessage(message))
    );
  }, [onSyncMessages, taskId, threadMessages]);

  return null;
}

function TaskThreadRuntime({ task, messages, onSyncMessages }: AssistantTaskThreadProps) {
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

  const runtime = useLocalRuntime(model, {
    initialMessages: toThreadMessages(messages)
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ThreadStateSync taskId={task.id} onSyncMessages={onSyncMessages} />
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
            allowFeedbackNegative: false
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
  return <TaskThreadRuntime key={props.task.id} {...props} />;
}
