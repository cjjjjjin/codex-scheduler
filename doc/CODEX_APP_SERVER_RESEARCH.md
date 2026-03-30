# Codex App Server 조사

조사일: 2026-03-27

## 요약

`Codex App Server`는 OpenAI가 Codex의 rich client 통합을 위해 제공하는 공식 프로토콜/런타임이다. 주된 용도는 VS Code 확장, 데스크톱 앱, IDE 플러그인처럼 Codex의 대화 상태, 승인 흐름, 스트리밍 이벤트, 설정/인증까지 깊게 통합하는 것이다.

반면 이 프로젝트처럼 "정해진 주기에 백엔드가 Codex 작업을 실행"하는 자동화 성격의 시스템에는, 현재 공식 문서 기준으로 `Codex App Server`보다 `Codex SDK`가 더 직접적인 선택지다. 이는 공식 App Server 문서가 "자동화 작업이나 CI에는 Codex SDK를 사용하라"고 명시하고 있기 때문이다.

## Codex App Server란

OpenAI 공식 블로그에 따르면 Codex는 웹 앱, CLI, IDE 확장, macOS 앱 등 여러 surface에서 공통의 Codex harness를 사용하고 있고, 이들을 연결하는 핵심 인터페이스가 `Codex App Server`다.

- Codex App Server는 client-friendly한 양방향 JSON-RPC API다.
- 단순 request/response가 아니라 thread, turn, item 기반의 스트리밍 이벤트 모델을 제공한다.
- 승인 요청, diff, tool 실행 상태 같은 rich interaction을 UI에서 표현할 수 있게 설계되어 있다.

공식 문서 표현을 정리하면, App Server는 "Codex를 제품 안에 깊게 임베드하기 위한 프로토콜"에 가깝다.

## 공식 문서 기준 핵심 특징

### 1. 통신 방식

공식 문서 기준 App Server는 JSON-RPC 스타일 메시지를 사용한다.

- 기본 transport: `stdio`
- 실험적 transport: `websocket`
- wire format은 JSON-RPC 2.0 계열이지만, 전송 시 `"jsonrpc": "2.0"` 헤더는 생략된다.

기본 실행 예시는 다음과 같다.

```bash
codex app-server
```

또는 experimental websocket 모드:

```bash
codex app-server --listen ws://127.0.0.1:4500
```

### 2. 초기화 handshake

클라이언트는 연결 후 바로 다음 순서를 따라야 한다.

1. `initialize` 요청 전송
2. `initialized` notification 전송
3. 이후에만 `thread/start`, `turn/start` 등 호출 가능

즉, App Server는 단순히 명령 한 번 보내는 CLI가 아니라 "지속 연결을 유지하는 세션형 프로토콜"이다.

### 3. 핵심 데이터 모델

공식 문서와 블로그가 공통으로 강조하는 primitive는 아래 3개다.

- `Thread`: 사용자와 Codex 사이의 지속 대화 단위
- `Turn`: 하나의 사용자 요청과 그에 따른 agent 작업 단위
- `Item`: 메시지, tool 실행, file change, approval 등 세부 이벤트 단위

이 구조 때문에 App Server는 단순 "프롬프트 전송"보다 대화형 agent UI를 만드는 데 적합하다.

### 4. 세션 지속성

App Server 문서상 `thread/start`, `thread/resume`, `thread/fork`, `thread/read`, `thread/list` 등이 제공된다.

- 새 세션 시작: `thread/start`
- 기존 세션 이어가기: `thread/resume`
- 세션 분기: `thread/fork`
- 이력 조회: `thread/read`, `thread/list`

즉, "session id"에 해당하는 개념은 App Server 쪽에서는 `thread.id`로 보는 것이 자연스럽다.

### 5. 승인과 스트리밍

App Server는 다음과 같은 상호작용을 공식 지원한다.

- shell command 승인
- file change 승인
- MCP app/tool call 승인
- agent message delta streaming
- turn 진행 상황 notification

따라서 사용자가 화면에서 Codex의 진행 상황을 실시간으로 보고 승인 버튼을 누르는 제품에 적합하다.

## 우리 프로젝트 관점에서의 해석

이 항목은 공식 문서 내용을 바탕으로 한 해석이다.

현재 `codex-schedule`의 요구사항은 아래에 가깝다.

- backend가 스케줄 시점에 Codex 작업을 시작
- 특정 대화/세션을 이어서 사용
- 사용자 실시간 UI 없이도 작업이 돌아가야 함
- 자동화/배치 실행 성격이 큼

이 요구에 대해 공식 문서는 App Server보다 `Codex SDK`를 더 직접적인 대안으로 제시한다.

공식 App Server 문서는 다음 취지로 안내한다.

- rich client 통합이 목적이면 `Codex App Server`
- 자동화 작업이나 CI라면 `Codex SDK`

공식 SDK 문서도 사용 사례로 아래를 제시한다.

- CI/CD 파이프라인 제어
- 자체 agent / 내부 도구 / 애플리케이션 통합
- thread 시작 후 `run()` 호출
- thread ID를 저장하고 `resumeThread(threadId)`로 재개

