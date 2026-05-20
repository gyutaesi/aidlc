# moaring — Component Dependency

> **목적**: 컴포넌트 간 의존성 관계 및 데이터 흐름 정의

---

## 1. 의존성 매트릭스

| 컴포넌트 | 의존하는 대상 |
|----------|--------------|
| **Middleware** | AuthService |
| **API Route Handlers** | AuthService, BookmarkService, GroupService, CollectionService, SearchService, StorageService, CollectionStatsService |
| **Server Actions** | AuthService, BookmarkService, GroupService, CollectionService, TagService |
| **BookmarkService** | Prisma, MetadataService, TagService |
| **GroupService** | Prisma, CollectionService |
| **CollectionService** | Prisma, StorageService |
| **MetadataService** | 외부 URL (HTTP fetch) |
| **SearchService** | Prisma (`$queryRaw`) |
| **TagService** | Prisma |
| **StorageService** | AWS SDK (S3) |
| **CollectionStatsService** | Prisma |
| **AuthService** | Prisma, Cognito JWKS |
| **ExtensionApiClient** | API Route Handlers (HTTP) |
| **ExtensionAuthManager** | Cognito Hosted UI / API, `chrome.storage.local` |
| **TopSitesRecommender** | `chrome.topSites` API, ExtensionApiClient |

---

## 2. 레이어별 의존성 방향

```
[Chrome Extension]
  ExtensionPopup
    └── ExtensionAuthManager (토큰 관리)
    └── ExtensionApiClient (API 호출)
    └── TopSitesRecommender (추천)
          |
          | HTTP (JWT)
          v
[Next.js App]
  Middleware ──────────────────────────────── AuthService
  API Route Handlers ──────────────────────── Services
  Server Actions ──────────────────────────── Services
          |
          v
  [Service Layer]
  AuthService ──────────────────────────────── Prisma + Cognito JWKS
  BookmarkService ──────────────────────────── Prisma + MetadataService + TagService
  GroupService ─────────────────────────────── Prisma + CollectionService
  CollectionService ────────────────────────── Prisma + StorageService
  SearchService ────────────────────────────── Prisma ($queryRaw)
  TagService ───────────────────────────────── Prisma
  StorageService ───────────────────────────── AWS SDK (S3)
  CollectionStatsService ───────────────────── Prisma
  MetadataService ──────────────────────────── 외부 HTTP
          |
          v
  [Infrastructure]
  Prisma ORM ───────────────────────────────── Aurora PostgreSQL
  AWS SDK ──────────────────────────────────── S3 + CloudFront
  Cognito JWKS ─────────────────────────────── Amazon Cognito
```

---

## 3. 핵심 데이터 흐름

### 3.1 북마크 저장 (웹앱)
```
User → ServerAction(createBookmark)
  → AuthService.getUserFromToken()
  → MetadataService.fetchMetadata(url)
  → BookmarkService.create()
    → TagService.getOrCreate() [태그 있는 경우]
    → Prisma: INSERT Bookmark + BookmarkTag
  → UI 업데이트 (revalidatePath)
```

### 3.2 북마크 저장 (Extension)
```
Extension → POST /api/bookmarks (JWT 헤더)
  → Middleware: JWT 검증
  → API Route Handler
  → AuthService.getUserFromToken()
  → MetadataService.fetchMetadata(url)
  → BookmarkService.create()
    → TagService.getOrCreate()
    → Prisma: INSERT Bookmark + BookmarkTag
  → Response: 201 Created
```

### 3.3 컬렉션 공개 페이지 (비로그인)
```
외부 사용자 → GET /c/{slug}
  → CollectionService.getPublicBySlug(slug)
    → Prisma: SELECT Collection WHERE slug AND is_public=true
  → CollectionStatsService.incrementViewCount()
    → Prisma: UPDATE collection SET view_count = view_count + 1
  → SSR: Next.js 페이지 렌더링
```

### 3.4 그룹 → 컬렉션 변환
```
User → ServerAction(convertGroupToCollection)
  → AuthService.getUserFromToken()
  → GroupService.convertToCollection(groupId, bookmarkIds, collectionInput)
    → CollectionService.create()
      → Prisma: INSERT Collection
    → CollectionService.addBlock() [각 북마크마다]
      → Prisma: UPDATE Collection.blocks (JSONB append)
  → UI 업데이트
```

---

## 4. 순환 의존성 방지 규칙

- **Service → Service 호출은 단방향**: GroupService → CollectionService (O), CollectionService → GroupService (X)
- **Service는 Route Handler를 참조하지 않음**
- **UI Component는 Service를 직접 호출하지 않음** (Server Action 또는 API Route 경유)
- **MetadataService는 다른 Service를 참조하지 않음** (외부 HTTP만 사용)

---

## 5. 외부 의존성 요약

| 외부 서비스 | 사용 컴포넌트 | 연동 방식 |
|-------------|--------------|-----------|
| Amazon Cognito | AuthService, ExtensionAuthManager | JWKS 검증, Hosted UI |
| Aurora PostgreSQL | 모든 Service (Prisma 경유) | Prisma ORM |
| Amazon S3 | StorageService | AWS SDK v3 |
| Amazon CloudFront | StorageService (URL 변환) | URL 패턴 변환 |
| AWS Parameter Store | ECS Task Definition | 환경변수 주입 |
| 외부 URL | MetadataService | HTTP fetch (5초 타임아웃) |
| chrome.topSites | TopSitesRecommender | Chrome Extension API |
