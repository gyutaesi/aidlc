# Unit 2 (Application) — Code Generation Plan

> **Unit**: Application (Next.js 앱)  
> **단계**: Construction Phase — Code Generation  
> **작성일**: 2026-05-20  
> **워크스페이스 루트**: `/home/ksg/Projects/aidlc` (monorepo)  
> **앱 코드 위치**: 워크스페이스 루트 (Next.js 프로젝트 구조)

---

## Unit 컨텍스트

### 담당 FR

- FR-01: 계정 및 인증 (웹앱 연동)
- FR-02: 북마크 저장
- FR-03: 인박스
- FR-04: 그룹
- FR-05: 컬렉션
- FR-06: 빠른 검색
- FR-08: 데이터 내보내기

### 의존성

- Unit 1 (인프라): Aurora PostgreSQL, Cognito User Pool, S3, CloudFront (병렬 개발, 로컬은 Docker Compose)
- Unit 3 (Extension): Unit 2의 API 스펙 완성 후 연동

### 기술 스택

- Next.js 15 (App Router), TypeScript 5 (strict), Prisma 5, TailwindCSS 3
- shadcn/ui, SWR, react-hook-form + zod, @dnd-kit, react-markdown
- next-intl (ko + en), nanoid, cheerio, jose, AWS SDK v3
- Jest + ts-jest (Service 단위 테스트)

---

## 디렉토리 구조 (생성 대상)

```
/ (워크스페이스 루트)
├── app/                          # Next.js App Router
│   ├── [locale]/
│   │   ├── layout.tsx
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   ├── signup/page.tsx
│   │   │   └── verify/page.tsx
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx
│   │   │   ├── inbox/page.tsx
│   │   │   ├── groups/page.tsx
│   │   │   ├── collections/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [id]/page.tsx
│   │   │   ├── import/page.tsx
│   │   │   └── settings/page.tsx
│   │   └── c/[slug]/page.tsx
│   └── api/
│       ├── health/route.ts
│       ├── bookmarks/route.ts
│       ├── bookmarks/recent/route.ts
│       ├── bookmarks/urls/route.ts
│       ├── collections/[id]/like/route.ts
│       ├── collections/[id]/view/route.ts
│       ├── collections/slug-check/route.ts
│       ├── export/route.ts
│       ├── search/route.ts
│       ├── tags/route.ts
│       └── upload/presigned/route.ts
├── components/
│   ├── ui/                       # shadcn/ui 컴포넌트
│   └── features/
│       ├── bookmark/
│       ├── collection/
│       ├── group/
│       └── search/
├── lib/
│   ├── services/
│   │   ├── auth.service.ts
│   │   ├── bookmark.service.ts
│   │   ├── collection.service.ts
│   │   ├── collection-stats.service.ts
│   │   ├── group.service.ts
│   │   ├── metadata.service.ts
│   │   ├── search.service.ts
│   │   ├── storage.service.ts
│   │   └── tag.service.ts
│   ├── services/__tests__/
│   ├── schemas/
│   ├── actions/
│   ├── api/
│   ├── errors.ts
│   ├── env.ts
│   ├── logger.ts
│   └── prisma.ts
├── messages/
│   ├── ko.json
│   └── en.json
├── prisma/
│   └── schema.prisma
├── middleware.ts
├── i18n.ts
├── docker-compose.yml
├── Dockerfile
├── next.config.ts
├── package.json
├── tsconfig.json
└── jest.config.ts
```

---

## 코드 생성 단계

### Phase 1: 프로젝트 구조 설정

- [x] **Step 1**: `package.json` — 의존성 전체 정의
- [x] **Step 2**: `tsconfig.json` — strict 모드, path alias
- [x] **Step 3**: `next.config.ts` — standalone output, next-intl 설정
- [x] **Step 4**: `i18n.ts` + `middleware.ts` — next-intl 라우팅 + 인증 통합
- [x] **Step 5**: `messages/ko.json` + `messages/en.json` — 번역 파일
- [x] **Step 6**: `docker-compose.yml` — 로컬 PostgreSQL
- [x] **Step 7**: `jest.config.ts` + `jest.setup.ts` — 테스트 설정
- [x] **Step 8**: `.eslintrc.json` + `.prettierrc` + `.husky/pre-commit` + `lint-staged` 설정

### Phase 2: 기반 라이브러리

- [x] **Step 9**: `lib/env.ts` — Zod 환경 변수 검증
- [x] **Step 10**: `lib/errors.ts` — AppError 계층 (NotFoundError, UnauthorizedError 등)
- [x] **Step 11**: `lib/logger.ts` — CloudWatch JSON 구조화 로그
- [x] **Step 12**: `lib/prisma.ts` — Prisma Singleton 클라이언트
- [x] **Step 13**: `lib/api/with-error-handler.ts` — Route Handler 에러 래퍼
- [x] **Step 14**: `lib/api/get-token.ts` — Cookie에서 토큰 추출 유틸