즉, 현재 `SPEC.md`의 "Task가 Session ID를 가지고, 스케줄 시 해당 Session에 Prompt를 전달"이라는 요구는 App Server로도 풀 수는 있지만, 공식 자료 기준으로는 SDK가 더 자연스럽다.

## 현재 프로젝트에 대한 권장안

### 권장

1차 구현에서는 `Codex SDK`를 우선 검토하는 편이 좋다.

이유:

- backend 중심 자동화에 더 잘 맞는다.
- 공식 문서가 CI/CD, 내부 도구, 애플리케이션 통합 용도로 SDK를 직접 권장한다.
- `thread ID`를 저장해서 이후 실행에서 이어가는 모델이 현재 `Task.thread_id` 요구와 더 잘 맞는다.
- App Server처럼 별도 장기 프로세스와 JSON-RPC client 구현을 직접 관리할 필요가 적다.

### App Server를 고려할 시점

아래 조건이 생기면 App Server 검토 가치가 커진다.

- frontend에서 Codex 진행 로그를 실시간 스트리밍으로 보여줘야 함
- shell/file/network 승인 UI가 필요함
- IDE 확장이나 데스크톱 앱처럼 rich client를 직접 만들 예정임
- thread/turn/item 이벤트를 세밀하게 렌더링해야 함

## 이 프로젝트에 미치는 설계 영향

현재 프로젝트 기준 지속 식별자는 `session_id` 보다는 `thread_id` 로 정리하는 편이 정확하다.

구현 단계에서 개념적으로는 아래 둘 중 하나로 해석할 수 있다.

### 옵션 A. SDK 기준

- `Task.thread_id` = Codex SDK의 `threadId`
- Task 생성 시 thread 생성
- 스케줄 실행 시 `resumeThread(threadId)` 또는 동일 thread 객체를 재개

### 옵션 B. App Server 기준

- `Task.thread_id` = App Server의 `thread.id`
- backend가 `codex app-server` 프로세스를 관리
- JSON-RPC로 `thread/start` 후 `thread.id` 저장
- 이후 실행에서 `thread/resume` + `turn/start`

현재 프로젝트 요구만 놓고 보면 옵션 A가 더 단순하다.

## 현재 코드베이스 기준 정리

현재 저장소의 방향과 구현 상태를 함께 보면 아래 판단이 더 명확하다.

- backend는 `Node.js + Express` 기준으로 정리되어 있다.
- Codex 연동은 backend 런타임 내부 service 계층에서 직접 SDK를 호출하는 방향이다.
- DB와 타입은 `thread_id` 중심으로 정리되고 있다.
- scheduler 는 저장된 `thread_id` 를 사용해 실행하는 구조를 전제로 한다.

즉, App Server를 도입하려면 단순 교체가 아니라 아래 추가 복잡도가 생긴다.

- `codex app-server` 프로세스 관리
- JSON-RPC transport 처리
- 초기화 handshake 구현
- thread/turn/item 이벤트 모델 매핑
- 장기 연결 오류 복구

반면 현재 프로젝트 범위에서는 그 복잡도를 정당화할 만한 rich client 요구가 없다.

## 지금 남은 App Server 검토 가치

현 시점에서 App Server가 여전히 의미가 있는 경우는 "1차 범위 밖 확장" 으로 보는 편이 맞다.

예시:

- frontend에 Codex 진행 상황을 실시간 스트리밍으로 표시
- tool/file/network 승인 흐름을 웹 UI로 제공
- 단순 실행 결과가 아니라 item/turn 단위 히스토리를 상세하게 렌더링
- 향후 IDE 플러그인이나 데스크톱 클라이언트와 같은 rich client를 별도 제품으로 확장

즉, App Server는 "현재 구현 대안" 이라기보다 "향후 rich client 확장 옵션" 에 가깝다.

## 결론

- `Codex App Server`는 실제 OpenAI 공식 기능이며, rich client 통합용 프로토콜이다.
- 지속 식별자 개념은 App Server 문맥에서도 `thread.id`로 이해하는 것이 맞다.
- 그러나 `codex-schedule` 같은 스케줄 기반 backend 자동화 시스템에는 공식 문서 기준으로 `Codex SDK`가 더 적합하다.
- 현재 코드베이스 상태까지 감안하면, 이 프로젝트는 App Server보다 backend 내부 `Codex SDK` 직접 호출 방향이 더 일관되고 단순하다.
- 따라서 이 프로젝트에서 thread 생성 후 재사용을 구현하려면, 우선 `Codex SDK` 기준으로 `thread_id` 를 저장하는 방향이 가장 합리적이다.

## 참고 자료

- OpenAI Developers, Codex App Server
  - https://developers.openai.com/codex/app-server
- OpenAI Developers, Codex SDK
  - https://developers.openai.com/codex/sdk
- OpenAI Blog, Unlocking the Codex harness: how we built the App Server
  - https://openai.com/index/unlocking-the-codex-harness/
- OpenAI Developers, Codex cloud overview
  - https://developers.openai.com/codex/cloud
