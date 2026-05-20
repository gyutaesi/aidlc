# moaring — Application Design (통합 문서)

> **버전**: 1.0  
> **작성일**: 2026-05-20  
> **상태**: 완료

---

## 1. 설계 개요

moaring은 **Next.js 풀스택 단일 코드베이스** 구조로, 웹앱과 Chrome Extension이 동일한 API를 공유합니다.

### 핵심 설계 결정

| 항목 | 결정 | 근거 |
|------|------|------|
| API 구조 | Route Handler + Server Action 혼합 | Extension은 HTTP API 필요, 웹앱 내부는 Server Action으로 성능 최적화 |
| 비즈니스 로직 위치 | `lib/services/` Service 레이어 | Route Handler/Server Action 양쪽에서 재사용, 얇은 핸들러 유지 |
| 공유 페이지 렌더링 | SSR | 조회수/좋아요/블록 내용 실시간 반영 필요 |
| DB ORM | Prisma | 타입 안전 + 마이그레이션 관리 + Aurora PostgreSQL 지원 |
| 인증 | Middleware + AuthService | 보호 경로 일괄 검증 + 토큰 파싱/사용자 조회 분리 |
| 파일 저장 | StorageService (S3 Pre-signed URL) | 서버 부하 없이 클라이언트 직접 업로드 |
| 검색 | SearchService (PostgreSQL tsvector) | 추가 인프라 없이 북마크+컬렉션 블록 통합 검색 |
| 에러 처리 | 공통 에러 클래스 + 중앙 핸들러 | 일관된 API 응답 형식 |
| 설정 관리 | .env + AWS Parameter Store | 민감 정보 보안 + 로컬 개발 편의성 |

---

## 2. 시스템 아키텍처

```
+--------------------------------------------------+
|  Chrome Extension (MV3 + React)                  |
|  ExtensionPopup                                  |
|  ExtensionAuthManager  TopSitesRecommender       |
|  ExtensionApiClient                              |
+--------------------------------------------------+
                      |  HTTPS + JWT
+--------------------------------------------------+
|  Next.js App (ECS/Fargate)                       |
|                                                  |
|  [Pages / UI Components]  [API Route Handlers]   |
|  [Server Actions]         app/api/**             |
|         |                       |                |
|  [middleware.ts: JWT 검증 (보호 경로)]            |
|         |                       |                |
|  +----------------------------------------------+|
|  |          Service Layer (lib/services/)        ||
|  |  AuthService      BookmarkService             ||
|  |  GroupService     CollectionService           ||
|  |  MetadataService  SearchService               ||
|  |  TagService       StorageService              ||
|  |  CollectionStatsService                       ||
|  +----------------------------------------------+|
|         |                                        |
|  [Prisma ORM]                                    |
+--------------------------------------------------+
         |              |              |
  [Aurora PostgreSQL] [S3+CloudFront] [Cognito]
```

---

## 3. 컴포넌트 구성

### 3.1 Service 컴포넌트 목록

| Service | 책임 |
|---------|------|
| `AuthService` | Cognito JWT 검증, DB User 조회/생성, JWKS 캐싱 |
| `BookmarkService` | 북마크 CRUD, 인박스 관리, Import |
| `GroupService` | 그룹 CRUD, 북마크 순서, 컬렉션 변환 |
| `CollectionService` | 컬렉션 CRUD, 블록 관리, 공유/슬러그 |
| `MetadataService` | OG 태그 fetch, 타임아웃 처리 |
| `SearchService` | tsvector 풀텍스트 검색 |
| `TagService` | 태그 CRUD, 자동완성 |
| `StorageService` | S3 Pre-signed URL, CloudFront URL 변환 |
| `CollectionStatsService` | 조회수/클릭수/좋아요 집계 |

### 3.2 Chrome Extension 컴포넌트

| 컴포넌트 | 책임 |
|----------|------|
| `ExtensionPopup` | 팝업 UI (저장/추천/최근 목록) |
| `ExtensionAuthManager` | Cognito 로그인, 토큰 관리 |
| `ExtensionApiClient` | API 호출 래퍼 |
| `TopSitesRecommender` | 자주 방문 미등록 사이트 추천 |

---

## 4. 주요 데이터 흐름

### 북마크 저장
```
Client → [Server Action / POST /api/bookmarks]
  → AuthService (JWT 검증)
  → MetadataService (OG fetch, 5초 타임아웃)
  → BookmarkService.create()
    → TagService.getOrCreate()
    → Prisma INSERT
```

### 공유 페이지 조회 (비로그인)
```
외부 사용자 → GET /c/{slug} (SSR)
  → CollectionService.getPublicBySlug()
  → CollectionStatsService.incrementViewCount()
  → Next.js SSR 렌더링
```

### 검색
```
Client (Cmd+K) → GET /api/search?q=...
  → AuthService (JWT 검증)
  → SearchService.search() (tsvector UNION 쿼리)
  → SearchResult[]
```

---

## 5. 프로젝트 디렉토리 구조 (예상)

```
moaring/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # 인증 페이지 (로그인/회원가입)
│   ├── (dashboard)/              # 보호된 대시보드 페이지
│   │   ├── inbox/
│   │   ├── groups/
│   │   ├── collections/
│   │   └── settings/
│   ├── c/[slug]/                 # 공개 컬렉션 페이지 (SSR)
│   └── api/                      # API Route Handlers
│       ├── bookmarks/
│       ├── groups/
│       ├── collections/
│       ├── search/
│       └── upload/
├── components/
│   ├── ui/                       # 재사용 UI 컴포넌트
│   └── features/                 # 도메인별 복합 컴포넌트
├── lib/
│   ├── services/                 # Service 레이어
│   │   ├── auth.service.ts
│   │   ├── bookmark.service.ts
│   │   ├── group.service.ts
│   │   ├── collection.service.ts
│   │   ├── metadata.service.ts
│   │   ├── search.service.ts
│   │   ├── tag.service.ts
│   │   ├── storage.service.ts
│   │   └── collection-stats.service.ts
│   ├── errors.ts                 # 공통 에러 클래스
│   └── prisma.ts                 # Prisma 클라이언트 싱글톤
├── prisma/
│   └── schema.prisma             # DB 스키마
├── middleware.ts                 # JWT 검증 미들웨어
├── extension/                    # Chrome Extension
│   ├── popup/
│   ├── auth-manager.ts
│   ├── api-client.ts
│   └── manifest.json
└── aidlc-docs/                   # AI-DLC 문서
```

---

## 6. 상세 문서 참조

- **컴포넌트 상세**: `components.md`
- **메서드 시그니처**: `component-methods.md`
- **서비스 오케스트레이션**: `services.md`
- **의존성 관계**: `component-dependency.md`
