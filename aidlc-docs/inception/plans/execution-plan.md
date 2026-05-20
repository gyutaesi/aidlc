# moaring — Execution Plan

> **작성일**: 2026-05-20  
> **프로젝트 유형**: Greenfield  
> **상태**: 승인 대기

---

## 1. 상세 분석 요약 (Detailed Analysis Summary)

### 변경 영향 평가 (Change Impact Assessment)

| 영역 | 해당 여부 | 설명 |
|------|-----------|------|
| **사용자 대면 변경** | Yes | 웹 앱 전체 UI, Chrome Extension 팝업, 공유 페이지 |
| **구조적 변경** | Yes | 신규 시스템 — 프론트엔드 + 백엔드 + Extension + 인프라 |
| **데이터 모델 변경** | Yes | 신규 DB 스키마 (Bookmark, Group, Collection, Block 등) |
| **API 변경** | Yes | 신규 REST API 전체 설계 필요 |
| **NFR 영향** | Yes | 성능(검색 300ms), 보안(Cognito/JWT), 확장성(Aurora Serverless) |

### 리스크 평가 (Risk Assessment)

| 항목 | 수준 |
|------|------|
| **리스크 레벨** | Medium-High |
| **롤백 복잡도** | Moderate (Greenfield이므로 롤백보다 재시작이 용이) |
| **테스트 복잡도** | Complex (웹앱 + Extension + Lambda 통합 테스트 필요) |
| **주요 리스크** | Chrome Extension MV3 Cognito 인증 제약, Aurora Serverless v2 콜드 스타트, JSONB 블록 검색 성능 |

---

## 2. 워크플로우 시각화 (Workflow Visualization)

```
[Start: moaring 신규 개발 요청]
        |
        v
+------------------------------------------+
|  🔵 INCEPTION PHASE                      |
+------------------------------------------+
| [x] Workspace Detection    COMPLETED     |
| [x] Reverse Engineering    SKIPPED       |
| [x] Requirements Analysis  COMPLETED     |
| [ ] User Stories           SKIP          |
| [x] Workflow Planning      IN PROGRESS   |
| [ ] Application Design     EXECUTE       |
| [ ] Units Generation       EXECUTE       |
+------------------------------------------+
        |
        v
+------------------------------------------+
|  🟢 CONSTRUCTION PHASE (per unit)        |
+------------------------------------------+
| [ ] Functional Design      EXECUTE       |
| [ ] NFR Requirements       EXECUTE       |
| [ ] NFR Design             EXECUTE       |
| [ ] Infrastructure Design  EXECUTE       |
| [ ] Code Generation        EXECUTE       |
+------------------------------------------+
        |
        v
+------------------------------------------+
|  🟢 CONSTRUCTION PHASE                   |
+------------------------------------------+
| [ ] Build and Test         EXECUTE       |
+------------------------------------------+
        |
        v
+------------------------------------------+
|  🟡 OPERATIONS PHASE                     |
+------------------------------------------+
| [ ] Operations             PLACEHOLDER   |
+------------------------------------------+
        |
        v
[Complete]
```

---

## 3. 실행할 단계 (Phases to Execute)

### 🔵 INCEPTION PHASE

- [x] **Workspace Detection** — COMPLETED
  - Greenfield 프로젝트 확인, aidlc-state.md 생성
- [x] **Reverse Engineering** — SKIPPED
  - Greenfield이므로 기존 코드 없음
- [x] **Requirements Analysis** — COMPLETED
  - moaring 요구사항 문서 완성 (FR 9개 섹션, NFR 6개 섹션, 데이터 모델)
- [ ] **User Stories** — **SKIP**
  - 근거: 요구사항이 이미 매우 상세하게 정의됨. 8개 기능 모두 명확한 FR로 문서화. 추가 User Stories가 구현에 새로운 가치를 더하지 않음.
- [x] **Workflow Planning** — IN PROGRESS
- [ ] **Application Design** — **EXECUTE**
  - 근거: 신규 시스템으로 웹앱(Next.js), 백엔드 API, Chrome Extension 등 다수의 신규 컴포넌트 설계 필요. 컴포넌트 간 의존성과 서비스 레이어 정의가 코드 생성 전에 필요.
- [ ] **Units Generation** — **EXECUTE**
  - 근거: 독립적으로 개발 가능한 단위가 명확히 분리됨 (프론트엔드, 백엔드 API, Chrome Extension, 인프라/Lambda). 병렬 개발 및 단계적 구현을 위해 Unit 분리 필요.

### 🟢 CONSTRUCTION PHASE (per unit)

- [ ] **Functional Design** — **EXECUTE**
  - 근거: 컬렉션 블록 구조(JSONB), 좋아요 중복 방지, 링크 클릭 통계, 슬러그 중복 체크 등 복잡한 비즈니스 로직 설계 필요.
- [ ] **NFR Requirements** — **EXECUTE**
  - 근거: 검색 성능(300ms), Cognito JWT 인증 흐름, S3 Pre-signed URL, Aurora Serverless v2 연결 풀링 등 NFR 구현 패턴 결정 필요.
- [ ] **NFR Design** — **EXECUTE**
  - 근거: NFR Requirements 실행 예정이므로 NFR 패턴을 설계에 반영.
- [ ] **Infrastructure Design** — **EXECUTE**
  - 근거: ECS/Fargate, Aurora Serverless v2, Cognito, S3, CloudFront 등 AWS 인프라 매핑 필요. IaC(CDK 또는 Terraform) 구조 결정 필요.
- [ ] **Code Generation** — **EXECUTE** (ALWAYS)
  - Part 1: 코드 생성 계획 수립
  - Part 2: 코드 생성 실행

### 🟢 CONSTRUCTION PHASE

- [ ] **Build and Test** — **EXECUTE** (ALWAYS)
  - 빌드 지침, 단위 테스트, 통합 테스트, E2E 테스트 지침 생성

### 🟡 OPERATIONS PHASE

- [ ] **Operations** — PLACEHOLDER
  - 향후 배포 및 모니터링 워크플로우 확장 예정

---

## 4. 예상 Unit 구성 (Units Generation 예상)

Units Generation 단계에서 아래와 같이 분리될 것으로 예상:

| Unit | 설명 | 주요 기술 |
|------|------|-----------|
| **Unit 1: 인프라 (IaC)** | AWS 리소스 프로비저닝 | CDK/Terraform, ECS, Aurora, Cognito, S3, CloudFront |
| **Unit 2: 백엔드 API** | Next.js API Routes, DB 스키마, 비즈니스 로직 | Next.js, Prisma/Drizzle, PostgreSQL |
| **Unit 3: 프론트엔드** | 웹 앱 UI (인박스, 그룹, 컬렉션, 검색, 공유 페이지) | Next.js, React, TailwindCSS |
| **Unit 4: Chrome Extension** | MV3 Extension 팝업, Cognito 인증 | React, MV3, chrome.topSites |

---

## 5. 성공 기준 (Success Criteria)

| 항목 | 기준 |
|------|------|
| **주요 목표** | moaring MVP 전체 기능 구현 및 AWS 배포 가능 상태 |
| **핵심 산출물** | 동작하는 웹앱, Chrome Extension, AWS 인프라 코드, 테스트 |
| **품질 게이트** | 빌드 성공, 단위 테스트 통과, 통합 테스트 통과 |
| **성능 기준** | 검색 응답 < 300ms, 공유 페이지 로딩 < 1.5s |
