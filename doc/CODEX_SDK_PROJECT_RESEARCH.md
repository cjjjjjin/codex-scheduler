# Codex SDK 사용 프로젝트 조사

조사일: 2026-03-27

## 목적

이 문서는 `@openai/codex-sdk` 를 실제로 사용하는 공개 프로젝트 사례를 조사하고, `codex-scheduler` 에 참고할 수 있는 구현 패턴을 정리하기 위한 문서이다.

검토 기준:

- OpenAI 공식 Codex SDK 문서
- 공개 GitHub 저장소의 실제 사용 코드

## 공식 문서 기준 전제

OpenAI 공식 문서에 따르면 `Codex SDK` 는 아래 용도로 쓰는 것이 권장된다.

- CI/CD 파이프라인 제어
- 자체 agent 구현
- 내부 도구/워크플로우 통합
- 애플리케이션 내부 통합

또한 문서상 핵심 사용 흐름은 다음과 같다.

- `new Codex()`
- `codex.startThread()`
- `thread.run(...)`
- `codex.resumeThread(threadId)`

즉, 공개 프로젝트를 볼 때도 대부분 아래 두 축으로 수렴한다.

1. 새 thread 생성 후 ID 저장
2. 나중에 같은 thread ID로 재개하며 스트리밍 결과를 UI 또는 외부 시스템으로 변환

## 조사 대상 프로젝트

### 1. Daytona

저장소:

- https://github.com/daytonaio/daytona

확인 파일:

- https://github.com/daytonaio/daytona/blob/f17c1afd9bb21b6131e5b315f513514abe0101cb/guides/typescript/openai/codex-sdk/agent/index.ts

프로젝트 용도:

- AI가 생성한 코드를 안전한 sandbox/infrastructure 환경에서 실행하기 위한 플랫폼
- Codex SDK는 그 sandbox 안에서 실제 coding agent를 실행하는 예제/통합 방식으로 사용됨

관찰 내용:

- Codex SDK를 sandbox 내부 Node.js agent 예제로 사용한다.
- `new Codex({ apiKey, env: {} })` 형태로 인스턴스를 생성한다.
- thread ID를 `/tmp/codex-thread-id` 파일에 저장해 다음 실행에서 재사용한다.
- `threadId` 가 있으면 `resumeThread(threadId, options)`, 없으면 `startThread(options)` 를 호출한다.
- 실행은 `runStreamed()` 로 처리하고, `item.completed`, `turn.completed` 이벤트를 순회하며 출력 문자열로 변환한다.
- `workingDirectory`, `skipGitRepoCheck`, `sandboxMode` 를 thread 옵션으로 명시한다.

시사점:

- 우리 프로젝트의 `Task.thread_id` 저장 방식과 거의 직접적으로 맞는다.
- scheduler가 DB에 `thread_id` 를 저장하고, 실행 시 `resumeThread(threadId, options)` 를 호출하는 구조가 가장 자연스럽다.
- 실행 이력에 usage, command/file change 요약을 남기고 싶다면 이벤트 단위 매핑 계층이 필요하다.

### 2. Eclipse Theia

저장소:

- https://github.com/eclipse-theia/theia

확인 파일:

- https://github.com/eclipse-theia/theia/blob/4ef126fca6dbb6970e87d9d7749c599c4fcfe116/packages/ai-codex/src/node/codex-service-impl.ts

프로젝트 용도:

- 클라우드/데스크톱 IDE를 만들기 위한 TypeScript 기반 IDE framework
- Codex SDK는 IDE backend에서 Codex 대화와 스트리밍 응답을 제공하는 AI integration layer로 사용됨

관찰 내용:

- IDE framework backend에서 Codex SDK를 직접 붙인다.
- ESM 호환을 위해 `import('@openai/codex-sdk')` 를 동적으로 로드한다.
- `sessionThreads` 맵으로 thread 객체를 메모리에 캐시한다.
- 새 요청이면 `startThread(request.options)`, 기존 세션이면 기존 thread를 재사용한다.
- `runStreamed(request.prompt)` 결과 이벤트를 클라이언트 토큰 스트림으로 전달한다.
- `AbortController` 로 취소를 처리한다.

시사점:

- long-lived backend 프로세스에서는 thread 객체 캐시 전략이 가능하다.
- 하지만 재시작 복구가 필요한 scheduler 성격에서는 thread 객체 캐시보다 `thread.id` 영속 저장이 더 중요하다.
- streaming 지원이 필요해지면 backend service 계층과 transport 계층을 분리하는 방식이 유효하다.

