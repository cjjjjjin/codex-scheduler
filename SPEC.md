# codex-scheduler SPEC

OpenAI Codex CLI를 지정한 주기에 지정한 Session에 메세지를 전달하는 Backend, Frontend 프로젝트 입니다.

## 프로젝트 범위

본 프로젝트의 1차 목표는 아래 기능을 안정적으로 제공하는 것입니다.

- Task 생성, 조회, 수정, 삭제
- Task enable/disable
- CRON 기반 스케쥴 실행
- 지정된 시점에 Codex Session으로 Prompt 전달
- 실행 결과 추적

## 정의

### Task

해당 프로젝트에서 표현하는 작업 단위
Task는 아래의 정보를 가진다
- 고유 ID
- 스케쥴 정보: CRON 스타일의 스케쥴 정의
- CODEX Session ID
- 스케쥴이 설정된 시간에 전달 할 Prompt
- Enable 여부
- 생성 일시
- 수정 일시

### Task 식별자

- Task는 시스템 내부에서 고유한 ID로 식별한다.
- 수정, 삭제, enable/disable 대상 지정은 Task ID 기준으로 처리한다.

### 시간 기준

- 모든 스케쥴 해석과 실행 기준 시간대는 기본적으로 서버 로컬 시간대가 아닌 고정된 하나의 애플리케이션 시간대를 사용한다.
- 1차 버전의 기본 시간대는 `Asia/Seoul` 로 한다.
- Task 별 개별 시간대 설정은 1차 범위에 포함하지 않는다.

### 실행 이력

스케쥴러가 Task를 실행할 때마다 실행 이력을 남긴다.

- 실행 대상 Task ID
- 실행 대상 CODEX Session ID
- 실행 시각
- 실행 결과 상태: 성공 / 실패
- 실패 시 에러 메시지

### 저장 방식

- 1차 버전에서는 Task 정보와 실행 이력을 영속 저장해야 한다.
- 저장소 구현은 backend에서 관리한다.
- 구체 저장 엔진은 구현 단계에서 선택할 수 있으나, 최소 요구사항은 애플리케이션 재시작 이후에도 데이터가 유지되는 것이다.

## 기능

- backend: python, fastapi
- frontend: typescript, react

### Task 관리

#### Task 추가 기능

- task를 추가 할 수 있는 GUI 제공
- 전달 받는 정보는 없으며, 생성 시 CODEX Session을 생성하여 ID 할당
- 생성 시 입력 값은 스케쥴 정보와 Prompt 이다.
- CODEX Session ID는 사용자가 직접 입력하지 않는다.
- Session 생성 실패 시 Task 생성도 실패로 처리한다.

#### Task 편집 기능

- 스케쥴 수정
- Prompt 수정
- CODEX Session ID는 Task 편집 대상이 아니다.
- 수정된 내용은 저장 이후 다음 스케쥴 실행부터 적용된다.

#### Task 삭제 기능

- Task 삭제
- 1차 버전에서는 hard delete 로 처리한다.

#### Task enable/disable 기능

- Task를 enable/disable 할 수 있는 UI
- disable 상태의 Task는 스케쥴 실행 대상에서 제외한다.

### 스케쥴러 기능

- 각 Task의 스케쥴 정보에 해당하는 시기에 Codex를 이용하여 지정된 Session에 Prompt를 전달
- enable=true 인 Task만 실행 대상이다.
- 실행 성공/실패 여부를 실행 이력에 기록한다.
- 실행 실패 시 해당 실행 건은 실패로 기록하고, 다음 스케쥴 주기는 정상적으로 계속 진행한다.
- 1차 버전에서는 자동 재시도 기능을 필수 요구사항으로 두지 않는다.

## Backend 요구사항

- Python + FastAPI 기반으로 구현한다.
- 아래 API 범위를 기본 제공한다.
  - Task 목록 조회
  - Task 상세 조회
  - Task 생성
  - Task 수정
  - Task 삭제
  - Task enable/disable 변경
  - Task 실행 이력 조회
- 스케쥴러는 backend 내부 구성요소로 동작한다.
- Codex 호출 로직은 API 계층과 분리된 서비스 계층으로 구성한다.

## Frontend 요구사항

- TypeScript + React 기반으로 구현한다.
- 아래 UI를 기본 제공한다.
  - Task 목록 화면
  - Task 생성 화면 또는 입력 UI
  - Task 수정 UI
  - Task 삭제 UI
  - Task enable/disable 토글 UI
  - Task 실행 이력 확인 UI
- Task 생성/수정 시 사용자가 직접 입력하는 값은 스케쥴과 Prompt 중심이어야 한다.
- Session ID는 조회용 정보로 표시할 수 있으나, 생성 시 직접 입력받지 않는다.

## Codex 연동 요구사항

- Task 생성 시 새로운 CODEX Session을 생성하고, 생성된 Session ID를 Task에 저장한다.
- 스케쥴 실행 시 저장된 Session ID를 이용해 Prompt를 전달한다.
- Session 생성 또는 Prompt 전달 실패 시 backend에서 오류를 감지하고 기록해야 한다.

## 설정 및 운영

- Codex 실행에 필요한 민감 정보는 소스코드에 하드코딩하지 않는다.
- 인증 정보 및 환경별 설정값은 환경 변수 또는 별도 설정 파일로 관리한다.
- 스케쥴러 및 Codex 연동 실패 원인을 확인할 수 있도록 로그를 남긴다.

## 향후 확장 가능 항목

아래는 1차 버전의 필수 범위는 아니지만, 이후 확장 가능 항목이다.

- Task 별 시간대 설정
- 실행 실패 자동 재시도
- 실행 결과 알림
- Prompt 템플릿 기능
- 실행 이력 검색 및 필터링