### Phase 3: DB 스키마 & 마이그레이션

- [x] **Step 15**: `prisma/schema.prisma` — 전체 스키마 (User, Bookmark, Tag, BookmarkTag, Group, BookmarkGroup, Collection, CollectionLike, CollectionLinkClick)
- [x] **Step 16**: Prisma migration SQL — Generated Column (search_vector, blocks_text) + GIN 인덱스

### Phase 4: Zod 스키마

- [x] **Step 17**: `lib/schemas/bookmark.schema.ts`
- [x] **Step 18**: `lib/schemas/collection.schema.ts`
- [x] **Step 19**: `lib/schemas/group.schema.ts`
- [x] **Step 20**: `lib/schemas/tag.schema.ts`
- [x] **Step 21**: `lib/schemas/auth.schema.ts`

### Phase 5: Service Layer

- [x] **Step 22**: `lib/services/auth.service.ts` — Cognito JWT 검증, DB User 관리 (FR-01)
- [x] **Step 23**: `lib/services/metadata.service.ts` — OG 태그 fetch (FR-02)
- [x] **Step 24**: `lib/services/tag.service.ts` — 태그 CRUD, 자동완성 (FR-02, FR-04)
- [x] **Step 25**: `lib/services/bookmark.service.ts` — 북마크 CRUD, 인박스, Import (FR-02, FR-03, FR-08)
- [x] **Step 26**: `lib/services/group.service.ts` — 그룹 CRUD, 순서, 컬렉션 변환 (FR-04)
- [x] **Step 27**: `lib/services/collection.service.ts` — 컬렉션 CRUD, 블록 관리, 공유 (FR-05)
- [x] **Step 28**: `lib/services/collection-stats.service.ts` — 조회수, 좋아요, 클릭 통계 (FR-05)
- [x] **Step 29**: `lib/services/search.service.ts` — tsvector 풀텍스트 검색 (FR-06)
- [x] **Step 30**: `lib/services/storage.service.ts` — S3 Pre-signed URL (FR-05)

### Phase 6: Service 단위 테스트

- [x] **Step 31**: `lib/services/__tests__/auth.service.test.ts`
- [x] **Step 32**: `lib/services/__tests__/bookmark.service.test.ts`
- [x] **Step 33**: `lib/services/__tests__/collection.service.test.ts`
- [x] **Step 34**: `lib/services/__tests__/search.service.test.ts`
- [x] **Step 35**: `lib/services/__tests__/tag.service.test.ts`

### Phase 7: Server Actions

- [x] **Step 36**: `lib/actions/auth.actions.ts` — signUp, confirmSignUp, signIn, signOut (FR-01)
- [x] **Step 37**: `lib/actions/bookmark.actions.ts` — createBookmark, updateBookmark, deleteBookmark, markAsRead, moveToGroup, importBookmarks (FR-02, FR-03)
- [x] **Step 38**: `lib/actions/group.actions.ts` — createGroup, updateGroup, deleteGroup, reorderGroups, reorderBookmarks, convertToCollection (FR-04)
- [x] **Step 39**: `lib/actions/collection.actions.ts` — createCollection, updateCollection, deleteCollection, addBlock, updateBlock, deleteBlock, reorderBlocks, togglePublic, updateSlug (FR-05)

### Phase 8: API Route Handlers

- [x] **Step 40**: `app/api/health/route.ts` — 헬스체크
- [x] **Step 41**: `app/api/bookmarks/route.ts` — GET(목록), POST(저장) — Extension용 (FR-02, FR-07)
- [x] **Step 42**: `app/api/bookmarks/recent/route.ts` — GET 최근 저장 (FR-07)
- [x] **Step 43**: `app/api/bookmarks/urls/route.ts` — GET URL 목록 (FR-07)
- [x] **Step 44**: `app/api/search/route.ts` — GET 검색 (FR-06)
- [x] **Step 45**: `app/api/tags/route.ts` — GET 자동완성 (FR-02)
- [x] **Step 46**: `app/api/collections/slug-check/route.ts` — GET 슬러그 중복 체크 (FR-05)
- [x] **Step 47**: `app/api/collections/[id]/like/route.ts` — POST 좋아요 (FR-05)
- [x] **Step 48**: `app/api/collections/[id]/view/route.ts` — POST 조회수 (FR-05)
- [x] **Step 49**: `app/api/upload/presigned/route.ts` — POST Pre-signed URL (FR-05)
- [x] **Step 50**: `app/api/export/route.ts` — GET JSON/HTML 내보내기 (FR-08)

