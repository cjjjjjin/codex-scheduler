# OpenCode GUI Research

조사일: 2026-03-29

## 목적

이 문서는 `third-party/opencode/` 참조 프로젝트의 GUI 관련 구조를 파악하고, `codex-scheduler` UI 구현에 참고할 수 있는 설계 포인트를 정리하기 위한 문서이다.

검토 범위는 주로 아래 디렉터리이다.

- `third-party/opencode/packages/app`
- `third-party/opencode/packages/desktop`
- `third-party/opencode/packages/desktop-electron`
- `third-party/opencode/packages/ui`
- `third-party/opencode/packages/storybook`
- `third-party/opencode/packages/web`
- `third-party/opencode/packages/console/app`

## 결론 요약

`opencode`는 GUI를 한 가지 방식으로만 구현한 프로젝트가 아니다.

확인된 구조는 아래와 같다.

- 메인 앱 UI는 `Solid + Vite` 기반이다.
- 데스크톱 앱 셸은 `Tauri` 와 `Electron` 두 가지 구현이 공존한다.
- 공통 UI 컴포넌트는 `packages/ui` 에서 별도 패키지로 관리된다.
- 컴포넌트 단위 검증/문서화는 `Storybook` 으로 분리되어 있다.
- 별도의 마케팅/문서 웹은 `packages/web`, 운영용 콘솔 웹앱은 `packages/console/app` 으로 분리되어 있다.

즉, `opencode`의 GUI 아키텍처는 아래 패턴으로 이해하는 것이 적절하다.

1. 공통 앱 UI를 웹 기술로 구현
2. 플랫폼별 데스크톱 셸은 별도 패키지로 감싸기
3. 공유 UI 라이브러리를 별도 패키지로 유지
4. 문서/마케팅/운영 콘솔은 메인 앱과 분리

## 루트 수준 관찰

루트 `package.json` 기준 GUI 관련 실행 스크립트는 아래처럼 드러난다.

- `dev:web`
  - `packages/app` 개발 서버 실행
- `dev:desktop`
  - `packages/desktop` 의 Tauri 개발 실행
- `dev:storybook`
  - `packages/storybook` 실행

이로부터 확인되는 점은 아래와 같다.

- 웹 앱과 데스크톱 앱을 명시적으로 구분한다.
- 데스크톱 앱의 기본 개발 경로는 현재 `packages/desktop` 기준이다.
- UI 컴포넌트 개발/검증 경로가 별도로 존재한다.

## 패키지별 역할

### 1. `packages/app`

역할:

- 메인 애플리케이션 UI
- 공통 앱 셸
- 웹 실행 기준의 주 화면

기술 스택:

- `solid-js`
- `@solidjs/router`
- `vite`
- `@kobalte/core`
- `@tanstack/solid-query`
- `@opencode-ai/ui`

핵심 파일:

- `src/entry.tsx`
  - 웹 실행 진입점
- `src/app.tsx`
  - `AppInterface` 와 여러 provider를 묶는 메인 앱 구성

구조적 특징:

- `AppBaseProviders` 로 테마, i18n, query, dialog, marked 렌더링 등을 공통 제공한다.
- `AppInterface` 가 실제 애플리케이션의 중심 UI 역할을 한다.
- 플랫폼 종속 기능은 `PlatformProvider` 를 통해 주입받는다.

즉, `packages/app` 은 "플랫폼 중립적인 앱 UI 본체"에 해당한다.

### 2. `packages/desktop`

역할:

- Tauri 기반 데스크톱 앱 셸

기술 스택:

- `@tauri-apps/api`
- 여러 Tauri plugin
- `solid-js`
- 내부적으로 `@opencode-ai/app` 재사용

핵심 파일:

- `src/index.tsx`
  - 데스크톱 렌더러 진입점
- `src-tauri/Cargo.toml`
  - Tauri 네이티브 런타임 구성
- `src/bindings.ts`
  - 네이티브 bridge 관련 코드

구조적 특징:

