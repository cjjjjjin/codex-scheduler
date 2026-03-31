# Assistant UI Adoption Plan

조사일: 2026-03-31

## 목적

이 문서는 `codex-scheduler` frontend에 `assistant-ui`를 도입하기 위한 구현 계획을 정리한다.

목표는 전체 앱을 교체하는 것이 아니라, 현재 `Task Rail + Session Workspace + Execution History` 구조를 유지한 채 우측 채팅 영역을 `assistant-ui` 기반 UX로 개선하는 것이다.

## 현재 전제

- 현재 frontend는 `React + TypeScript + Vite` 기반이다.
- 좌측 영역은 Task 선택과 편집을 담당한다.
- 우측 영역은 선택된 Task의 Codex thread와 연결된 채팅 및 실행 이력을 보여준다.
- `Task`는 일반 채팅 세션이 아니라 scheduler 도메인의 소유 단위다.

즉, `assistant-ui`를 앱 전체 셸이 아니라 `session workspace`에 제한적으로 도입하는 접근이 가장 적절하다.

## 도입 목표

1. 메시지 리스트를 `assistant-ui` 스타일 또는 실제 컴포넌트로 전환
2. composer 입력 경험을 개선
3. sending / error / empty state를 더 일관된 chat UX로 정리
4. 현재 backend API와 Task 중심 데이터 모델은 유지

## 비도입 범위

아래 영역은 1차 도입 범위에서 제외한다.

- 좌측 `Task Rail`
- `TaskForm`
- `ExecutionPanel`
- backend API 구조 변경
- Task 생성 시 thread 생성 흐름 변경

## 구현 원칙

### 1. 최소 침습

기존 파일 구조를 최대한 유지한다.

- `TaskChat` 컴포넌트 이름은 유지
- 내부 구현만 `assistant-ui` 방식에 맞게 교체
- 필요 시 얇은 adapter 계층만 추가

### 2. create mode 분리 유지

`viewMode === "create"`는 일반 session chat이 아니라 Task 생성 플로우다.

따라서 1차 구현에서는 아래처럼 분리한다.

- `create` mode: 기존 draft composer 중심 UI 유지
- `chat` mode: `assistant-ui` 기반 session UI 적용

### 3. Task 중심 모델 유지

`assistant-ui`의 내부 세션 개념을 그대로 따르기보다, 현재 `Task -> thread -> messages` 구조를 우선한다.

필요한 경우 UI 컴포넌트에 맞는 view model만 변환한다.

## 단계별 계획

### 1. 패키지 호환성 검토

확인 항목:

- 현재 React 버전과의 호환성
- `assistant-ui` 필수 peer dependency
- `Vite + React` 환경에서의 직접 사용 가능 여부
- 추가 스타일 시스템 요구사항

판단 기준:

- 의존성이 과도하지 않으면 실제 패키지를 도입
- 충돌이 크면 패턴만 차용

### 2. 데이터 모델 매핑

현재 상태:

- `selectedTask`
- `chatMessagesByTask`
- `sendingTaskId`
- `handleSendMessage`

매핑 대상:

- `role`
- `content`
- `created_at`
- `sending` / `error` 상태

목표는 Task별 채팅 상태를 `assistant-ui`가 기대하는 메시지 구조로 연결하는 것이다.

### 3. chat mode 1차 교체

우선 아래 요소만 교체한다.

- 메시지 리스트
- assistant / user turn 표시
- composer
- pending / error 상태

유지 요소:

- 채팅 상단 metadata
- 선택된 Task의 thread / workspace 정보 표시

### 4. 레이아웃 정합성 조정

`assistant-ui`는 chat 중심 레이아웃을 가정하는 경우가 많다.

따라서 아래를 다시 맞춘다.

- workspace grid 비율
- composer 높이
- message scroll 영역
- mobile 레이아웃

### 5. 검증

필수 검증:

1. `npm run build`
2. Task 선택 시 메시지 전환
3. 전송 중 pending 상태 표시
4. error 상태 표시
5. create mode 유지 확인

## 예상 리스크

### 스타일 충돌

`assistant-ui`가 Tailwind / shadcn 계열 스타일 전제를 가지면 현재 CSS와 충돌할 수 있다.

대응:

- 도입 범위를 `TaskChat` 내부로 제한
- 필요 시 local wrapper class를 둔다

### 데이터 모델 차이

현재 앱은 scheduler 중심이며, 일반 AI chat app보다 상태가 단순하다.

대응:

- UI 어댑터 함수로 message model을 변환
- backend contract는 유지

### create mode 특수성

새 Task 생성은 일반 대화와 다르게 thread 생성까지 포함한다.

대응:

- create mode는 별도 화면 유지
- 일반 session에만 `assistant-ui` 적용

## 권장 1차 목표

1. `assistant-ui` 패키지 도입 가능 여부 확인
2. 가능하면 `TaskChat`의 chat mode만 실제 컴포넌트로 교체
3. create mode와 나머지 도메인 UI는 유지

이 접근이 가장 작은 변경으로 가장 큰 체감 개선을 준다.
