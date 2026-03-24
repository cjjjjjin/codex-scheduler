# MEMORY.md

이 문서는 `codex-schedule` 저장소의 현재 결정 사항과 진행 상태를 빠르게 복기하기 위한 작업 메모입니다.

## 현재 방향

- Codex 연동은 `Codex SDK` 기준으로 진행한다.
- `Task.session_id` 는 현재 코드상 이름은 그대로지만, 의미상 `Codex thread ID` 이다.
- backend는 `Python + FastAPI` 를 유지한다.
- Codex SDK가 TypeScript 라이브러리이므로, backend는 Node.js 기반 브리지(`codex-bridge`)를 subprocess로 호출한다.

## 현재 구현 상태

### 문서

- `SPEC.md` 는 Codex SDK + thread ID 기준으로 갱신됨
- `AGENTS.md` 는 Codex SDK + thread ID 기준으로 갱신됨
- `doc/CODEX_APP_SERVER_RESEARCH.md` 작성 완료
- `doc/CODEX_SDK_ANALYSIS.md` 작성 완료

### Backend

- FastAPI + SQLite 기반 Task CRUD / enable-disable / 실행 이력 API 골격 생성됨
- 스케줄러 루프 구현됨
- 타임존은 `Asia/Seoul`
- `backend/.venv` 기준 개발 환경 사용
- `backend/app/services/codex_service.py` 는 Node bridge 호출 방식으로 연결됨
- 삭제 API의 `204 No Content` 응답 오류 수정 완료
- `zoneinfo` 오류 대응을 위해 `tzdata` 를 requirements에 추가함

### Frontend

- React + TypeScript 기반 UI 골격 생성됨
- Task 추가는 우상단 `Task 추가` 버튼으로 열리는 방식으로 수정됨
- Task 목록은 카드형이 아니라 1 Task = 1 row 형태로 수정됨

### Codex Bridge

- `codex-bridge/src/main.mjs` 추가됨
- 지원 명령:
  - `create-thread`
  - `run-prompt`
- `workingDirectory` 전달 지원
- 기본 workspace directory 는 저장소 루트
- `CODEX_WORKSPACE_DIR` 환경 변수로 override 가능

## 확인된 제약 / 리스크

- `codex-bridge` 의존성 설치(`npm install`)는 아직 실행하지 않음
- 실제 `@openai/codex-sdk` 런타임 검증은 아직 하지 않음
- SDK가 thread 생성 직후 `thread.id` 를 즉시 반환하는지 실동작 확인이 필요함
- 현재 README 일부 문구는 아직 "더미 구현" 설명이 남아 있을 수 있으므로, 실제 검증 후 다시 정리 필요

## 작업 시 우선 확인 사항

1. `SPEC.md`
2. `MEMORY.md`
3. `README.md`

## 다음 우선 작업

1. `codex-bridge` 에서 `npm install`
2. Codex SDK 실제 호출 검증
3. Task 생성 시 실제 thread ID 반환 확인
4. 스케줄 실행 시 `resumeThread(threadId)` 동작 확인
5. 필요하면 `session_id` 필드명을 `thread_id` 로 리팩터링

