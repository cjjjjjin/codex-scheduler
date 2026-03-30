# Codex SDK 분석

조사일: 2026-03-27

## 요약

`Codex SDK` 는 OpenAI가 제공하는 TypeScript 라이브러리이며, 로컬 Codex agent를 애플리케이션 코드에서 직접 제어하는 용도에 맞는다.

현재 `codex-scheduler` 의 요구사항인 아래 항목과 가장 직접적으로 맞물린다.

- Task 생성 시 새로운 thread 생성
- 생성된 `thread_id` 저장
- 스케줄 시점에 같은 `thread_id` 를 재개해서 prompt 전달
- backend 내부 서비스 계층에서 직접 Codex 호출

공식 문서와 공개 프로젝트 사례를 함께 보면, 이 프로젝트에는 `Codex App Server` 보다 `Codex SDK` 가 더 적합하다.

## 공식 문서 기준 정의

OpenAI 공식 문서 기준 `Codex SDK` 는 다음 성격을 가진다.

- local Codex agents 를 programmatically control 하는 TypeScript library
- CI/CD, 내부 도구, 애플리케이션 통합, server-side workflow 용도에 적합
- Node.js 18+ 환경을 요구
- 지속 대화 단위는 `thread`
- 지속 식별자는 `threadId`

공식 기본 사용 흐름:

```ts
import { Codex } from "@openai/codex-sdk";

const codex = new Codex();
const thread = codex.startThread();
const result = await thread.run("Make a plan to diagnose and fix the CI failures");
```

재개 흐름:

```ts
const threadId = "<thread-id>";
const thread = codex.resumeThread(threadId);
const result = await thread.run("Pick up where you left off");
```

즉, 우리 프로젝트에서 영속 저장해야 하는 핵심 값은 `session_id` 보다는 `thread_id` 로 해석하는 편이 정확하다.

## `codex-scheduler` 와의 직접 매핑

현재 `SPEC.md` 기준 `Task` 는 아래 정보를 가진다.

- 스케줄
- Codex thread ID
- Prompt
- Enable 여부
- workspace directory

Codex SDK 기준으로 매핑하면 다음과 같다.

- `Task.thread_id` = Codex SDK의 `thread.id`
- Task 생성 시 `codex.startThread(options)` 호출
- 반환된 `thread.id` 저장
- 스케줄 실행 시 `codex.resumeThread(threadId, options)` 호출
- 이후 `runStreamed(prompt)` 또는 `run(prompt)` 실행

이 매핑은 현재 명세와 거의 1:1 대응이다.

## App Server와 비교

OpenAI 공식 자료 기준으로 두 방식의 차이는 분명하다.

### Codex SDK가 더 적합한 경우

- backend가 주기적으로 자동 작업을 실행
- 사용자가 항상 붙어 있지 않아도 동작해야 함
- 같은 thread를 저장 후 재개해야 함
- Express 서비스 내부에서 직접 Codex를 호출하고 싶음
- JSON-RPC client를 별도로 만들고 싶지 않음

### Codex App Server가 더 적합한 경우

- rich client 통합이 핵심
- item/turn/thread 이벤트를 UI에서 세밀하게 렌더링해야 함
- 승인 UI, diff UI, streaming 상태 표시가 핵심 기능임
- 장기 프로세스와 프로토콜 레이어를 직접 관리할 수 있음

현재 `codex-scheduler` 는 scheduler/backend automation 성격이므로 SDK 쪽이 더 자연스럽다.

## 공개 프로젝트 조사에서 확인된 패턴

상세 사례는 `doc/CODEX_SDK_PROJECT_RESEARCH.md` 참고.

공통 패턴만 요약하면 다음과 같다.

### 1. `threadId` 영속 저장이 중심

- 실사용 프로젝트들은 thread를 지속 세션의 실체로 다룬다.
- 메모리 캐시를 쓰더라도 결국 외부 저장소에 `thread.id` 를 전달하거나 저장한다.

### 2. `runStreamed()` 사용 빈도가 높다

- 공식 예시는 `run()` 이 단순하지만, 실전 코드는 `runStreamed()` 를 더 자주 사용한다.
- 이유는 완료 시점, 에러, tool 실행, 파일 변경, reasoning 등의 이벤트를 구조적으로 다룰 수 있기 때문이다.

### 3. SDK 호출과 앱 로직 사이에 provider/service 계층이 있다

- SDK 이벤트를 그대로 API/UI에 노출하지 않는다.
- 별도 계층에서 내부 이벤트 또는 실행 결과 모델로 매핑한다.

### 4. `resumeThread()` 실패 정책이 중요하다

