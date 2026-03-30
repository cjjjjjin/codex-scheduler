# Task DB Schema Review

## 목적

이 문서는 현재 `codex-scheduler` backend의 Task 관리용 SQLite 스키마를 검토하고, 최신 `SPEC.md` 기준으로 보완이 필요한 항목을 정리하기 위한 문서이다.

검토 기준:

- [SPEC.md](/home/munchkin/workspace/codex-scheduler/SPEC.md)
- [backend/app/db/database.py](/home/munchkin/workspace/codex-scheduler/backend/app/db/database.py)
- [backend/app/models.py](/home/munchkin/workspace/codex-scheduler/backend/app/models.py)
- [backend/app/services/task_repository.py](/home/munchkin/workspace/codex-scheduler/backend/app/services/task_repository.py)

## 결론 요약

현재 backend 구현을 다시 확인해보면, 이 문서 초안 시점에 지적했던 핵심 스키마 보완 상당수는 이미 반영되어 있다.

현재 기준으로 확인된 상태는 아래와 같다.

- `tasks.workspace_directory` 가 이미 반영되어 있다.
- `session_id` 는 backend 스키마에서 `thread_id` 로 이미 정리되어 있다.
- `execution_history.task_id` 외래 키와 `ON DELETE CASCADE` 가 반영되어 있다.
- `enabled`, `status` 등에 대한 `CHECK` 제약이 반영되어 있다.
- 주요 조회 인덱스가 반영되어 있다.

즉, 현재 남은 핵심 쟁점은 "스키마 구조 자체"보다 아래 운영/설계 판단에 가깝다.

- 실행 이력에 `workspace_directory` 를 별도로 스냅샷 저장할지
- `runStreamed()` 기반 실행 이벤트를 어디까지 정규화해서 저장할지
- 문서 내 참고 경로와 현재 TypeScript backend 구조를 일치시킬지

## 현재 스키마

### tasks

현재 backend 구현 기준 생성 SQL:

```sql
CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    schedule TEXT NOT NULL,
    thread_id TEXT NOT NULL,
    prompt TEXT NOT NULL,
    workspace_directory TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    next_run_at TEXT
)
```

의미:

- `id`: Task 고유 ID
- `schedule`: CRON 표현식
- `thread_id`: Codex thread ID
- `prompt`: 실행 시 전달할 Prompt
- `workspace_directory`: Codex 실행 기준 작업 디렉터리
- `enabled`: 실행 여부
- `created_at`, `updated_at`: 생성/수정 시각
- `next_run_at`: 다음 스케줄 실행 시각 캐시

### execution_history

현재 backend 구현 기준 생성 SQL:

```sql
CREATE TABLE IF NOT EXISTS execution_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id TEXT NOT NULL,
    thread_id TEXT NOT NULL,
    prompt TEXT NOT NULL,
    scheduled_for TEXT NOT NULL,
    executed_at TEXT NOT NULL,
    status TEXT NOT NULL,
    error_message TEXT,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
)
```

의미:

- `task_id`: 실행 대상 Task ID
- `thread_id`: 실행 대상 thread ID
- `prompt`: 실행 당시 사용된 Prompt 스냅샷
- `scheduled_for`: 원래 실행되어야 했던 시각
- `executed_at`: 실제 실행 시각
- `status`: 성공/실패
- `error_message`: 실패 메시지

## SPEC 대비 적합성 검토

### 1. 충족되는 항목

- Task 고유 ID 저장
- 스케줄 정보 저장
- thread ID 저장
- Prompt 저장
- workspace directory 저장
- enable 여부 저장
- 생성/수정 시각 저장
- 실행 이력 저장
- SQLite 사용
- 애플리케이션 재시작 후 유지되는 영속 저장 구조

### 2. 보완이 필요한 항목

#### 문서의 참고 경로 정리 필요

현재 문서 상단의 참고 경로는 Python backend 시절 경로를 가리키고 있다.

현재 실제 backend 구현은 TypeScript 기반이며, 확인된 핵심 구현 위치는 아래에 가깝다.

- `backend/src/db.ts`
- `backend/src/task-repository.ts`
- 필요 시 `backend/src/types.ts` 또는 route/service 계층

