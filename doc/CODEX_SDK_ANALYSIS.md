# Codex SDK 분석

조사일: 2026-03-24

## 요약

`Codex SDK`는 OpenAI가 제공하는 TypeScript 라이브러리로, 로컬 Codex agent를 애플리케이션 코드에서 직접 제어할 수 있게 해준다. 공식 문서 기준으로는 CI/CD, 내부 도구, 서버사이드 워크플로우, 애플리케이션 내장 통합에 적합하다.

이 프로젝트처럼 "backend가 주기적으로 Codex 작업을 실행하고, 같은 세션을 이어간다"는 요구에는 현재 공개된 자료 기준으로 `Codex App Server`보다 `Codex SDK`가 더 직접적인 선택이다.

## 공식 문서 기준 정의

OpenAI Developers의 Codex SDK 문서는 SDK를 다음처럼 설명한다.

- local Codex agents를 programmatically control 하는 수단
- Codex CLI, IDE extension, Codex Web과 같은 Codex surface를 코드에서 제어할 수 있는 방법
- non-interactive mode보다 더 유연한 TypeScript library
- server-side 사용을 권장
- Node.js 18 이상 필요

공식 사용 사례는 아래와 같다.

- CI/CD 파이프라인에서 Codex 제어
- 자체 agent 구성
- 내부 도구/워크플로우 통합
- 애플리케이션 내부 통합

## 핵심 API 모델

공식 문서에서 노출하는 기본 사용 흐름은 매우 단순하다.

```ts
import { Codex } from "@openai/codex-sdk";

const codex = new Codex();
const thread = codex.startThread();
const result = await thread.run("Make a plan to diagnose and fix the CI failures");
```

이후 같은 thread에서 추가 작업을 이어갈 수 있다.

```ts
const result = await thread.run("Implement the plan");
```

또는 저장한 thread ID로 재개할 수 있다.

```ts
const threadId = "<thread-id>";
const thread2 = codex.resumeThread(threadId);
const result2 = await thread2.run("Pick up where you left off");
```

즉, SDK 관점의 지속 세션 단위는 `thread`이며, 식별자는 `threadId`다.

## 우리 프로젝트와의 직접 매핑

이 항목은 공식 문서 내용을 바탕으로 한 해석이다.

현재 `SPEC.md`에서는 `Task`가 다음 정보를 가진다.

- 스케줄
- CODEX Session ID
- Prompt
- Enable 여부

Codex SDK 기준으로 보면 여기서의 `CODEX Session ID`는 사실상 `threadId`로 보는 것이 가장 자연스럽다.

매핑하면 다음과 같다.

- `Task.session_id` = Codex SDK의 `threadId`
- Task 생성 시 `codex.startThread()` 호출
- 반환된 thread id 저장
- 스케줄 실행 시 `codex.resumeThread(threadId)` 후 `run(prompt)` 호출

이 방식은 현재 요구사항과 거의 1:1로 맞는다.

## App Server와 비교

OpenAI 공식 App Server 문서와 블로그를 함께 보면, App Server는 rich client 통합용이고 SDK는 애플리케이션/자동화 코드에 직접 붙이는 용도다.

### Codex SDK가 더 적합한 경우

- backend에서 정기 작업을 자동 실행
- UI 없이도 task가 동작해야 함
- Node/TypeScript 기반 서버 로직 안에서 직접 Codex 호출
- `threadId` 저장 후 나중에 이어서 실행
- JSON-RPC client를 직접 만들고 싶지 않음

### App Server가 더 적합한 경우

- IDE/데스크톱 앱/웹앱에서 rich client를 구현
- agent 이벤트 스트리밍을 세밀하게 렌더링
- 승인 UI, diff UI, item/turn/thread 이벤트를 직접 표시
- 장기 프로세스 + JSON-RPC 바인딩을 감당할 수 있음

공식 블로그도 SDK에 대해 "server-side tools and workflows에 적합"하다고 설명하고, App Server는 "full Codex harness exposed as a stable, UI-friendly event stream"이라고 설명한다.

## 이 프로젝트에 주는 시사점

### 장점

`codex-schedule` 관점에서 SDK의 장점은 아래와 같다.

- backend 자동화 시나리오와 잘 맞는다.
- `Task` 생성 시 thread를 만들고 ID를 저장하는 흐름이 단순하다.
- 이후 실행 시 같은 thread를 resume하면 된다.
- App Server처럼 별도 child process protocol client를 구현할 필요가 적다.

