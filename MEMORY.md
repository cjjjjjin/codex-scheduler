# MEMORY.md

이 문서는 `codex-schedule` 저장소의 현재 결정 사항과 진행 상태를 빠르게 복기하기 위한 작업 메모입니다.

## 현재 방향

- Codex 연동은 `Codex SDK` 기준으로 진행한다.
- `Task.session_id` 는 현재 코드상 이름은 그대로지만, 의미상 `Codex thread ID` 이다.
- backend는 `Node.js + Express` 로 전환한다.
- 현재 구현은 backend 런타임에서 Codex SDK를 직접 호출하는 방식이며, 별도 subprocess 브리지는 제거 대상으로 본다.

## 현재 구현 상태

### 문서

- `SPEC.md` 는 Codex SDK + thread ID 기준으로 갱신됨
- `AGENTS.md` 는 Codex SDK + thread ID 기준으로 갱신됨
- `doc/CODEX_APP_SERVER_RESEARCH.md` 작성 완료
- `doc/CODEX_SDK_ANALYSIS.md` 작성 완료

### Backend

- Express + SQLite 기반 Task CRUD / enable-disable / 실행 이력 API 골격 추가됨
- backend 내부 스케줄러 루프 구현 추가됨
- 타임존은 `Asia/Seoul`
- Codex SDK 직접 연동 서비스 추가됨
- Task 생성 시 `task-settings` skill을 workspace의 `.agents/skills`에 기본 설치하는 방향 추가됨
- 새 Task의 `workspace_directory` 는 기본 workspace 경로 아래 task id 하위 경로를 사용하도록 조정됨
- Agent용 Task 설정 수정 API를 human용 Task 수정 API와 분리함

### Frontend

- React + TypeScript 기반 UI 골격 생성됨
- Task 추가는 우상단 `Task 추가` 버튼으로 열리는 방식으로 수정됨
- Task 목록은 카드형이 아니라 1 Task = 1 row 형태로 수정됨

## 확인된 제약 / 리스크

- Node.js 런타임 검증이 아직 되지 않음
- 실제 `@openai/codex` 런타임 검증은 아직 하지 않음
- SDK가 thread 생성 직후 `thread.id` 를 즉시 반환하는지 실동작 확인이 필요함

## 작업 시 우선 확인 사항

1. `SPEC.md`
2. `MEMORY.md`
3. `README.md`

## 다음 우선 작업

1. Express backend 마이그레이션 완료
2. backend에서 Codex SDK 직접 호출 검증
3. Task 생성 시 실제 thread ID 반환 확인
4. 스케줄 실행 시 `resumeThread(threadId)` 동작 확인
5. 필요하면 legacy `codex-bridge` 정리 여부 결정
6. task-settings skill의 backend API 사용 흐름 검증
