# moaring — Unit of Work Plan

> **목적**: 시스템을 독립적으로 개발 가능한 Unit으로 분해
> **상태**: 답변 대기 중
>
> 각 `[Answer]:` 태그 뒤에 답변을 작성해주세요.
> 완료 후 "완료" 또는 "done"이라고 알려주세요.

---

## 실행 체크리스트

- [x] Unit 분해 질문 답변 수집
- [x] unit-of-work.md 생성
- [x] unit-of-work-dependency.md 생성
- [x] unit-of-work-story-map.md 생성

---

## A. Unit 구성 (Story Grouping)

### Question 1
Application Design에서 4개 Unit이 예상됐습니다. 이 구성에 동의하시나요?

예상 Unit:
- Unit 1: 인프라 (IaC) — AWS 리소스 프로비저닝 (ECS, Aurora, Cognito, S3, CloudFront)
- Unit 2: 백엔드 API — Next.js API Routes, DB 스키마, Service 레이어
- Unit 3: 프론트엔드 — 웹앱 UI (인박스, 그룹, 컬렉션, 검색, 공유 페이지)
- Unit 4: Chrome Extension — MV3 팝업, Cognito 인증, topSites 추천

A) 동의 — 4개 Unit 그대로 진행  
B) 백엔드와 프론트엔드를 하나로 합침 — Next.js 풀스택이므로 단일 Unit으로 관리  
C) 인프라를 별도 Unit으로 분리하지 않음 — 코드와 함께 관리  
X) Other (please describe after [Answer]: tag below)

[Answer]: B

> **💡 추천: B) 백엔드+프론트엔드 합침**
> moaring은 Next.js 풀스택 단일 코드베이스로 결정됐습니다. API Route Handler, Server Action, UI 컴포넌트, Service 레이어가 모두 같은 Next.js 프로젝트 안에 있습니다. 이를 백엔드/프론트엔드로 나누면 같은 파일을 두 Unit이 공유하게 되어 경계가 모호해집니다. 하나의 Next.js 앱 Unit으로 관리하는 것이 자연스럽고, 인프라(IaC)와 Extension만 별도 Unit으로 분리하면 충분합니다.

### Question 2
Unit을 B로 합칠 경우, 최종 Unit 구성은?

A) Unit 1: 인프라 (IaC) / Unit 2: Next.js 앱 (백엔드+프론트엔드) / Unit 3: Chrome Extension — 3개 Unit  
B) Unit 1: Next.js 앱 (백엔드+프론트엔드) / Unit 2: Chrome Extension — 2개 Unit (인프라는 앱과 함께)  
C) Unit 1: 인프라 (IaC) / Unit 2: Next.js 앱 + Chrome Extension — 2개 Unit  
X) Other (please describe after [Answer]: tag below)

[Answer]: A

> **💡 추천: A) 3개 Unit (인프라 / Next.js 앱 / Chrome Extension)**
> 인프라(IaC)는 AWS CDK 코드로 앱 코드와 성격이 완전히 다릅니다. 배포 주기도 다르고(인프라는 초기 1회 + 변경 시, 앱은 매 배포), 담당자도 다를 수 있습니다. 인프라를 별도 Unit으로 분리하면 각 Unit의 책임이 명확해지고, 인프라 변경이 앱 코드 리뷰에 섞이지 않습니다. Chrome Extension도 MV3 빌드 파이프라인이 Next.js와 다르므로 별도 Unit이 적합합니다.

---

## B. 의존성 및 개발 순서 (Dependencies)

### Question 3
Unit 간 개발 순서는 어떻게 할까요?

A) 순차적 — 인프라 → Next.js 앱 → Chrome Extension 순서로 완료 후 다음 진행  
B) 병렬 — 인프라와 Next.js 앱을 동시에 개발, Extension은 API 완성 후 시작  
C) Next.js 앱 먼저 — 로컬 환경에서 앱 개발 완료 후 인프라 배포, Extension은 마지막  
X) Other (please describe after [Answer]: tag below)

[Answer]: B

> **💡 추천: C) Next.js 앱 먼저**
> 인프라를 먼저 구성하면(A) AWS 환경이 준비될 때까지 앱 개발을 시작할 수 없어 대기 시간이 생깁니다. 로컬에서 Docker Compose로 PostgreSQL을 띄우고 Next.js 앱을 먼저 개발하면 AWS 없이도 대부분의 기능을 구현하고 테스트할 수 있습니다. 앱이 어느 정도 완성된 후 인프라를 구성하고 배포하면 됩니다. Extension은 API가 안정화된 후 개발하는 것이 재작업을 줄입니다.

### Question 4
Chrome Extension은 Next.js API가 어느 정도 완성되어야 개발 시작할 수 있나요?

A) API 전체 완성 후 — 모든 엔드포인트가 준비된 후 Extension 개발 시작  
B) 핵심 API만 완성 후 — 북마크 저장, 그룹 조회, 최근 목록 API만 있으면 시작 가능  
C) 동시 개발 — Mock API로 Extension 개발 시작, 실제 API 완성 시 교체  
X) Other (please describe after [Answer]: tag below)

[Answer]: C (대신 스펙은 미리 정해놓고 진행)