- 일부 프로젝트는 새 thread fallback 을 두지만
- 우리 프로젝트처럼 문맥 지속이 요구사항인 경우에는 조용한 fallback 이 위험할 수 있다.

## 이 프로젝트에 주는 시사점

### 장점

- Task 생성 시 thread 생성 후 저장이라는 흐름이 단순하다.
- 스케줄 실행 시 저장된 `thread_id` 로 재개하면 된다.
- Node.js + Express backend 와 기술 스택이 자연스럽게 맞는다.
- App Server처럼 별도 프로토콜 계층을 만들 필요가 적다.

### 주의점

- `thread.id` 가 `startThread()` 직후 즉시 안정적으로 읽히는지 실동작 검증이 필요하다.
- 일부 구현은 `thread.started` 이벤트에서 ID를 확정적으로 취급한다.
- `resumeThread()` 실패 시 자동 새 thread 발급은 명세상 의미가 달라질 수 있다.
- `run()` 만 사용할 경우, 세밀한 실행 이력이나 실패 원인 기록이 약해질 수 있다.

## 권장 구현 방향

현재 명세와 코드베이스 방향을 기준으로 한 권장안은 아래와 같다.

### 1. backend는 Node.js + Express 내부에서 SDK를 직접 사용

- 별도 bridge 프로세스보다 현재 구조에 더 잘 맞는다.
- Codex 호출은 Express route 계층이 아니라 service 계층으로 분리한다.

### 2. DB에는 `thread_id` 를 영속 저장

- 과거 `session_id` 표현보다 `thread_id` 가 정확하다.
- Task 생성 후 시스템이 관리하는 식별자 값으로 취급한다.

### 3. 스케줄 실행은 `resumeThread(threadId, options)` 기준

- `workingDirectory` 는 Task의 `workspace_directory` 에서 가져온다.
- `enable=false` 인 Task는 아예 실행 대상에서 제외한다.

### 4. 가능하면 `runStreamed()` 우선

- 최소한 아래 이벤트는 내부적으로 구분해서 다루는 것이 좋다.
  - `thread.started`
  - `item.completed`
  - `turn.completed`
  - `turn.failed`
  - `error`

### 5. resume 실패는 명시적 실패로 기록

- 1차 버전에서는 자동 새 thread 대체보다 실행 실패 기록이 더 안전하다.
- 그래야 "같은 thread에 prompt를 전달한다"는 요구사항과 충돌하지 않는다.

## 권장 서비스 계층 초안

아래 인터페이스는 구현 방향을 설명하기 위한 초안이다.

```ts
export interface CodexThreadCreationResult {
  threadId: string;
}

export interface CodexRunRequest {
  threadId: string;
  prompt: string;
  workspaceDirectory: string;
}

export interface CodexRunEvent {
  type: "thread.started" | "item.completed" | "turn.completed" | "turn.failed" | "error";
  payload: unknown;
  occurredAt: string;
}

export interface CodexRunResult {
  success: boolean;
  threadId: string;
  events: CodexRunEvent[];
  errorMessage?: string;
}

export interface CodexService {
  createThread(workspaceDirectory: string): Promise<CodexThreadCreationResult>;
  runScheduledPrompt(request: CodexRunRequest): Promise<CodexRunResult>;
}
```

의도:

- API 계층과 scheduler는 `CodexService` 만 알도록 한다.
- SDK 호출 세부 구현은 service 내부에 캡슐화한다.
- 나중에 테스트용 mock service를 붙이기 쉬워진다.

## 구현 흐름 초안

### Task 생성 시

1. API가 `schedule`, `prompt` 입력을 받음
2. 1차 버전에서는 `workspace_directory` 를 시스템 기본값으로 결정
3. `CodexService.createThread(workspaceDirectory)` 호출
4. service 내부에서 `codex.startThread(options)` 호출
5. 반환된 `thread.id` 저장
6. DB에 Task 생성

예시:

```ts
const codex = new Codex();
const thread = codex.startThread({
  workingDirectory: workspaceDirectory,
  skipGitRepoCheck: true,
});

if (!thread.id) {
  throw new Error("Thread ID was not returned");
}
```

### 스케줄 실행 시

1. scheduler가 실행 대상 Task 조회
2. 각 Task에 대해 `CodexService.runScheduledPrompt(...)` 호출
3. service 내부에서 `resumeThread(threadId, options)` 호출
4. `runStreamed(prompt)` 실행
5. 성공/실패 및 핵심 이벤트를 `execution_history` 에 기록

예시:

```ts
const thread = codex.resumeThread(threadId, {
  workingDirectory: workspaceDirectory,
  skipGitRepoCheck: true,
});

const streamed = await thread.runStreamed(prompt);

for await (const event of streamed.events) {
  // 핵심 이벤트만 정규화해서 기록
}
```

## 실행 이력 기록 권장안

1차 버전에서는 모든 세부 이벤트를 DB에 저장할 필요는 없다.

최소 권장 기록:

- `task_id`
- `thread_id`
- 실행 당시 `prompt`
- `scheduled_for`
- `executed_at`
- `status`
- `error_message`

추가로 로그 또는 확장 컬럼으로 남길 가치가 있는 것:

- `turn.completed` 시 usage
- 마지막 agent message 일부 요약
- command execution / file change / MCP tool call 요약

## 현재 구현 상태 메모

현재 backend 구현을 보면 `workspace_directory` 의 서비스 연결은 이미 일부 반영되어 있다.

- `CodexService.createThread()` 는 `startThread({ workingDirectory })` 를 사용한다.
- `CodexService.sendPrompt()` 는 `resumeThread(threadId, { workingDirectory })` 를 사용한다.
- scheduler 는 실행 시 `task.workspace_directory` 를 그대로 service에 전달한다.

다만 Task 생성 플로우는 아직 완전히 Task별 workspace 입력형으로 열려 있지 않다.

- `TaskService.createTask()` 는 현재 `DEFAULT_WORKSPACE_DIRECTORY` 를 사용해 thread를 생성한다.
- DB에도 같은 기본값을 저장한다.
- 즉, "Task별 workspace 지원을 위한 저장/실행 경로" 는 이미 있으나,
  "사용자가 Task별 workspace를 지정하는 API/UI" 는 아직 열리지 않은 상태다.

따라서 현 시점 판단은 아래가 적절하다.

- Codex SDK 연동 구조 자체는 `workspace_directory` 를 수용할 준비가 되어 있다.
- 다만 현재 명세상 Task 생성 입력은 `schedule`, `prompt` 중심이므로
  1차 버전에서는 `workspace_directory` 를 시스템 기본값으로 유지하는 해석이 자연스럽다.
- 즉, 남은 일은 "즉시 입력 필드로 노출" 이라기보다 "시스템 관리 필드로 유지할지, 추후 사용자 설정으로 열지" 정책을 명시하는 것이다.

## 당장 적용할 것과 미룰 것

### 당장 적용할 것

- `thread_id` 중심 데이터 모델
- `CodexService` 분리
- `workspace_directory` 기반 실행
- `resumeThread()` 기반 scheduler 실행
- resume 실패 시 명시적 실패 기록

### 미뤄도 되는 것

- interactive approval UX
- 메신저/외부 플랫폼 브리지
- multi-assistant abstraction
- 채팅 UI용 스트리밍 포맷
- 자동 fresh thread fallback

## 런타임 검증 포인트

구현 전에 또는 구현 직후 실제 SDK로 확인해야 하는 항목:

1. `startThread()` 직후 `thread.id` 를 즉시 읽을 수 있는가
2. 아니면 `thread.started` 이벤트 이후에만 확정되는가
3. `resumeThread(threadId, options)` 에서 `workingDirectory` 를 매번 넘겨도 일관되게 동작하는가
4. `runStreamed()` 에서 정상 완료 시 `turn.completed` 가 항상 오는가
5. 실패 시 예외 throw 와 `turn.failed` 이벤트 중 어느 경로가 실제 주 경로인가
6. `skipGitRepoCheck` 없이도 운영 환경에서 문제가 없는가

## 결론

- `Codex SDK` 는 `codex-scheduler` 의 요구사항과 가장 직접적으로 맞는 공식 연동 수단이다.
- 이 프로젝트에서 영속 저장해야 하는 지속 식별자는 `threadId` 이며, 스키마와 API에서도 `thread_id` 용어를 쓰는 편이 맞다.
- 구현은 Node.js + Express backend 내부 service 계층에서 SDK를 직접 호출하는 방향이 가장 단순하다.
- 1차 버전에서는 `createThread` + `resumeThread` + `runStreamed` + 실행 이력 기록 조합이 가장 현실적이다.

## 참고 자료

- OpenAI Developers, Codex SDK
  - https://developers.openai.com/codex/sdk
- OpenAI Developers, Codex App Server
  - https://developers.openai.com/codex/app-server
- OpenAI Blog, Unlocking the Codex harness: how we built the App Server
  - https://openai.com/index/unlocking-the-codex-harness/
- 공개 프로젝트 조사 문서
  - `/home/munchkin/workspace/codex-scheduler/doc/CODEX_SDK_PROJECT_RESEARCH.md`