### 3. remote-agentic-coding-system

저장소:

- https://github.com/coleam00/remote-agentic-coding-system

확인 파일:

- https://github.com/coleam00/remote-agentic-coding-system/blob/ad60e90631bd73296d22ffbf730cc38096cf2f05/src/clients/codex.ts

프로젝트 용도:

- Slack, Telegram, GitHub 등 외부 채널에서 원격 coding agent를 제어하기 위한 시스템
- Codex SDK는 여러 agent backend 중 하나로 붙어, 원격 메시지를 Codex 실행으로 연결하는 client wrapper 역할을 함

관찰 내용:

- 공통 AI client 인터페이스 뒤에 Codex SDK wrapper를 둔다.
- ESM-only 패키지 대응을 위해 동적 import를 사용한다.
- `resumeThread(resumeSessionId, { workingDirectory, skipGitRepoCheck: true })` 실패 시 새 thread 생성으로 fallback 한다.
- `runStreamed(prompt)` 이벤트를 읽으며 `agent_message`, `command_execution`, `reasoning`, `turn.failed`, `turn.completed` 를 자체 메시지 포맷으로 변환한다.
- `turn.completed` 시 `thread.id` 를 반환해 외부 저장소가 session/thread ID를 영속화할 수 있게 한다.

시사점:

- 재개 실패 시 새 thread 생성 fallback 정책은 운영 안정성 측면에서 참고할 가치가 있다.
- 우리 프로젝트도 `thread_id` 가 유효하지 않을 때 실패 기록만 남길지, 새 thread를 자동 발급할지 정책 결정을 분리해야 한다.
- 현재 명세상 자동 대체 thread 생성은 명시되지 않았으므로 1차 버전에서는 실패 기록 후 운영자 개입 쪽이 더 안전하다.

### 4. Claude-to-IM-skill

저장소:

- https://github.com/op7418/Claude-to-IM-skill

확인 파일:

- https://github.com/op7418/Claude-to-IM-skill/blob/536908f5e9bd65a151ca4cb4b08d3fedc1a43b4d/src/codex-provider.ts

프로젝트 용도:

- Claude Code나 Codex 같은 coding agent를 Telegram, Discord, Feishu/Lark 같은 IM 플랫폼에 연결하는 브리지
- Codex SDK는 IM 대화 흐름을 Codex thread 실행으로 변환하는 provider로 사용됨

관찰 내용:

- Codex SDK를 선택 가능한 provider로 붙여서 Telegram, Discord, Lark 같은 IM 브리지에 연결한다.
- SDK를 optional dependency처럼 lazy import 한다.
- API key 우선순위, `baseUrl`, permission/approval policy, `workingDirectory`, `model`, `skipGitRepoCheck` 등을 thread 옵션으로 조합한다.
- 이미지 입력은 임시 파일로 변환해 `local_image` 입력으로 넘긴다.
- `thread.started` 이벤트에서 thread ID를 추출해 세션 맵에 저장한다.
- `item.completed` 를 SSE 이벤트 포맷으로 변환해 상위 시스템으로 전달한다.
- resume 실패 메시지를 검사해 fresh thread 재시도 여부를 결정한다.

시사점:

- thread ID가 `thread.started` 이벤트에서 확보될 수 있다는 점은 실동작 검증 포인트로 중요하다.
- provider 계층을 두면 scheduler 외에 수동 실행, 테스트 실행 같은 다른 호출 경로도 같은 Codex service를 재사용할 수 있다.
- 다양한 옵션을 Task 수준에서 열어두고 싶어질 수 있지만, 현재 `SPEC.md` 범위를 넘기므로 1차 버전에서는 `workingDirectory` 정도만 우선 고려하는 편이 적절하다.

### 5. Plannotator

저장소:

- https://github.com/backnotprop/plannotator

확인 파일:

- https://github.com/backnotprop/plannotator/blob/9746344779607936272794286606cf5fe4612308/packages/ai/providers/codex-sdk.ts

프로젝트 용도:

- coding agent의 plan과 code diff를 시각적으로 검토하고 피드백하기 위한 UI/협업 도구
- Codex SDK는 내부 AI provider 중 하나로 사용되며, plan/review UI와 연결되는 세션 실행 backend 역할을 함

관찰 내용:

- Codex SDK를 범용 AI provider 계층 뒤에 연결한다.
- `resumeSession(sessionId)` 를 사실상 `resumeThread(threadId)` 로 해석한다.
- `startThread` / `resumeThread` 시 `model`, `workingDirectory`, `sandboxMode`, `modelReasoningEffort` 를 전달한다.
- `runStreamed()` 이벤트를 세밀하게 매핑해서 `text_delta`, `tool_use`, `tool_result`, `error` 등의 내부 메시지로 변환한다.
- `thread.started` 에서 실제 thread ID를 resolve 한다.
- 주석상으로도 Codex는 real fork 대신 fresh thread + preamble 방식이라고 명시한다.

시사점:

- session abstraction을 두더라도 내부 영속 식별자는 결국 `threadId` 로 귀결된다.
- 스케줄러 프로젝트에서는 full delta streaming까지는 필요 없지만, 최소한 `thread.started`, `turn.completed`, `turn.failed`, `error` 는 구조적으로 분리해 기록하는 편이 좋다.

## 공통 패턴 요약

## 프로젝트 용도별 분류

조사한 사례를 용도 기준으로 다시 묶으면 아래와 같다.

- 개발 인프라/샌드박스 실행기: Daytona
- IDE/에디터 통합: Eclipse Theia
- 원격 agent 제어 허브: remote-agentic-coding-system
- 메신저 브리지: Claude-to-IM-skill
- plan/review 협업 UI backend: Plannotator

즉, `Codex SDK` 는 단순 예제 수준이 아니라 다음 계열에서 실제로 쓰이고 있다.

- 개발자 도구 backend
- agent orchestration/bridge 레이어
- UI 제품의 AI 실행 백엔드
- sandbox 기반 코드 실행 환경

## 상세 분석

### 원격 agent orchestration

대표 사례:

- `remote-agentic-coding-system`

이 유형의 핵심 목적:

- 사용자가 IDE에 붙어 있지 않아도 원격 채널에서 coding agent를 제어할 수 있게 하는 것
- 여러 채널과 여러 agent backend를 하나의 orchestration 계층에서 통합하는 것
- 세션, 코드베이스, 작업 디렉터리, 커맨드 시스템을 중앙에서 관리하는 것

`remote-agentic-coding-system` README 기준 주요 특징:

- Telegram, GitHub 등 여러 플랫폼 입력 지원
- Claude Code, Codex 등 여러 assistant backend 지원
- 컨테이너 재시작 후에도 대화 문맥이 유지되는 persistent sessions
- GitHub 저장소 clone 및 작업 디렉터리 변경 지원
- slash command 기반의 사용자 정의 workflow 지원

구조적으로 보면 이 프로젝트에서 Codex SDK는 "주인공"이라기보다 "교체 가능한 실행 엔진 중 하나"다.

역할 분담:

- 플랫폼 어댑터: Telegram, GitHub webhook 등 외부 입력 수집
- 오케스트레이터: 대화 문맥, 코드베이스, 세션, 명령 라우팅 관리
- assistant client: Claude 또는 Codex 실제 실행
- DB: conversation, codebase, session 상태 영속 저장

Codex SDK가 맡는 역할:

- 프롬프트를 실제 Codex agent 실행으로 연결
- thread 생성/재개
- streaming event 수집
- thread ID를 상위 계층이 저장할 수 있게 반환

구현 파일 기준 특징:

- `CodexClient` 는 공통 `IAssistantClient` 인터페이스를 구현한다.
- `sendQuery(prompt, cwd, resumeSessionId?)` 형태로 orchestration 계층과 결합된다.
- `resumeThread()` 실패 시 새 thread 생성 fallback 을 둔다.
- `runStreamed()` 결과를 `assistant`, `tool`, `thinking`, `result` 같은 내부 청크 타입으로 변환한다.

이 패턴의 의미:

- 상위 시스템은 "Codex SDK를 안다"기보다 "assistant client를 안다"에 가깝다.
- Codex는 orchestration 시스템 안의 pluggable backend다.
- 핵심 가치는 Codex 자체보다 "채널 통합 + 세션 관리 + workflow orchestration" 에 있다.

`codex-scheduler` 와의 관계:

- 비슷한 점: thread ID 영속 저장, resume 기반 실행, backend 중심 동작
- 다른 점: `codex-scheduler` 는 다채널 상호작용이나 멀티-assistant orchestration이 아니라 scheduled execution 이 핵심
- 따라서 참고할 부분은 `thread.id` 저장 방식, assistant abstraction, resume 정책 정도다.

### 메신저 브리지

대표 사례:

- `Claude-to-IM-skill`

