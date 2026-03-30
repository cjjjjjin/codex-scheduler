# CODEX_PROJECT_STRUCTURE.md

`codex/` 디렉터리에 추가된 OpenAI Codex 참조 프로젝트의 구조를 빠르게 복기하기 위한 문서이다.

이 문서는 `codex-scheduler` 구현을 진행하면서 Codex 참조 저장소의 어떤 부분을 어떤 목적에 참고할 수 있는지 정리하는 데 목적이 있다.

## 1. 전체 개요

루트의 `codex/`는 단일 애플리케이션이 아니라 여러 구현과 도구가 함께 있는 모노레포에 가깝다.

주요 상위 구성은 아래와 같다.

- `codex/README.md`
  - 저장소 전체 소개
  - 현재 메인 사용자 진입점은 Codex CLI
- `codex/codex-cli`
  - legacy TypeScript CLI 구현
  - 현재 README 기준으로는 Rust 구현에 의해 대체됨
- `codex/codex-rs`
  - 현재 Codex의 주요 Rust 구현
  - CLI, app-server, protocol, core runtime, sandbox, tools 등 핵심 코드 포함
- `codex/docs`
  - 사용자/개발자 문서
- `.github`, `scripts`, `patches`
  - 빌드/릴리즈/CI 및 저장소 운영 관련 파일

우리 프로젝트에서 가장 직접적으로 참고 가치가 높은 영역은 `codex/codex-rs` 이다.

## 2. codex-rs 구조

`codex/codex-rs`는 역할별 crate로 분리된 워크스페이스 구조이다.

분석 중 확인한 핵심 관심 영역은 아래와 같다.

- `app-server`
  - Codex 엔진을 JSON-RPC 기반 app server로 노출
- `app-server-protocol`
  - app-server의 request/response/notification 타입 정의
- `app-server-client`
  - app-server에 접속하는 공용 클라이언트 계층
- `app-server-test-client`
  - app-server 수동 검증용 CLI
- `core`
  - Codex 대화/실행의 핵심 런타임 계층
- `protocol`
  - core 내부에서 쓰는 공통 프로토콜 타입
- `exec`, `exec-server`, `execpolicy`, `linux-sandbox`
  - 명령 실행과 샌드박스 관련 구성
- `mcp-server`
  - MCP 서버 기능
- `connectors`, `plugin`, `core-skills`
  - 앱/플러그인/스킬 관련 확장 기능
- `codex-api`, `codex-client`, `backend-client`
  - 외부/내부 API 연동 계층

전체적으로 보면 `codex-rs`는 "Codex를 단순 CLI가 아니라 재사용 가능한 런타임 + 서버 + 프로토콜 + 클라이언트"로 분리한 구조이다.

## 3. app-server 계열 상세

### 3.1 `app-server`

위치:

- `codex/codex-rs/app-server`

역할:

- 실제 `codex app-server` 구현
- stdio / websocket / in-process 경로를 통해 Codex 세션을 노출
- thread, turn, notification, approval, fs, config 등의 요청 처리

핵심 파일:

- `src/main.rs`
  - `codex app-server` 실행 진입점
- `src/lib.rs`
  - 서버 런타임 부팅
  - transport, shutdown, config 초기화
- `src/message_processor.rs`
  - 상위 JSON-RPC 요청 라우팅
  - initialize, config, fs, auth 등 공통 처리
- `src/codex_message_processor.rs`
  - Codex thread/turn 관련 실제 처리
- `src/in_process.rs`
  - 프로세스 내부 임베딩용 app-server 런타임

중요 관찰:

- app-server는 단순 프록시가 아니라 Codex 런타임을 외부 인터페이스로 감싼 서버 계층이다.
- 내부적으로 `Thread`, `Turn`, `ServerNotification`, `ServerRequest` 중심 모델을 사용한다.

### 3.2 `app-server-protocol`

위치:

- `codex/codex-rs/app-server-protocol`

