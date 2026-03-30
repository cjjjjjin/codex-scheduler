# AGENTS.md

이 문서는 `codex-schedule` 저장소에서 작업하는 에이전트를 위한 작업 지침이다. 현재 이 저장소의 기준 명세는 루트의 [SPEC.md](D:/04_Short-Projects/codex-schedule/SPEC.md) 이며, 명세와 충돌하는 구현 판단이 필요할 경우 `SPEC.md`를 우선한다.

작업을 시작하기 전에는 반드시 루트의 `MEMORY.md` 를 먼저 확인해 현재 결정 사항, 진행 상태, 미해결 리스크를 파악해야 한다. `MEMORY.md` 는 요약 메모이고, 최종 기준은 항상 `SPEC.md` 이다.

문서 조사가 필요하거나 기존 설계 결정을 참조해야 할 때는 `doc/INDEX.md` 를 먼저 확인해 관련 문서를 찾는다.

## 프로젝트 목적

이 프로젝트는 OpenAI Codex SDK를 사용해, 지정된 주기에 지정된 Codex thread로 Prompt를 전달하는 시스템이다.

- Backend: Node.js + Express
- Frontend: TypeScript + React

## 핵심 도메인

### Task

Task는 이 시스템의 기본 작업 단위이며 아래 정보를 가진다.

- 스케줄 정보: CRON 스타일 표현식
- Codex thread ID
- 스케줄 시점에 전달할 Prompt
- Enable 여부

## 요구 기능

### Task 관리

구현 시 아래 기능을 기준 범위로 본다.

- Task 추가
- Task 편집
- Task 삭제
- Task enable/disable

Task 추가 시에는 외부 입력으로 thread ID를 받지 않고, 생성 과정에서 Codex SDK로 새로운 thread를 만들고 그 ID를 할당해야 한다.

Task 편집 시 수정 가능한 항목은 아래로 제한한다.

- 스케줄
- Prompt

### 스케줄러

각 Task의 CRON 스케줄에 맞춰 Codex SDK를 이용해 해당 thread에 Prompt를 전달해야 한다.

## 구현 원칙

- 명세에 없는 기능을 임의로 추가하지 않는다.
- 데이터 모델, API, UI는 모두 `Task` 중심으로 설계한다.
- 스케줄 표현은 CRON을 기준으로 일관되게 처리한다.
- `enable=false` 인 Task는 스케줄 실행 대상에서 제외한다.
- thread 생성 책임은 Task 생성 플로우에 포함한다.
- thread ID는 Task 생성 후 시스템이 관리하는 값으로 취급한다.
- backend는 Node.js 런타임에서 Codex SDK를 직접 호출하는 방향을 우선한다.

## Backend 지침

- Express 기반으로 API를 설계한다.
- Node.js 런타임은 `18+` 를 기준으로 사용한다.
- Task CRUD 및 enable/disable 변경 기능을 우선 제공한다.
- 스케줄러는 저장된 Task 목록을 기준으로 동작해야 한다.
- Codex 호출 로직은 스케줄러와 분리된 서비스 계층으로 구성하는 것을 우선한다.
- 스케줄 실행 시 어떤 Task가 언제 어떤 thread로 전달되었는지 추적 가능해야 한다.

## Frontend 지침

- React + TypeScript로 Task 관리 GUI를 제공한다.
- 최소한 아래 사용자 동작을 지원해야 한다.
  - Task 목록 조회
  - Task 생성
  - Task 수정
  - Task 삭제
  - Task enable/disable 토글
- Task 생성 화면에서는 thread ID 입력을 요구하지 않는다.
- 스케줄과 Prompt는 사용자가 명확히 수정할 수 있어야 한다.

## 작업 우선순위

구현을 시작할 때는 아래 순서를 기본으로 삼는다.

1. Task 도메인 모델 정의
2. Task CRUD 및 enable/disable API
3. Task 생성 시 Codex thread 생성 로직
4. 스케줄러 실행 로직
5. Frontend Task 관리 화면

## 문서화 원칙

- 새로운 디렉터리 구조나 런타임 의존성이 생기면 관련 문서도 함께 갱신한다.
- `SPEC.md`에 없는 설계 결정은 코드 또는 별도 문서에 명시적으로 남긴다.
- 추정이나 가정이 포함된 구현은 주석 또는 문서로 근거를 남긴다.
- `doc/` 아래 문서를 추가하거나 갱신한 경우, `doc/INDEX.md` 도 함께 갱신해 문서 목록과 용도를 유지한다.

## 금지 사항

- 명세에 없는 추가 필드를 Task의 필수값으로 강제하지 않는다.
- 비활성화된 Task를 스케줄러가 실행하도록 구현하지 않는다.
- Task 생성 시 Session 생성 단계를 생략하지 않는다.
- Frontend에서 thread ID를 직접 입력받는 흐름을 기본 동작으로 만들지 않는다.


## 참조용 프로젝트

### `third-party/`
외부 프로젝트
해당 폴더 내의 코드를 수정하는 것은 허용되지 않으나 참조해서 사용하는 것은 권장

#### `third-party/codex/`

openai의 codex repository
codex와의 연동을 참조 할 것

#### `third-party/opencode/`

opencode의 repository
Frontend는 이 프로젝트를 참조 할 것

## 문서 참조

- 루트 문서 우선순위는 `SPEC.md` -> `MEMORY.md` -> `README.md` 이다.
- `doc/` 아래 세부 조사 문서는 `doc/INDEX.md` 를 통해 찾아본다.
- Codex 관련 설계 판단 전에는 가능하면 `doc/` 내 기존 조사 문서 존재 여부를 먼저 확인한다.