설명:

- 스키마 자체보다 문서가 현재 코드 구조를 정확히 반영하는지가 우선 정리 포인트다.
- 이후 구현 검토자가 헷갈리지 않도록 참고 경로를 최신 구조로 바꾸는 편이 좋다.

#### 실행 이력에 `workspace_directory` 스냅샷을 남길지 결정 필요

현재 `execution_history` 는 아래 정보를 저장한다.

- `task_id`
- `thread_id`
- `prompt`
- `scheduled_for`
- `executed_at`
- `status`
- `error_message`

설명:

- 현재 `Task` 는 `workspace_directory` 를 가지므로, 실행 당시 어떤 디렉터리에서 실행됐는지 이력에도 스냅샷으로 남길지 결정할 수 있다.
- 지금 구조만으로도 현재 Task 기준 복원은 가능하지만, Task 수정 또는 삭제 이후 과거 실행 환경 재현성은 떨어질 수 있다.

권장 판단:

- 1차 버전에서는 지금처럼 `execution_history` 를 최소 구조로 유지해도 충분하다.
- 다만 추후 운영/디버깅 요구가 커지면 `workspace_directory` 스냅샷 컬럼 추가를 검토할 수 있다.

#### 실행 이벤트 상세 저장 범위 결정 필요

`Codex SDK` 분석 문서 기준으로 향후 `runStreamed()` 를 사용하면 아래 이벤트를 구조적으로 다룰 수 있다.

- `thread.started`
- `item.completed`
- `turn.completed`
- `turn.failed`
- `error`

현재 `execution_history` 는 최종 결과 중심 구조이고, 상세 이벤트 테이블은 없다.

설명:

- 1차 버전 요구사항에는 충분하다.
- 하지만 이후 디버깅 품질을 높이려면 별도 event/log 저장 구조를 둘 여지가 있다.
- 다만 지금 단계에서 DB를 과도하게 확장할 필요는 없다.

#### 실제 migration 정책 명시 필요

현재 `backend/src/db.ts` 에는 이미 다음 호환 마이그레이션 로직이 들어 있다.

- `session_id` -> `thread_id` 전환 대응
- `workspace_directory` 없는 기존 `tasks` 테이블 재생성
- 기존 데이터에 대해 default workspace 채움
- `execution_history` 재생성 및 컬럼 이전
- 인덱스 보장

이 문서에도 이 점을 명시해 두는 편이 좋다.

## 권장 스키마

최신 명세 기준으로 1차 버전에 적합한 권장안은 아래와 같다.

```sql
CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    schedule TEXT NOT NULL CHECK (length(trim(schedule)) > 0),
    thread_id TEXT NOT NULL CHECK (length(trim(thread_id)) > 0),
    prompt TEXT NOT NULL CHECK (length(trim(prompt)) > 0),
    workspace_directory TEXT NOT NULL CHECK (length(trim(workspace_directory)) > 0),
    enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    next_run_at TEXT
);

CREATE TABLE IF NOT EXISTS execution_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id TEXT NOT NULL,
    thread_id TEXT NOT NULL CHECK (length(trim(thread_id)) > 0),
    prompt TEXT NOT NULL CHECK (length(trim(prompt)) > 0),
    scheduled_for TEXT NOT NULL,
    executed_at TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('success', 'failed')),
    error_message TEXT,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tasks_enabled_next_run_at
ON tasks (enabled, next_run_at);

CREATE INDEX IF NOT EXISTS idx_tasks_created_at
ON tasks (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_execution_history_task_executed_at
ON execution_history (task_id, executed_at DESC);

CREATE INDEX IF NOT EXISTS idx_execution_history_executed_at
ON execution_history (executed_at DESC);
```

## 마이그레이션 관점 메모

현재 구현에서는 `backend/src/db.ts` 가 스키마 생성과 호환 마이그레이션을 함께 담당한다.

이미 반영된 마이그레이션 포인트:

- `tasks.session_id` -> `tasks.thread_id`
- `execution_history.session_id` -> `execution_history.thread_id`
- `tasks.workspace_directory` 추가
- 기존 `enabled` 값 정규화
- 인덱스 보장