이 유형의 핵심 목적:

- 메신저를 AI coding agent의 대화 UI로 바꾸는 것
- 사용자는 Telegram, Discord, Lark, QQ, WeChat에서 채팅하듯 agent를 사용하고
- 실제 agent 실행은 로컬 daemon이 대신 처리하게 만드는 것

README 기준 구조:

- IM Bot API
- Node.js background daemon
- Claude Agent SDK 또는 Codex SDK
- 로컬 코드베이스

즉, 이 구조에서 메신저는 "입력/출력 채널"이고, Codex SDK는 "백엔드 실행기"다.

`Claude-to-IM-skill` 의 사용자 경험 특징:

- 메신저에서 질문/명령 전송
- agent의 스트리밍 응답을 채팅으로 수신
- tool 실행 권한 요청을 채팅 버튼 또는 텍스트 명령으로 승인/거부
- daemon 재시작 후에도 세션 지속

Codex SDK가 맡는 역할:

- IM 대화를 Codex thread 실행으로 변환
- thread 시작/재개
- `runStreamed()` 이벤트를 SSE 포맷으로 변환
- command execution, file change, MCP tool call, reasoning 같은 이벤트를 채팅 친화적인 형태로 매핑
- thread ID를 세션 맵에 저장

구현 파일 기준 특징:

- `CodexProvider` 는 `LLMProvider` 구현체다.
- SDK는 lazy import 하며 optional dependency처럼 취급된다.
- API key, base URL, approval policy, model, workingDirectory, skipGitRepoCheck 를 옵션으로 조합한다.
- 이미지 입력은 임시 파일로 만든 뒤 `local_image` 로 전달한다.
- `thread.started` 이벤트에서 `thread_id` 를 확보한다.
- `item.completed` 이벤트를 `tool_use`, `tool_result`, `text`, `status` 등 브리지용 SSE로 바꾼다.
- resume 실패 시 특정 오류 패턴이면 fresh thread 재시도 로직이 있다.

이 패턴의 의미:

- 핵심 가치는 "채팅 플랫폼을 agent UI로 바꾸는 것" 이다.
- orchestration 시스템보다 훨씬 UI/interaction 중심이다.
- permission flow, streaming preview, bot credential 관리, 사용자 승인 UX가 중요한 축이다.

`codex-scheduler` 와의 관계:

- 비슷한 점: Codex SDK를 backend 서비스처럼 사용하고, thread ID를 저장/재개한다.
- 다른 점: `codex-scheduler` 는 interactive UI나 승인 흐름이 없고, 메시지 브리징이 아니라 배치/자동 실행이 목적이다.
- 따라서 그대로 가져올 부분은 event mapping 방식, thread.started 에서 ID 확보하는 포인트, provider 계층 정도다.

### 둘의 차이 요약

- 원격 agent orchestration:
  - 초점은 "여러 채널/세션/코드베이스/assistant를 중앙에서 운영" 하는 것
  - Codex SDK는 orchestration 시스템 안의 backend plugin 역할에 가깝다

- 메신저 브리지:
  - 초점은 "메신저를 Codex의 사용자 인터페이스로 바꾸는 것"
  - Codex SDK는 채팅 입력을 agent turn으로 바꾸는 실시간 실행 엔진 역할에 가깝다

- 공통점:
  - 둘 다 `threadId` 저장과 `resumeThread()` 재개를 중심으로 한다
  - 둘 다 `runStreamed()` 를 선호한다
  - 둘 다 SDK 이벤트를 그대로 노출하지 않고 자체 포맷으로 변환한다

## `codex-scheduler` 적용 체크리스트

아래는 앞서 본 `원격 agent orchestration`, `메신저 브리지` 사례에서
`codex-scheduler` 가 가져올 만한 요소와 1차 범위에서 굳이 가져오지 않아도 되는 요소를 나눈 것이다.

### 가져올 것

#### 1. `threadId` 영속 저장

- Task 생성 시 thread 생성
- 생성된 `thread.id` 를 DB에 저장
- 이후 실행은 항상 저장된 `thread_id` 기준으로 재개

이유:

- 두 유형 모두 결국 지속 세션의 실체를 `threadId` 로 다룬다.
- 스케줄러도 메모리 객체보다 DB 저장 식별자가 기준이 되어야 재시작 복구가 가능하다.

#### 2. Codex service/provider 계층 분리

- scheduler 또는 API 계층이 SDK를 직접 알지 않게 한다.
- 예: `CodexService.createThread()`, `CodexService.runTask(threadId, prompt, workspaceDirectory)`