> **💡 추천: B) 핵심 API만 완성 후**
> Extension의 핵심 기능은 북마크 저장(`POST /api/bookmarks`), 그룹 목록 조회(`GET /api/groups`), 최근 저장 목록(`GET /api/bookmarks/recent`) 3개 API에 집중됩니다. 이 3개만 완성되면 Extension의 주요 기능을 개발하고 테스트할 수 있습니다. 전체 API 완성을 기다리면(A) 불필요하게 Extension 개발이 늦어지고, Mock API(C)는 나중에 실제 API로 교체할 때 추가 작업이 생깁니다.

---

## C. 기술 고려사항 (Technical Considerations)

### Question 5
인프라(IaC) 도구는 무엇을 사용할까요?

A) AWS CDK (TypeScript) — Next.js와 동일한 언어, 타입 안전  
B) Terraform — 범용적, 멀티 클라우드 지원  
C) AWS CloudFormation (YAML/JSON) — AWS 네이티브  
D) AWS CDK + 별도 레포 — 인프라 코드를 앱 코드와 분리  
X) Other (please describe after [Answer]: tag below)

[Answer]: A

> **💡 추천: A) AWS CDK (TypeScript)**
> moaring은 TypeScript 기반 프로젝트이므로 CDK를 TypeScript로 작성하면 앱 코드와 동일한 언어, 동일한 타입 시스템을 사용할 수 있습니다. ECS Task Definition, Aurora 클러스터, Cognito User Pool 등 복잡한 AWS 리소스를 타입 안전하게 정의할 수 있고, IDE 자동완성도 지원됩니다. Terraform(B)은 강력하지만 HCL 언어를 별도로 배워야 하고, CloudFormation(C)은 YAML이 장황합니다.

### Question 6
인프라 코드의 위치는?

A) 앱 레포 내 `infra/` 디렉토리 — 단일 레포(monorepo) 구조  
B) 별도 레포 — 인프라와 앱 코드 완전 분리  
C) `packages/infra/` — monorepo 패키지 구조  
X) Other (please describe after [Answer]: tag below)

[Answer]: A

> **💡 추천: A) `infra/` 디렉토리 (단일 레포)**
> MVP 단계에서는 인프라와 앱 코드를 같은 레포에서 관리하는 것이 편리합니다. 앱 코드 변경과 인프라 변경을 하나의 PR에서 함께 리뷰할 수 있고, 환경변수나 설정값을 공유하기도 쉽습니다. 별도 레포(B)는 팀이 커지고 인프라 변경 빈도가 높아질 때 고려하면 됩니다. `packages/infra/`(C)는 Turborepo 같은 monorepo 도구가 필요해 초기 설정이 복잡합니다.

### Question 7
Chrome Extension 코드의 위치는?

A) 앱 레포 내 `extension/` 디렉토리 — 단일 레포  
B) 별도 레포 — Extension과 앱 코드 분리  
C) `packages/extension/` — monorepo 패키지 구조  
X) Other (please describe after [Answer]: tag below)

[Answer]: A

> **💡 추천: A) `extension/` 디렉토리 (단일 레포)**
> Extension은 moaring API를 직접 호출하므로 API 타입 정의를 공유하면 타입 안전성이 높아집니다. 같은 레포에 있으면 API 변경 시 Extension 코드도 함께 수정하기 쉽고, 공통 유틸리티(예: API 클라이언트 타입)를 재사용할 수 있습니다. Extension 빌드는 `extension/` 디렉토리 내 별도 `package.json`과 Vite/Webpack 설정으로 독립적으로 관리하면 됩니다.

---

## D. 코드 구성 (Code Organization)

### Question 8
전체 프로젝트 레포 구조는?

A) 단일 레포 (monorepo) — 앱/인프라/Extension 모두 하나의 레포  
B) 멀티 레포 — 각 Unit별 별도 레포  
C) 단일 레포 + Turborepo/Nx — monorepo 빌드 도구 사용  
X) Other (please describe after [Answer]: tag below)

[Answer]: A

> **💡 추천: A) 단일 레포 (monorepo)**
> MVP 단계에서는 단일 레포가 가장 단순하고 관리하기 쉽습니다. 앱/인프라/Extension이 모두 같은 레포에 있으면 전체 변경사항을 하나의 PR에서 추적할 수 있고, CI/CD 파이프라인도 단순하게 구성됩니다. Turborepo/Nx(C)는 빌드 캐싱 등 장점이 있지만 초기 설정 비용이 있습니다. 멀티 레포(B)는 팀이 커지고 독립 배포가 필요할 때 고려하면 됩니다.

### Question 9
로컬 개발 환경은 어떻게 구성할까요?

A) Docker Compose — 로컬에서 PostgreSQL + Next.js 컨테이너 실행  
B) 로컬 PostgreSQL + Next.js dev server — 컨테이너 없이 직접 실행  
C) AWS 개발 환경 — 로컬 대신 AWS dev 계정에 배포하여 개발  
X) Other (please describe after [Answer]: tag below)

[Answer]: A

> **💡 추천: A) Docker Compose**
> Docker Compose로 PostgreSQL을 띄우면 팀원 모두가 동일한 DB 환경에서 개발할 수 있습니다. `docker-compose.yml` 하나로 PostgreSQL + (선택적으로) Next.js 앱을 한 번에 실행할 수 있어 온보딩이 쉽습니다. 로컬 PostgreSQL 직접 설치(B)는 버전 관리가 어렵고, AWS 개발 환경(C)은 인터넷 연결이 필요하고 비용이 발생합니다. Next.js 앱 자체는 `next dev`로 직접 실행하고, DB만 Docker로 띄우는 방식이 가장 실용적입니다.