- `@opencode-ai/app` 로부터 `AppBaseProviders`, `AppInterface`, `PlatformProvider` 를 가져온다.
- 파일 선택, 링크 열기, 알림, 업데이트, 저장소 접근 같은 데스크톱 기능은 Tauri API로 구현한다.
- 즉 UI 자체를 새로 만드는 것이 아니라 공통 앱 UI를 Tauri 플랫폼 환경에 맞게 감싼다.

### 3. `packages/desktop-electron`

역할:

- Electron 기반 데스크톱 앱 셸

기술 스택:

- `electron`
- `electron-vite`
- `electron-builder`
- `electron-updater`
- `electron-store`
- 내부적으로 `@opencode-ai/app` 재사용

핵심 디렉터리:

- `src/main`
  - Electron main process
- `src/preload`
  - preload bridge
- `src/renderer`
  - renderer UI

핵심 파일:

- `src/main/index.ts`
  - 창 생성, IPC 등록, 로컬 sidecar 서버 기동, updater 연동
- `src/renderer/index.tsx`
  - renderer 진입점

구조적 특징:

- renderer는 Tauri 버전과 비슷하게 `@opencode-ai/app` 의 공통 UI를 재사용한다.
- Electron main process는 로컬 server process, 앱 lifecycle, deep link, 메뉴, updater, 저장 설정 등을 관리한다.
- 즉 Electron 경로는 "공통 앱 UI + Electron 운영 레이어" 구조이다.

주의:

- `packages/desktop-electron/README.md` 는 현재 내용상 Tauri 기준 설명이 들어 있어 실제 패키지 상태와 맞지 않는다.
- 문서가 오래되었거나 복사된 흔적으로 보이며, README만 보고 패키지 성격을 판단하면 혼동될 수 있다.

### 4. `packages/ui`

역할:

- 공통 UI 컴포넌트 라이브러리

구성:

- `src/components`
  - 버튼, 다이얼로그, 파일 표시, markdown, session-turn, toast 등 다수 컴포넌트
- `src/context`
  - i18n, dialog, file, marked 등 context 계층
- `src/styles`
  - 공통 스타일
- `src/theme`
  - 테마 로더 및 테마 타입
- `src/i18n`
  - 다국어 사전

구조적 특징:

- 앱 셸과 컴포넌트 라이브러리를 분리해 재사용성을 높인다.
- Storybook과 연결되기 좋은 구조다.
- 데스크톱 셸과 웹 앱이 모두 같은 UI 자산을 사용할 수 있게 되어 있다.

### 5. `packages/storybook`

역할:

- UI 컴포넌트 문서화 및 독립 검증 환경

구성 특징:

- `storybook-solidjs-vite` 사용
- `@opencode-ai/ui` 의 component story를 기반으로 실행

의미:

- UI 개발을 메인 앱과 분리해 반복 속도를 높일 수 있다.
- 시각 컴포넌트와 상호작용을 독립적으로 확인할 수 있다.

### 6. `packages/web`

역할:

- 마케팅/문서용 웹사이트

기술 스택:

- `astro`
- `@astrojs/starlight`
- `@astrojs/solid-js`

의미:

- 메인 앱 UI와 제품 소개/문서 사이트를 명확히 분리한다.
- 애플리케이션 인터페이스와 공식 웹사이트를 같은 코드베이스에서 관리하되 패키지를 나눈 구조다.

### 7. `packages/console/app`

역할:

- 별도 콘솔/운영 성격의 웹앱

구성 특징:

- `src/app.tsx`
- `entry-client.tsx`
- `entry-server.tsx`

의미:

- 메인 사용자용 앱과 운영/관리용 앱이 분리되어 있을 가능성이 크다.
- GUI를 한 덩어리로 만들지 않고 사용 목적에 따라 표면을 나눈 사례로 볼 수 있다.

## GUI 아키텍처 관점에서의 핵심 패턴

### 1. 공통 앱 코어 + 플랫폼 셸 분리

`packages/app` 가 UI 중심 코어이고, `packages/desktop` 과 `packages/desktop-electron` 이 이를 감싸는 구조다.