이유:

- 원격 orchestration과 메신저 브리지 모두 SDK를 별도 provider/client 계층 뒤에 둔다.
- 이후 수동 실행, 테스트 실행, dry-run, mock 구현을 붙이기 쉬워진다.

#### 3. `runStreamed()` 기반 실행

- 1차 버전에서도 가능하면 `run()` 보다 `runStreamed()` 우선 검토
- 최소 이벤트:
  - `thread.started`
  - `item.completed`
  - `turn.completed`
  - `turn.failed`
  - `error`

이유:

- 추후 실행 이력, 로그, 디버깅 품질이 좋아진다.
- command/file change/MCP call 같은 실행 흔적을 남길 수 있는 여지가 생긴다.

#### 4. 실행 옵션을 서비스 계층에서 일관되게 조립

- `workingDirectory`
- `skipGitRepoCheck`
- 필요 시 `model`, `sandboxMode`

이유:

- 메신저 브리지 사례처럼 옵션 조립 책임을 한 곳에 두면 정책 변경이 쉬워진다.
- 현재 명세상 Task별 핵심 옵션은 `workspace_directory` 가 가장 직접적이다.

#### 5. resume 실패를 명시적으로 기록

- resume 실패 시 execution history 에 실패 기록 남김
- 에러 메시지와 대상 `thread_id` 기록

이유:

- 원격 orchestration/메신저 브리지에서는 fresh thread fallback 이 있었지만
  스케줄러에서는 문맥 보존이 더 중요하다.
- 조용히 새 thread를 만들면 운영자가 원인을 놓치기 쉽다.

### 당장은 가져오지 않을 것

#### 1. 멀티 플랫폼 입력 채널

- Telegram
- GitHub
- Discord
- Lark/WeChat 등

이유:

- `codex-scheduler` 는 사용자 대화 채널 제품이 아니라 backend scheduler 이다.

#### 2. interactive permission UX

- 버튼 승인
- 채팅 기반 allow/deny
- 실시간 도구 승인 대기

이유:

- 현재 명세에는 승인 UI가 없다.
- 자동 스케줄 실행과 상호작용형 승인 흐름은 운영 모델이 다르다.

#### 3. assistant 다중 선택 abstraction

- Claude/Codex/Gemini 같은 멀티 backend 선택

이유:

- 현재 명세는 Codex SDK 기준이다.
- 1차 버전에서 추상화를 과하게 일반화하면 복잡도만 늘어날 수 있다.

#### 4. 플랫폼별 스트리밍 포맷 변환

- SSE to chat message
- webhook comment update
- IM rich message formatting

이유:

- 우리는 최종 소비자가 채팅 UI가 아니라 DB history 와 관리 UI 이다.
- 이벤트 정규화는 필요하지만, 채팅 친화적 포맷팅은 필요 없다.

#### 5. fresh thread 자동 대체

- resume 실패 시 자동 새 thread 발급

이유:

- 현재 명세와 운영 기대상 위험하다.
- 스케줄러는 "같은 thread에 전달" 이 요구사항이므로, 새 thread 대체는 의미가 달라진다.

### 권장 최소 설계

1차 버전에서 가장 현실적인 최소 설계는 아래와 같다.

1. `Task` 는 `thread_id`, `prompt`, `schedule`, `workspace_directory`, `enabled` 를 가진다.
2. Task 생성 시 `CodexService.createThread(workspaceDirectory)` 호출
3. 반환된 `thread_id` 저장
4. 스케줄 실행 시 `CodexService.runScheduledPrompt({ threadId, prompt, workspaceDirectory })`
5. 내부적으로 `resumeThread(threadId, options)` 후 `runStreamed(prompt)` 실행
6. 완료/실패를 execution history 에 기록

### 후속 검증 포인트

구현 전에 실제 런타임으로 꼭 확인할 항목:

- `startThread()` 직후 `thread.id` 를 즉시 읽을 수 있는지
- 또는 `thread.started` 이벤트를 받아야만 확정되는지
- `resumeThread(threadId, options)` 시 `workingDirectory` 변경이 허용되는지
- `runStreamed()` 에서 완료 판정 시점이 `turn.completed` 와 정확히 일치하는지
- 실패 시 예외가 throw 되는 경우와 `turn.failed` 이벤트만 오는 경우를 어떻게 구분할지

공개 프로젝트들을 보면 구현 방식은 달라도 반복적으로 나타나는 패턴이 있다.