### Phase 9: shadcn/ui 기본 컴포넌트

- [x] **Step 51**: shadcn/ui 컴포넌트 설치 및 설정 (Button, Input, Dialog, DropdownMenu, Command, Toast, Badge, Card, Popover, Separator, Avatar, Textarea, Label)
- [x] **Step 52**: `components/ui/markdown-renderer.tsx` — rehype-sanitize 적용
- [x] **Step 53**: `components/ui/drag-drop-list.tsx` — dnd-kit 래퍼
- [x] **Step 54**: `components/ui/tag-input.tsx` — 태그 입력 + 자동완성
- [x] **Step 55**: `components/ui/toast-provider.tsx` — 전역 Toast 컨텍스트

### Phase 10: Feature 컴포넌트

- [x] **Step 56**: `components/features/bookmark/bookmark-save-modal.tsx` — URL 저장 모달 (FR-02)
- [x] **Step 57**: `components/features/bookmark/bookmark-card.tsx` — 인박스 카드 (FR-03)
- [x] **Step 58**: `components/features/group/group-column.tsx` — 그룹 컬럼 (FR-04)
- [x] **Step 59**: `components/features/group/group-bookmark-item.tsx` — 그룹 내 북마크 아이템 (FR-04)
- [x] **Step 60**: `components/features/collection/block-list.tsx` — 블록 목록 + DnD (FR-05)
- [x] **Step 61**: `components/features/collection/add-block-button.tsx` + 블록 폼 3종 (FR-05)
- [x] **Step 62**: `components/features/collection/collection-header.tsx` — 슬러그 편집 포함 (FR-05)
- [x] **Step 63**: `components/features/collection/public-block-renderer.tsx` — 공개 페이지 블록 렌더링 (FR-05)
- [x] **Step 64**: `components/features/search/search-modal.tsx` — Cmd+K 검색 (FR-06)

### Phase 11: 레이아웃 & 페이지

- [x] **Step 65**: `app/[locale]/layout.tsx` — NextIntlClientProvider, 루트 레이아웃
- [x] **Step 66**: `app/[locale]/(auth)/login/page.tsx` + `signup/page.tsx` + `verify/page.tsx` (FR-01)
- [x] **Step 67**: `app/[locale]/(dashboard)/layout.tsx` — 사이드바 + 헤더 (DashboardLayout)
- [x] **Step 68**: `app/[locale]/(dashboard)/inbox/page.tsx` — 카드 그리드 (FR-03)
- [x] **Step 69**: `app/[locale]/(dashboard)/groups/page.tsx` — Toby 컬럼 (FR-04)
- [x] **Step 70**: `app/[locale]/(dashboard)/collections/page.tsx` + `[id]/page.tsx` (FR-05)
- [x] **Step 71**: `app/[locale]/(dashboard)/import/page.tsx` (FR-02)
- [x] **Step 72**: `app/[locale]/(dashboard)/settings/page.tsx` (FR-01, FR-08)
- [x] **Step 73**: `app/c/[slug]/page.tsx` — 공개 컬렉션 SSR (FR-05)

### Phase 12: 배포 아티팩트

- [x] **Step 74**: `Dockerfile` — 멀티 스테이지 빌드 (node:20-alpine)
- [x] **Step 75**: `aidlc-docs/construction/application/code/code-summary.md` — 코드 생성 요약

---

## 스토리 추적

| FR                    | 구현 단계                                 |
| --------------------- | ----------------------------------------- |
| FR-01 (인증)          | Step 22, 36, 66, 72                       |
| FR-02 (북마크 저장)   | Step 23, 24, 25, 37, 41, 45, 56, 71       |
| FR-03 (인박스)        | Step 25, 37, 57, 68                       |
| FR-04 (그룹)          | Step 26, 38, 58, 59, 69                   |
| FR-05 (컬렉션)        | Step 27, 28, 30, 39, 46~49, 60~63, 70, 73 |
| FR-06 (검색)          | Step 29, 44, 64                           |
| FR-07 (Extension API) | Step 41, 42, 43                           |
| FR-08 (Export)        | Step 25, 50, 72                           |

---

## 주의사항

1. **코드 위치**: 모든 앱 코드는 워크스페이스 루트 (`/home/ksg/Projects/aidlc/`) — `aidlc-docs/` 절대 금지
2. **data-testid**: 모든 인터랙티브 요소에 `data-testid` 속성 추가
3. **next-intl**: Server Component는 `getTranslations()`, Client Component는 `useTranslations()`
4. **타입 안전**: 모든 파일 TypeScript strict 모드 준수
5. **단계별 체크박스**: 각 단계 완료 즉시 `[x]` 업데이트
