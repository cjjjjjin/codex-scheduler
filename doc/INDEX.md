# doc/INDEX.md

`doc/` 디렉터리의 Markdown 문서를 빠르게 탐색하기 위한 인덱스이다.

작업 중 관련 문서를 찾을 때 먼저 이 파일을 확인한다.

## 문서 목록

### `ASSISTANT_UI_ADOPTION_PLAN.md`

- 주제: `assistant-ui`를 현재 React frontend에 제한적으로 도입하기 위한 구현 계획
- 용도: Chat workspace를 `assistant-ui` 기반으로 바꾸기 전 범위, 리스크, 단계별 실행 순서를 확인할 때 참고
- 핵심 포인트: `Task Rail`과 scheduler 도메인은 유지하고 `TaskChat`의 session 영역만 우선 도입 대상으로 본다

### `CODEX_APP_SERVER_RESEARCH.md`

- 주제: Codex App Server의 개념, 역할, 적용 적합성 조사
- 용도: App Server를 도입할지, SDK와 어떤 차이가 있는지 판단할 때 참고
- 핵심 포인트: `codex-scheduler` 같은 자동화 백엔드에는 App Server보다 SDK가 더 직접적이라는 정리 포함

### `CODEX_PROJECT_STRUCTURE.md`

- 주제: `codex/` 참조 저장소 전체 구조와 `codex-rs/app*` 계열 요약
- 용도: 참조 프로젝트의 어느 디렉터리를 어떤 목적으로 봐야 하는지 파악할 때 참고
- 핵심 포인트: `app-server`, `app-server-protocol`, `app-server-client`, `app-server-test-client` 역할 정리

### `CODEX_SDK_ANALYSIS.md`

- 주제: Codex SDK의 개념, thread 모델, 현재 프로젝트 적합성 분석
- 용도: 왜 현재 구현 방향이 `@openai/codex-sdk` 중심인지 확인할 때 참고
- 핵심 포인트: thread 생성, thread resume, backend 직접 호출 패턴 정리

### `CODEX_SDK_PROJECT_RESEARCH.md`

- 주제: `@openai/codex-sdk`를 사용하는 외부 프로젝트 사례 조사
- 용도: 공개 사례 기반의 구현 패턴을 참고할 때 사용
- 핵심 포인트: 실제 프로젝트들이 `startThread()` / `resumeThread()` 흐름을 어떻게 쓰는지 확인 가능

### `TASK_DB_SCHEMA_REVIEW.md`

- 주제: Task 및 실행 이력 SQLite 스키마 검토
- 용도: backend DB 구조와 SPEC 정합성을 확인할 때 참고
- 핵심 포인트: 스키마 반영 현황과 남은 운영 판단 포인트 정리

## 추천 참고 순서

상황별로 아래 순서를 기본으로 삼는다.

1. 프로젝트 전체 방향 확인
   - `SPEC.md`
   - `MEMORY.md`
   - `doc/INDEX.md`
2. Codex 연동 방식 판단
   - `CODEX_SDK_ANALYSIS.md`
   - `CODEX_APP_SERVER_RESEARCH.md`
   - `CODEX_SDK_PROJECT_RESEARCH.md`
3. 참조 저장소 구조 확인
   - `CODEX_PROJECT_STRUCTURE.md`
4. DB/저장 구조 확인
   - `TASK_DB_SCHEMA_REVIEW.md`