이 패턴의 장점:

- 웹과 데스크톱 간 UI 중복이 줄어든다.
- 플랫폼 차이는 `Platform` 구현에 한정할 수 있다.
- 기능 개발은 공통 UI 쪽에서, OS 연동은 셸 쪽에서 나눠서 진행할 수 있다.

### 2. UI 컴포넌트 별도 패키지화

`packages/ui` 로 UI를 분리해 앱 셸 코드와 컴포넌트 코드를 분리한다.

이 패턴의 장점:

- 앱 로직과 표현 계층이 섞이지 않는다.
- Storybook과 연동하기 쉽다.
- 컴포넌트 재사용과 테스트가 편해진다.

### 3. 플랫폼 기능을 interface로 주입

웹과 데스크톱 모두 `PlatformProvider` 를 통해 기능을 주입한다.

예:

- 파일 선택기
- 링크 열기
- 알림
- 저장소 접근
- 업데이트
- 재시작

이 패턴의 장점:

- UI 코드가 특정 플랫폼 API에 직접 의존하지 않는다.
- 웹과 데스크톱 실행 환경을 같은 앱 구조 안에서 공존시킬 수 있다.

### 4. 문서/운영/앱 표면 분리

`packages/app`, `packages/web`, `packages/console/app`, `packages/storybook` 이 분리되어 있다.

이 패턴의 장점:

- 목적이 다른 GUI를 하나의 프론트엔드 프로젝트에 억지로 섞지 않는다.
- 사용자 앱, 문서 사이트, 운영 콘솔, 컴포넌트 문서화를 서로 독립적으로 발전시킬 수 있다.

## codex-scheduler 관점의 참고 포인트

현재 `codex-scheduler` 는 React + TypeScript 기반 단일 프론트엔드를 갖고 있다.

`opencode` GUI 구조에서 참고할 만한 포인트는 아래와 같다.

### 참고 가치가 높은 부분

1. 공통 UI와 플랫폼 연동 계층 분리
   - 향후 웹 UI 외 데스크톱 래퍼가 필요해질 경우 유용하다.
2. UI 컴포넌트 라이브러리 분리
   - Task 표, 상태 배지, 실행 이력 패널, 폼 컴포넌트 등을 재사용 가능한 컴포넌트로 분리하기 좋다.
3. Storybook 같은 독립 UI 검증 환경
   - 관리형 UI를 더 크게 키울 경우 유용하다.
4. 문서/관리/앱의 목적별 표면 분리
   - 나중에 관리자용 별도 화면이 생겨도 앱 본체와 분리하기 쉬운 방향이다.

### 당장 과한 부분

1. Tauri와 Electron을 동시에 유지하는 다중 데스크톱 셸
2. sidecar 프로세스와 deep link, updater, OS integration 전체 스택
3. 다수 패키지로 쪼개진 대규모 모노레포 프론트엔드 구조

현재 `codex-scheduler` 범위에서는 웹 프론트엔드 단일 패키지로 유지하되, 내부적으로 컴포넌트 분리와 플랫폼 의존성 최소화 정도를 먼저 참고하는 것이 현실적이다.

## 최종 판단

`opencode` 는 GUI를 적극적으로 설계한 프로젝트이며, 다음 항목이 명확히 존재한다.

- 웹 GUI
- Tauri 기반 데스크톱 GUI
- Electron 기반 데스크톱 GUI
- 공통 UI 컴포넌트 패키지
- Storybook 기반 컴포넌트 문서화/검증

따라서 `third-party/opencode/` 는 GUI 구조를 참고하기에 충분히 가치가 있는 레퍼런스이다.

다만 우리 프로젝트에 적용할 때는 전체 구조를 그대로 모방하기보다 아래 순서로 참고하는 것이 적절하다.

1. 공통 UI 컴포넌트 분리 방식
2. 플랫폼 기능 주입 방식
3. 앱 표면 분리 방식
4. 필요할 때만 데스크톱 셸 구조 참고