역할:

- app-server가 사용하는 계약층
- JSON-RPC request/response/notification 타입 정의
- v1 호환 API와 v2 API 모두 제공
- JSON Schema / TypeScript schema export 지원

핵심 파일:

- `src/lib.rs`
  - protocol 타입 re-export
- `src/protocol/v1.rs`
  - 레거시 호환 인터페이스
- `src/protocol/v2.rs`
  - 현재 중심이 되는 v2 인터페이스
- `schema/json/*`
  - JSON schema 산출물
- `schema/typescript/*`
  - TypeScript 타입 산출물

중요 관찰:

- v2 API는 `thread/start`, `thread/resume`, `turn/start` 등으로 구성된다.
- 서버와 클라이언트가 같은 타입 계약을 공유하도록 설계되어 있다.

### 3.3 `app-server-client`

위치:

- `codex/codex-rs/app-server-client`

역할:

- app-server를 사용하는 공용 클라이언트 계층
- in-process 연결과 websocket 원격 연결을 공통 인터페이스로 추상화

핵심 파일:

- `src/lib.rs`
  - 공용 facade
  - startup identity, lifecycle, shutdown, backpressure 처리
- `src/remote.rs`
  - websocket 기반 원격 연결 처리

중요 관찰:

- Codex TUI/exec 같은 상위 인터페이스가 중복 구현하지 않도록 공통화한 계층이다.
- request/response 뿐 아니라 event stream, server request resolution도 다룬다.

### 3.4 `app-server-test-client`

위치:

- `codex/codex-rs/app-server-test-client`

역할:

- app-server 수동 검증용 CLI
- websocket app-server를 띄우고 실제 request를 보내며 동작 확인

핵심 파일:

- `src/main.rs`
  - 실행 진입점
- `src/lib.rs`
  - CLI subcommand 구현
- `README.md`
  - quickstart 및 테스트 예시

주요 검증 항목:

- `thread-list`
- `thread-resume`
- `send-message-v2`
- approval flow
- watch 모드로 raw JSON-RPC 관찰

중요 관찰:

- 제품 코드보다는 테스트/디버깅 도구 성격이 강하다.
- thread 재진입, approval, stream 관찰 등은 우리 프로젝트의 통합 검증 아이디어로 참고 가능하다.

## 4. codex-scheduler 관점의 참고 포인트

현재 `codex-scheduler`는 `@openai/codex-sdk`를 통해 thread 생성/재개를 직접 수행하는 단순한 백엔드 구조이다.

`codex/` 참조 프로젝트를 기준으로 보면 다음처럼 해석할 수 있다.

### 직접적으로 참고할 부분

- thread / turn 중심 모델
- 세션 재개를 `thread.resume` 개념으로 다루는 방식
- 프로토콜과 구현을 분리하는 구조
- 이벤트/알림 중심 아키텍처

### 당장 직접 도입할 필요가 낮은 부분

- app-server 전체를 우리 백엔드에 임베드하는 구조
- websocket 기반 복잡한 양방향 세션 서버
- approval, plugin, MCP, dynamic tool 전체 스택

현재 범위에서는 `@openai/codex-sdk` 직접 사용이 더 단순하고 적합하다.

## 5. 현재 결론

`codex/` 참조 프로젝트는 우리 프로젝트에 대해 아래 우선순위로 참고 가치가 있다.

1. `app-server-protocol`
   - Codex가 thread/turn API를 어떻게 모델링하는지 참고
2. `app-server`
   - thread/resume/turn 처리 흐름 참고
3. `app-server-test-client`
   - 검증 시나리오 참고
4. `app-server-client`
   - 향후 다중 클라이언트 구조가 필요할 때 참고

즉, 현재 `codex-scheduler`는 `codex`의 app-server 구조를 그대로 가져오기보다, 그 구조에서 드러나는 세션 모델과 분리 원칙을 참고하는 방향이 적절하다.