추가 변경이 필요할 경우 함께 수정해야 할 가능성이 큰 항목:

- `backend/src/db.ts`
- `backend/src/task-repository.ts`
- Task 생성/수정 API 스키마
- Codex 실행 로직에서 `workspace_directory` 사용 방식
- frontend Task 생성/수정 UI

특히 SQLite에서 컬럼 rename, 제약 추가, 외래 키 정리는 경우에 따라 테이블 재생성이 더 단순할 수 있다.

## 구현 우선순위 제안

추천 순서는 아래와 같다.

1. 문서의 참고 경로를 현재 TypeScript backend 구조로 정리
2. `workspace_directory` 가 실제 Codex 실행 옵션에 반영되는지 재확인
3. `workspace_directory` 를 1차 버전에서 시스템 기본값으로 유지할지 정책 명시
4. `execution_history` 에 `workspace_directory` 스냅샷이 필요한지 결정
5. 필요 시 상세 event/log 저장 구조 검토

## 추가 확인 결과

문서 정리 과정에서 현재 backend 구현을 다시 확인한 결과, `workspace_directory` 의 연결 상태는 아래와 같다.

### 이미 연결된 부분

- `backend/src/db.ts`
  - `tasks.workspace_directory` 스키마가 존재한다.
- `backend/src/task-repository.ts`
  - Task 생성/조회 시 `workspace_directory` 를 읽고 쓴다.
- `backend/src/codex-service.ts`
  - `createThread(workspaceDirectory)` 에서 `startThread({ workingDirectory })` 로 전달한다.
  - `sendPrompt(threadId, prompt, workspaceDirectory)` 에서 `resumeThread(threadId, { workingDirectory })` 로 전달한다.
- `backend/src/scheduler.ts`
  - 실행 시 `task.workspace_directory` 를 `codexService.sendPrompt(...)` 로 넘긴다.

즉, DB -> repository -> scheduler -> Codex SDK 까지의 전달 경로는 이미 연결되어 있다.

### 아직 남아 있는 제한

- `backend/src/task-service.ts`
  - Task 생성 시 `createThread(DEFAULT_WORKSPACE_DIRECTORY)` 를 호출한다.
  - DB 저장도 `workspaceDirectory: DEFAULT_WORKSPACE_DIRECTORY` 로 고정한다.
- `backend/src/types.ts`
  - `TaskPayload` 는 현재 `schedule`, `prompt` 만 받고 `workspace_directory` 를 받지 않는다.

의미:

- 현재 구현은 "Task가 `workspace_directory` 를 가진다" 는 스키마 구조는 충족한다.
- 하지만 실제 사용자 입력/API 관점에서는 아직 Task별 workspace를 설정하는 기능이 열려 있지 않다.
- 따라서 현재 상태는 "Task별 workspace 실행을 지원할 준비는 되어 있으나, 생성 플로우는 아직 기본값 고정" 으로 보는 것이 정확하다.

명세 해석 메모:

- 현재 `SPEC.md` 는 Task가 `workspace directory` 를 가진다고 정의한다.
- 동시에 Task 생성 시 사용자가 직접 입력하는 값은 `schedule` 과 `prompt` 로 제한한다.
- 따라서 1차 버전에서는 `workspace_directory` 를 DB와 실행 계층에서 시스템 관리 값으로 유지하고,
  사용자 editable 필드로 바로 노출하지 않는 현재 구조도 명세 친화적인 해석이 가능하다.

## 판단

현재 backend 스키마는 초기 검토 시점보다 훨씬 더 최신 `SPEC.md` 에 근접해 있으며,
핵심 구조인 `thread_id`, `workspace_directory`, 외래 키, 제약, 인덱스는 이미 반영되어 있다.

따라서 지금의 핵심 과제는 스키마 큰 틀 변경이 아니라 아래에 가깝다.

- 문서와 실제 구현 경로 정합성 맞추기
- `workspace_directory` 의 실행 시점 사용 여부 검증
- execution history 를 최소 구조로 유지할지, 운영용 메타데이터를 더 넣을지 결정
