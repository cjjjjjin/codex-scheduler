# codex-schedule

`codex-schedule` 는 CRON 스케줄에 맞춰 Codex thread로 Prompt를 전달하는 프로젝트입니다.

## 구조

- `backend`: FastAPI + SQLite 기반 API 및 스케줄러
- `frontend`: React + TypeScript 기반 관리 UI
- `codex-bridge`: Node.js + Codex SDK 브리지

## 현재 구현 범위

- Task 생성, 조회, 수정, 삭제
- Task enable/disable
- Task 실행 이력 조회
- CRON 기반 `next_run_at` 계산
- 백엔드 내부 스케줄러 루프
- Codex 연동 서비스 인터페이스

## Codex 연동 방향

- Codex 연동은 `Codex SDK` 기준으로 진행합니다.
- `Task.session_id` 는 실제 구현상 `Codex thread ID` 를 의미합니다.
- Task 생성 시 thread를 만들고, 이후 스케줄 실행 시 같은 thread를 resume 해서 prompt를 전달하는 흐름을 목표로 합니다.
- Codex SDK는 TypeScript 라이브러리이므로, 현재 Python backend에서는 Node.js bridge 또는 별도 서비스가 필요합니다.

## 주의 사항

현재 `backend/app/services/codex_service.py` 는 실제 Codex SDK 호출이 아닌 더미 구현입니다.
실제 연동 시 해당 서비스에서 thread 생성 및 prompt 전달 로직을 교체해야 합니다.

## 실행 방법

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

backend Python 개발 환경은 `backend/.venv` 를 기준으로 사용합니다.
VS Code 디버그 실행도 동일한 가상환경 인터프리터를 사용하도록 설정되어 있습니다.
Windows 환경에서는 `Asia/Seoul` 타임존 로드를 위해 `tzdata` 패키지가 함께 설치됩니다.

API 기본 주소는 `http://localhost:8000/api` 입니다.

### Codex Bridge

```bash
cd codex-bridge
npm install
```

- Node.js 18 이상이 필요합니다.
- backend는 `node codex-bridge/src/main.mjs` 를 subprocess로 호출합니다.
- 기본 workspace directory는 저장소 루트이며, 필요하면 `CODEX_WORKSPACE_DIR` 환경 변수로 override 할 수 있습니다.
- Codex 인증은 Codex SDK가 사용하는 환경 변수 또는 Codex 로그인 상태에 의존합니다.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend 기본 주소는 `http://localhost:5173` 입니다.
