# moaring — Components

> **목적**: 시스템을 구성하는 주요 컴포넌트 정의 및 책임 기술

---

## 1. 시스템 레이어 구조

```
+--------------------------------------------------+
|  Chrome Extension (MV3 + React)                  |
+--------------------------------------------------+
                      |  HTTP API (JWT)
+--------------------------------------------------+
|  Next.js App (App Router)                        |
|  +-----------------+  +----------------------+  |
|  | Pages / UI      |  | API Route Handlers   |  |
|  | (Server/Client  |  | (app/api/**)         |  |
|  |  Components)    |  +----------------------+  |
|  | Server Actions  |           |                |
|  +-----------------+           |                |
|          |                     |                |
|  +-----------------------------------------------+
|  |           Service Layer (lib/services/)       |
|  +-----------------------------------------------+
|          |                                       |
|  +-----------------------------------------------+
|  |           Prisma ORM + Aurora PostgreSQL      |
|  +-----------------------------------------------+
+--------------------------------------------------+
         |              |              |
    [Cognito]        [S3/CF]      [Parameter Store]
```

---

## 2. 컴포넌트 목록

### 2.1 Frontend Components (UI Layer)

#### PageComponents
- **책임**: 각 페이지의 레이아웃 및 데이터 페칭 (Server Component)
- **포함 페이지**: InboxPage, GroupDashboardPage, CollectionEditorPage, CollectionPublicPage(`/c/{slug}`), SearchPage, ImportPage, SettingsPage
- **렌더링**: 대부분 Server Component, 인터랙티브 요소는 Client Component로 분리
- **공유 페이지**: SSR 방식으로 렌더링

#### UIComponents
- **책임**: 재사용 가능한 UI 요소 (Button, Modal, DragDropList, BlockEditor, TagInput 등)
- **위치**: `components/ui/`
- **특성**: Client Component, 상태 관리 포함

#### FeatureComponents
- **책임**: 도메인별 복합 UI (BookmarkCard, GroupColumn, CollectionBlock, SearchModal 등)
- **위치**: `components/features/`
- **특성**: Server/Client Component 혼합

---

### 2.2 API Layer

#### API Route Handlers (`app/api/`)
- **책임**: Chrome Extension 및 외부 클라이언트의 HTTP 요청 처리
- **주요 엔드포인트**:
  - `POST /api/bookmarks` — 북마크 저장 (Extension 포함)
  - `GET /api/bookmarks` — 북마크 목록 조회
  - `GET /api/bookmarks/recent` — 최근 저장 목록 (Extension 팝업용)
  - `GET /api/bookmarks/urls` — 저장된 URL 목록만 조회 (Extension 추천 필터링용, 경량)
  - `GET /api/groups` — 그룹 목록 (Extension 팝업용)
  - `GET /api/tags?prefix=` — 태그 자동완성
  - `GET /api/search` — 검색
  - `POST /api/collections/[id]/view` — 조회수 증가
  - `POST /api/collections/[id]/like` — 좋아요
  - `POST /api/upload/presigned` — S3 Pre-signed URL 발급
- **인증**: Cognito JWT 검증 (Middleware + AuthService)
- **CORS**: `chrome-extension://` origin 허용

#### Server Actions (`app/**/actions.ts`)
- **책임**: 웹앱 내부 데이터 변경 처리 (폼 제출, 인라인 편집 등)
- **주요 액션**: createBookmark, updateBookmark, deleteBookmark, createGroup, updateCollection, reorderBlocks, toggleCollectionPublic
- **특성**: 서버에서 직접 실행, 별도 HTTP 요청 없음

#### Next.js Middleware (`middleware.ts`)
- **책임**: 보호된 경로(`/dashboard/**`, `/api/**`) 일괄 JWT 검증
- **동작**:
  - 페이지 경로(`/dashboard/**`): 토큰 없거나 무효 시 `/login`으로 redirect
  - API 경로(`/api/**`): 토큰 없거나 무효 시 `NextResponse.json({ error: 'Unauthorized' }, { status: 401 })` 반환
  - 공개 경로(`/c/**`, `/login`, `/signup`): 검증 없이 통과

---

### 2.3 Service Layer (`lib/services/`)

#### AuthService
- **책임**: Cognito JWT 파싱/검증, DB User 레코드 조회/생성, JWKS 공개키 캐싱
- **주요 메서드**: `getUserFromToken()`, `syncCognitoUser()`

#### BookmarkService
- **책임**: 북마크 CRUD, 인박스 관리, 그룹 이동, Import 처리
- **주요 메서드**: `create()`, `update()`, `delete()`, `moveToGroup()`, `getAsLinkBlock()`, `getInbox()`, `getByGroup()`, `getRecent()`, `importFromHtml()`

#### GroupService
- **책임**: 그룹 CRUD, 그룹 내 북마크 순서 관리, 컬렉션 변환
- **주요 메서드**: `create()`, `update()`, `delete()`, `reorderBookmarks()`, `convertToCollection()`

#### CollectionService
- **책임**: 컬렉션 CRUD, 블록 관리(추가/수정/삭제/순서), 공유 설정, 슬러그 관리
- **주요 메서드**: `create()`, `update()`, `delete()`, `addBlock()`, `updateBlock()`, `deleteBlock()`, `reorderBlocks()`, `togglePublic()`, `updateSlug()`

#### MetadataService
- **책임**: URL OG 태그 fetch, 제목/설명/썸네일 파싱, 타임아웃 처리
- **주요 메서드**: `fetchMetadata(url)` — 5초 타임아웃, 실패 시 null 반환

#### SearchService
- **책임**: PostgreSQL tsvector 풀텍스트 검색 (북마크 + 컬렉션 블록 텍스트), 검색 인덱스 관리
- **주요 메서드**: `search(userId, query)` — 제목/URL/메모/태그/블록 텍스트 통합 검색

#### TagService
- **책임**: 태그 생성/조회, 자동완성, 북마크-태그 관계 관리
- **주요 메서드**: `getOrCreate()`, `autocomplete(prefix)`, `getByBookmark()`

#### StorageService
- **책임**: S3 Pre-signed URL 생성, S3 경로 규칙 관리, CloudFront URL 변환
- **주요 메서드**: `getUploadUrl(userId, type)`, `toPublicUrl(s3Key)`

#### CollectionStatsService
- **책임**: 조회수 atomic increment, 링크 클릭수 기록, 좋아요 중복 방지
- **주요 메서드**: `incrementViewCount()`, `recordLinkClick()`, `toggleLike(fingerprint)`

---

### 2.4 Chrome Extension Components

#### ExtensionPopup
- **책임**: Extension 팝업 UI (현재 페이지 저장, 자동 추천, 최근 저장 목록)
- **기술**: React + MV3

#### ExtensionAuthManager
- **책임**: Cognito 로그인 처리, `chrome.storage.local` 토큰 저장/갱신
- **동작**: Cognito Hosted UI 또는 직접 API 호출

#### ExtensionApiClient
- **책임**: moaring API 호출 래퍼 (토큰 자동 첨부, 갱신 처리)

#### TopSitesRecommender
- **책임**: `chrome.topSites` API로 자주 방문 사이트 조회, 미등록 사이트 필터링
