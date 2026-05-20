# moaring — Unit of Work

> **작성일**: 2026-05-20  
> **총 Unit 수**: 3개

---

## 개요

moaring은 단일 레포(monorepo) 구조로 3개의 독립적인 Unit으로 구성됩니다.

```
moaring/ (단일 레포)
├── app/              ← Unit 2: Next.js 앱
├── extension/        ← Unit 3: Chrome Extension
├── infra/            ← Unit 1: 인프라 (AWS CDK)
├── prisma/           ← DB 스키마 (Unit 2 소속)
├── docker-compose.yml ← 로컬 개발 환경
└── package.json
```

---

## Unit 1: 인프라 (Infrastructure)

### 기본 정보
| 항목 | 내용 |
|------|------|
| **Unit 이름** | Infrastructure |
| **디렉토리** | `infra/` |
| **기술 스택** | AWS CDK (TypeScript) |
| **개발 순서** | Next.js 앱과 병렬 개발 |

### 책임
AWS 리소스 프로비저닝 및 배포 파이프라인 구성

### 포함 범위
- **ECS/Fargate**: Next.js 앱 컨테이너 클러스터, Task Definition, Service
- **Aurora PostgreSQL Serverless v2**: DB 클러스터, 서브넷 그룹, 보안 그룹
- **Amazon Cognito**: User Pool, App Client, 이메일 설정
- **Amazon S3**: 이미지/파일 저장 버킷, 버킷 정책
- **Amazon CloudFront**: CDN 배포, OAC(Origin Access Control), 캐시 정책
- **ALB (Application Load Balancer)**: 리스너, 타겟 그룹, SSL 인증서
- **Amazon ECR**: 컨테이너 이미지 레지스트리
- **AWS Parameter Store**: 민감 정보 저장 (DB URL, Cognito 설정 등)
- **VPC/네트워킹**: VPC, 서브넷, 보안 그룹, NAT Gateway
- **IAM**: ECS Task Role, ECR 접근 권한

### 디렉토리 구조
```
infra/
├── bin/
│   └── moaring.ts          # CDK App 진입점
├── lib/
│   ├── network-stack.ts    # VPC, 서브넷, 보안 그룹
│   ├── database-stack.ts   # Aurora PostgreSQL
│   ├── auth-stack.ts       # Cognito User Pool
│   ├── storage-stack.ts    # S3 + CloudFront
│   ├── app-stack.ts        # ECS/Fargate + ALB + ECR
│   └── config-stack.ts     # Parameter Store
├── package.json
├── tsconfig.json
└── cdk.json
```

### 산출물
- CDK 스택 코드 (`infra/lib/`)
- `cdk.json` 설정
- 배포 가이드 (`infra/README.md`)

---

## Unit 2: Next.js 앱 (Application)

### 기본 정보
| 항목 | 내용 |
|------|------|
| **Unit 이름** | Application |
| **디렉토리** | `app/` (루트 기준 Next.js 프로젝트) |
| **기술 스택** | Next.js 15 (App Router), TypeScript, Prisma, TailwindCSS |
| **개발 순서** | 인프라와 병렬 개발 (로컬 Docker Compose 환경) |

### 책임
웹 애플리케이션 전체 — UI, API, 비즈니스 로직, DB 스키마

### 포함 범위

#### 백엔드
- **API Route Handlers** (`app/api/`): Chrome Extension 및 외부 클라이언트용 REST API
- **Server Actions** (`app/**/actions.ts`): 웹앱 내부 데이터 변경
- **Service Layer** (`lib/services/`): 9개 Service (Auth, Bookmark, Group, Collection, Metadata, Search, Tag, Storage, CollectionStats)
- **Prisma 스키마** (`prisma/schema.prisma`): DB 스키마 및 마이그레이션
- **Middleware** (`middleware.ts`): JWT 검증

#### 프론트엔드
- **페이지**: 인박스, 그룹 대시보드, 컬렉션 편집, 공개 컬렉션(`/c/{slug}`), 검색, Import, 설정, 로그인/회원가입
- **UI 컴포넌트** (`components/ui/`): 재사용 가능한 기본 컴포넌트
- **Feature 컴포넌트** (`components/features/`): 도메인별 복합 컴포넌트