### 1. `threadId` 영속 저장이 핵심

- 거의 모든 프로젝트가 thread를 세션의 실제 식별자로 취급한다.
- 메모리 캐시가 있어도 궁극적으로는 `thread.id` 를 외부에 저장하거나 상위 계층에 전달한다.

### 2. `runStreamed()` 중심 사용이 많다

- 단순 `run()` 예시보다 실전 코드는 `runStreamed()` 를 더 많이 쓴다.
- 이유는 UI 반영, tool event 추적, usage 기록, 에러 세분화가 가능하기 때문이다.

### 3. 이벤트 매핑 계층이 별도로 있다

- SDK 이벤트를 그대로 노출하지 않고, 각 프로젝트에 맞는 내부 이벤트나 SSE 포맷으로 변환한다.
- 즉, Codex SDK 호출 코드와 앱의 transport/UI 코드는 분리하는 경향이 강하다.

### 4. ESM 동적 import 대응이 자주 나온다

- CommonJS 또는 혼합 빌드 환경에서 `@openai/codex-sdk` 를 직접 static import 하지 않고 dynamic import 하는 코드가 반복적으로 보인다.
- 현재 `codex-scheduler` backend를 Node.js/Express로 운영하더라도 build 설정에 따라 이 이슈를 미리 고려할 필요가 있다.

### 5. resume 실패 처리 정책이 중요하다

- 일부 프로젝트는 resume 실패 시 새 thread fallback 을 둔다.
- 하지만 스케줄 기반 자동화에서는 잘못된 새 thread 생성이 기존 문맥을 잃게 만들 수 있다.

## `codex-scheduler` 관점의 정리

현재 명세와 가장 잘 맞는 패턴은 아래와 같다.

1. Task 생성 시 `codex.startThread(...)` 호출
2. 반환된 `thread.id` 를 DB에 저장
3. 스케줄 실행 시 `codex.resumeThread(threadId, { workingDirectory, ... })`
4. `runStreamed(prompt)` 또는 `run(prompt)` 실행
5. 실행 결과를 `execution_history` 에 기록

권장 해석:

- 저장 필드 이름은 `session_id` 보다 `thread_id` 가 더 정확하다.
- 스케줄러 구현에서는 메모리 thread 캐시보다 DB 기반 `thread_id` 재개가 우선이다.
- 1차 버전에서는 resume 실패 시 자동 새 thread 발급보다는 실패 기록이 더 명세 친화적이다.
- 장기적으로 실행 추적 품질을 높이려면 `runStreamed()` 를 사용하고 핵심 이벤트만 history/log로 정규화하는 편이 유리하다.

## 결론

공개 프로젝트 조사를 보면 `Codex SDK` 는 실제로 아래 유형에서 사용되고 있다.

- sandbox/infra 실행기
- IDE backend
- 원격 agent 브리지
- 범용 AI provider 레이어
- plan/review UI backend

이들 사례는 모두 `threadId` 중심의 지속 세션 모델을 전제로 하고 있으며, `startThread` 와 `resumeThread` 를 분명히 분리해서 사용한다.

따라서 `codex-scheduler` 가 Task 생성 시 thread를 만들고, 이후 스케줄 실행 때 같은 thread를 재개하는 설계는 실제 생태계 패턴과도 잘 맞는다.

## 참고 자료

- OpenAI Developers, Codex SDK
  - https://developers.openai.com/codex/sdk
- Daytona guide example
  - https://github.com/daytonaio/daytona/blob/f17c1afd9bb21b6131e5b315f513514abe0101cb/guides/typescript/openai/codex-sdk/agent/index.ts
- Eclipse Theia Codex service
  - https://github.com/eclipse-theia/theia/blob/4ef126fca6dbb6970e87d9d7749c599c4fcfe116/packages/ai-codex/src/node/codex-service-impl.ts
- remote-agentic-coding-system Codex client
  - https://github.com/coleam00/remote-agentic-coding-system/blob/ad60e90631bd73296d22ffbf730cc38096cf2f05/src/clients/codex.ts
- Claude-to-IM-skill Codex provider
  - https://github.com/op7418/Claude-to-IM-skill/blob/536908f5e9bd65a151ca4cb4b08d3fedc1a43b4d/src/codex-provider.ts
- Plannotator Codex SDK provider
  - https://github.com/backnotprop/plannotator/blob/9746344779607936272794286606cf5fe4612308/packages/ai/providers/codex-sdk.ts
