# codex-schedule

`codex-schedule` 는 CRON 스케줄에 맞춰 Codex thread로 Prompt를 전달하는 프로젝트입니다.

## 구조

- `backend`: Express + SQLite 기반 API 및 스케줄러
- `frontend`: React + TypeScript 기반 관리 UI

## 현재 구현 범위

- Task 생성, 조회, 수정, 삭제
- Task enable/disable
- Task 실행 이력 조회
- CRON 기반 `next_run_at` 계산
- backend 내부 스케줄러 루프
- Codex App Server 직접 연동 서비스
- Codex App Server를 통한 thread history 조회
- Task별 `workspace_directory` 저장
- 새 Task의 workspace directory는 기본 workspace 경로 아래 `{taskId}` 하위 디렉터리로 생성
- Task 생성 시 workspace의 `.agents/skills/task-settings`에 `task-settings` skill 자동 설치
- Agent용 Task 설정 수정 API 분리

## Codex 연동 방향

- Codex 연동은 `Codex App Server` 기준으로 진행합니다.
- `Task.thread_id` 는 Codex thread ID 입니다.
- Task 생성 시 thread를 만들고, 이후 스케줄 실행 시 같은 thread를 resume 해서 turn을 시작하는 흐름을 사용합니다.
- 현재 구현은 backend의 Node.js 런타임에서 Codex App Server를 직접 호출하는 방식입니다.
- 기본 App Server 주소는 `ws://127.0.0.1:4500` 이며, `CODEX_APP_SERVER_URL` 로 override 할 수 있습니다.

## 주의 사항

현재 backend는 Express 기반 Node.js 서버이며, Codex App Server를 직접 호출합니다.

## 실행 방법

### Docker Compose

`backend`와 `codex app-server`를 한 컨테이너에서 같이 실행하려면 아래를 사용합니다.

```bash
docker compose up --build
```

- backend API는 `http://localhost:8000` 으로 노출됩니다.
- 컨테이너 내부에서 `codex app-server` 는 `ws://127.0.0.1:4500` 으로 같이 실행됩니다.
- 호스트의 `~/.codex` 를 `/home/node/.codex` 로 마운트하므로 로그인 상태와 session history를 그대로 재사용합니다.
- 현재 저장소 전체를 `/workspace` 로 마운트하므로 Task의 `workspace_directory` 는 컨테이너 기준 경로를 사용해야 합니다.

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
- 새 Task의 실제 workspace directory는 `기본 workspace directory/{taskId}` 형식으로 계산됩니다.
- Codex 인증은 App Server가 사용하는 Codex 로그인 상태에 의존합니다.
- App Server 주소를 바꾸려면 `CODEX_APP_SERVER_URL=ws://127.0.0.1:4500` 같은 값을 사용합니다.
- task별 `environment_variables` 는 App Server turn API에 직접 매핑되지 않으므로, 현재 실행 경로에서는 지원하지 않습니다.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend 기본 주소는 `http://localhost:5173` 입니다.