### 디렉토리 구조
```
(루트)/
├── app/
│   ├── (auth)/             # 로그인, 회원가입
│   ├── (dashboard)/        # 보호된 대시보드 페이지
│   │   ├── inbox/
│   │   ├── groups/
│   │   ├── collections/
│   │   └── settings/
│   ├── c/[slug]/           # 공개 컬렉션 (SSR)
│   └── api/                # API Route Handlers
│       ├── bookmarks/
│       ├── groups/
│       ├── collections/
│       ├── search/
│       ├── tags/
│       └── upload/
├── components/
│   ├── ui/
│   └── features/
├── lib/
│   ├── services/
│   ├── errors.ts
│   └── prisma.ts
├── prisma/
│   └── schema.prisma
├── middleware.ts
├── docker-compose.yml      # 로컬 PostgreSQL
├── package.json
└── next.config.ts
```

### 산출물
- Next.js 앱 전체 코드
- Prisma 스키마 및 마이그레이션
- `docker-compose.yml` (로컬 개발용)
- `Dockerfile` (ECS 배포용)

---

## Unit 3: Chrome Extension

### 기본 정보
| 항목 | 내용 |
|------|------|
| **Unit 이름** | Chrome Extension |
| **디렉토리** | `extension/` |
| **기술 스택** | React, TypeScript, MV3 (Manifest V3), Vite |
| **개발 순서** | API 스펙 정의 후 Mock API로 병렬 개발, 실제 API 완성 시 교체 |

### 책임
Chrome Extension 팝업 UI 및 브라우저 통합

### 포함 범위
- **팝업 UI**: 현재 페이지 저장, 자동 추천(topSites), 최근 저장 목록
- **인증**: Cognito 로그인, `chrome.storage.local` 토큰 관리
- **API 클라이언트**: moaring API 호출 래퍼 (토큰 자동 첨부)
- **추천 엔진**: `chrome.topSites` API 기반 미등록 사이트 필터링
- **MV3 설정**: `manifest.json`, 권한 설정, 서비스 워커

### 개발 전제 조건 (핵심 API 스펙)
Extension 개발 시작 전 아래 API 스펙이 정의되어야 합니다:
```
POST /api/bookmarks        — 북마크 저장
GET  /api/groups           — 그룹 목록
GET  /api/bookmarks/recent — 최근 저장 목록
GET  /api/bookmarks/urls   — 저장된 URL 목록 (추천 필터링용)
```

### 디렉토리 구조
```
extension/
├── src/
│   ├── popup/
│   │   ├── App.tsx         # 팝업 루트 컴포넌트
│   │   ├── SavePage.tsx    # 현재 페이지 저장
│   │   ├── Recommend.tsx   # 자동 추천
│   │   └── RecentList.tsx  # 최근 저장 목록
│   ├── auth-manager.ts     # Cognito 인증
│   ├── api-client.ts       # API 호출 래퍼
│   └── top-sites.ts        # topSites 추천
├── public/
│   └── manifest.json       # MV3 매니페스트
├── package.json
├── vite.config.ts
└── tsconfig.json
```

### 산출물
- Extension 소스 코드 (`extension/src/`)
- `manifest.json` (MV3)
- 빌드 설정 (`vite.config.ts`)
- 로컬 테스트 가이드

---

## 개발 순서 요약

```
[병렬 개발]
Unit 1 (인프라)    ──────────────────────────────────────► 배포
Unit 2 (Next.js)   ──────────────────────────────────────► 완성
                                    |
                              핵심 API 스펙 정의
                                    |
Unit 3 (Extension) ─────────────────────────────────────► 완성
                   (Mock API로 시작 → 실제 API 교체)
```

**개발 단계:**
1. **Phase 1 (병렬)**: Unit 1(인프라 CDK 작성) + Unit 2(Next.js 앱 로컬 개발) 동시 진행
2. **Phase 2 (Extension 시작)**: 핵심 API 스펙 확정 후 Unit 3 개발 시작 (Mock API 사용)
3. **Phase 3 (통합)**: Unit 2 핵심 API 완성 → Unit 3 실제 API 연결
4. **Phase 4 (배포)**: Unit 1 인프라 배포 → Unit 2 ECS 배포 → Unit 3 Extension 테스트