### 한계

공식 블로그 기준으로 SDK는 App Server보다 "smaller surface area"를 가진다.

이는 아래를 의미한다는 해석이 가능하다.

- App Server 수준의 세밀한 event/approval/diff 제어는 SDK에서 바로 다 보장되지 않을 수 있다.
- 현재 공개 문서가 TypeScript 중심이라, Python backend에서 직접 쓰기는 부자연스럽다.

즉, backend를 Python으로 유지하려면 아래 중 하나를 선택해야 한다.

1. Python backend가 별도 Node helper/service를 호출해서 SDK 사용
2. backend 일부를 TypeScript 서비스로 분리
3. App Server/CLI 기반 연동으로 우회

## 현재 코드베이스 관점의 영향

지금 코드베이스는 backend가 Python + FastAPI이고, frontend가 TypeScript + React다.

따라서 Codex SDK를 실제 도입하려면 구조 결정이 필요하다.

### 옵션 A. Python backend + Node bridge

- FastAPI는 유지
- backend 내부 또는 별도 프로세스로 Node.js helper 실행
- helper가 `@openai/codex-sdk`를 사용
- Python은 helper와 subprocess/HTTP/queue로 통신

장점:

- 현재 backend 구조를 크게 바꾸지 않음
- SDK를 공식 사용 방식대로 활용 가능

단점:

- 런타임이 Python + Node 두 개가 됨
- 장애 처리와 프로세스 관리가 추가됨

### 옵션 B. Codex 연동 전용 TypeScript backend 서비스 분리

- FastAPI는 Task 관리 API 유지
- Codex 실행만 별도 TS service 담당
- 스케줄 이벤트 시 FastAPI가 TS service 호출

장점:

- SDK 사용이 자연스럽다.
- Codex 연동 로직을 TS 생태계에서 관리 가능

단점:

- 아키텍처가 분산됨

### 옵션 C. backend를 TypeScript로 재구성

현재 `SPEC.md`가 backend를 Python + FastAPI로 고정하고 있으므로, 1차 기준에서는 비현실적이다.

## 권장안

현 시점에서 가장 현실적인 선택은 아래 둘 중 하나다.

1. 명세를 유지한다면: Python backend + Node bridge
2. Codex 연동 복잡도를 줄이고 싶다면: 명세를 변경해서 backend 일부를 TypeScript 서비스로 분리

현재 `SPEC.md`를 유지한다는 전제에서는 `Task.session_id`를 `threadId`로 정의하고, 실제 생성/재개는 Node 기반 SDK helper가 맡는 구조가 가장 합리적이다.

## 구현 초안 예시

이 항목은 공식 예시를 바탕으로 한 설계 예시다.

### Task 생성 시

1. Python backend가 Node helper 호출
2. Node helper:

```ts
import { Codex } from "@openai/codex-sdk";

const codex = new Codex();
const thread = codex.startThread();
```

3. helper가 `threadId` 반환
4. Python backend가 이를 `Task.session_id`로 저장

### 스케줄 실행 시

1. Python backend가 저장된 `session_id`를 사용
2. Node helper:

```ts
const thread = codex.resumeThread(threadId);
const result = await thread.run(prompt);
```

3. 결과/에러를 Python backend로 반환
4. backend는 실행 이력 저장

## 결론

- `Codex SDK`는 공식 TypeScript 라이브러리이며, local Codex agents를 서버사이드 코드에서 제어하는 용도다.
- 현재 공개 문서 기준으로 `Task`의 "session id"는 SDK 문맥에서 `threadId`로 해석하는 것이 가장 타당하다.
- `codex-schedule` 같은 주기 실행 backend에는 App Server보다 SDK가 개념적으로 더 잘 맞는다.
- 다만 backend가 Python이므로, 실제 도입에는 Node 기반 bridge/helper 설계가 필요할 가능성이 높다.

## 참고 자료

- OpenAI Developers, Codex SDK
  - https://developers.openai.com/codex/sdk
- OpenAI Developers, Codex App Server
  - https://developers.openai.com/codex/app-server
- OpenAI Blog, Unlocking the Codex harness: how we built the App Server
  - https://openai.com/index/unlocking-the-codex-harness/
