# codex-schedule

`codex-schedule` 는 CRON 스케줄에 맞춰 Codex thread로 Prompt를 전달하는 프로젝트입니다.

## 구조

- `backend`: Express + SQLite 기반 API 및 스케줄러
- `frontend`: React + TypeScript 기반 관리 UI
- `codex-bridge`: legacy 브리지 구현 보관용 디렉터리

## 현재 구현 범위

- Task 생성, 조회, 수정, 삭제
- Task enable/disable
- Task 실행 이력 조회
- CRON 기반 `next_run_at` 계산
- backend 내부 스케줄러 루프
- Codex SDK 직접 연동 서비스
- Task별 `workspace_directory` 저장

## Codex 연동 방향

- Codex 연동은 `Codex SDK` 기준으로 진행합니다.
- `Task.thread_id` 는 Codex thread ID 입니다.
- Task 생성 시 thread를 만들고, 이후 스케줄 실행 시 같은 thread를 resume 해서 prompt를 전달하는 흐름을 목표로 합니다.
- 현재 구현은 backend의 Node.js 런타임에서 Codex SDK를 직접 호출하는 방식입니다.

## 주의 사항

현재 backend는 Express 기반 Node.js 서버이며, Codex SDK를 직접 호출합니다.

## 실행 방법

### Backend

```bash
cd backend
npm install
npm run dev
```

- Node.js 18 이상이 필요합니다.
- backend는 기본적으로 `http://localhost:8000` 에서 실행됩니다.
- API 기본 주소는 `http://localhost:8000/api` 입니다.
- 기본 workspace directory는 저장소 루트이며, 필요하면 `CODEX_WORKSPACE_DIR` 환경 변수로 override 할 수 있습니다.
- Codex 인증은 Codex SDK가 사용하는 환경 변수 또는 Codex 로그인 상태에 의존합니다.

`codex-bridge` 는 과거 브리지 실험용 디렉터리이며, 현재 기본 실행 경로는 아닙니다.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend 기본 주소는 `http://localhost:5173` 입니다.
