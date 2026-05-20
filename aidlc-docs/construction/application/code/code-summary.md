# Unit 2 (Application) — Code Generation Summary

> **작성일**: 2026-05-20  
> **단계**: Construction Phase — Code Generation 완료

---

## 생성된 파일 목록

### Phase 1: 프로젝트 구조 설정

- `package.json` — 전체 의존성 정의
- `tsconfig.json` — TypeScript strict 모드
- `next.config.ts` — standalone output, next-intl 통합
- `i18n.ts` + `lib/i18n/routing.ts` — next-intl 라우팅 설정
- `middleware.ts` — JWT 인증 + 로케일 감지 통합
- `messages/ko.json` + `messages/en.json` — 한국어/영어 번역
- `docker-compose.yml` — 로컬 PostgreSQL
- `jest.config.ts` + `jest.setup.ts` — 테스트 설정
- `.eslintrc.json` + `.prettierrc` + `.husky/pre-commit` — 코드 품질 도구

### Phase 2: 기반 라이브러리

- `lib/env.ts` — Zod 환경 변수 검증
- `lib/errors.ts` — AppError 계층 (6개 에러 클래스)
- `lib/logger.ts` — CloudWatch JSON 구조화 로그
- `lib/prisma.ts` — Prisma Singleton 클라이언트
- `lib/api/with-error-handler.ts` — Route Handler 에러 래퍼
- `lib/api/get-token.ts` — Cookie/Header 토큰 추출 유틸
- `lib/utils.ts` — cn() 유틸리티

### Phase 3: DB 스키마 & 마이그레이션

- `prisma/schema.prisma` — 9개 모델 (User, Bookmark, Tag, BookmarkTag, Group, BookmarkGroup, Collection, CollectionLike, CollectionLinkClick)
- `prisma/migrations/add_search_vectors/migration.sql` — Generated Column + GIN 인덱스

### Phase 4: Zod 스키마

- `lib/schemas/bookmark.schema.ts`
- `lib/schemas/collection.schema.ts`
- `lib/schemas/group.schema.ts`
- `lib/schemas/tag.schema.ts`
- `lib/schemas/auth.schema.ts`

### Phase 5: Service Layer (9개)

- `lib/services/auth.service.ts` — Cognito JWT, DB User 관리
- `lib/services/metadata.service.ts` — OG 태그 fetch (5초 타임아웃)
- `lib/services/tag.service.ts` — 태그 CRUD, 자동완성
- `lib/services/bookmark.service.ts` — 북마크 CRUD, 인박스, Import, Export
- `lib/services/group.service.ts` — 그룹 CRUD, 순서, 컬렉션 변환
- `lib/services/collection.service.ts` — 컬렉션 CRUD, 블록 관리, 공유
- `lib/services/collection-stats.service.ts` — 조회수, 좋아요, 클릭 통계
- `lib/services/search.service.ts` — tsvector 풀텍스트 검색
- `lib/services/storage.service.ts` — S3 Pre-signed URL

### Phase 6: Service 단위 테스트 (5개)

- `lib/services/__tests__/auth.service.test.ts`
- `lib/services/__tests__/bookmark.service.test.ts`
- `lib/services/__tests__/collection.service.test.ts`
- `lib/services/__tests__/search.service.test.ts`
- `lib/services/__tests__/tag.service.test.ts`

### Phase 7: Server Actions (4개 파일)

- `lib/actions/auth.actions.ts` — signUp, confirmSignUp, signIn, signOut, changePassword
- `lib/actions/bookmark.actions.ts` — createBookmark, updateBookmark, deleteBookmark, markAsRead, markAsUnread, moveToGroup, importBookmarks
- `lib/actions/group.actions.ts` — createGroup, updateGroup, deleteGroup, reorderGroups, reorderBookmarks, convertToCollection
- `lib/actions/collection.actions.ts` — createCollection, updateCollection, deleteCollection, addBlock, updateBlock, deleteBlock, reorderBlocks, togglePublic, updateSlug

### Phase 8: API Route Handlers (11개)

- `app/api/health/route.ts`
- `app/api/bookmarks/route.ts` (GET, POST)
- `app/api/bookmarks/recent/route.ts`
- `app/api/bookmarks/urls/route.ts`
- `app/api/search/route.ts`
- `app/api/tags/route.ts`
- `app/api/collections/slug-check/route.ts`
- `app/api/collections/[id]/like/route.ts`
- `app/api/collections/[id]/view/route.ts`
- `app/api/upload/presigned/route.ts`
- `app/api/export/route.ts`

### Phase 9: UI 컴포넌트 (9개)

- `components/ui/button.tsx`
- `components/ui/input.tsx`
- `components/ui/textarea.tsx`
- `components/ui/badge.tsx`
- `components/ui/dialog.tsx`
- `components/ui/markdown-renderer.tsx`
- `components/ui/drag-drop-list.tsx`
- `components/ui/tag-input.tsx`
- `components/ui/toast-provider.tsx`

### Phase 10: Feature 컴포넌트 (9개)

- `components/features/bookmark/bookmark-save-modal.tsx`
- `components/features/bookmark/bookmark-card.tsx`
- `components/features/group/group-column.tsx`
- `components/features/group/group-bookmark-item.tsx`
- `components/features/collection/block-list.tsx`
- `components/features/collection/add-block-button.tsx`
- `components/features/collection/collection-header.tsx`
- `components/features/collection/public-block-renderer.tsx`
- `components/features/search/search-modal.tsx`

### Phase 11: 레이아웃 & 페이지 (13개)

- `app/globals.css`
- `app/[locale]/layout.tsx`
- `app/[locale]/(auth)/login/page.tsx`
- `app/[locale]/(auth)/signup/page.tsx`
- `app/[locale]/(auth)/verify/page.tsx`
- `app/[locale]/(dashboard)/layout.tsx`
- `app/[locale]/(dashboard)/inbox/page.tsx` + `inbox-client.tsx`
- `app/[locale]/(dashboard)/groups/page.tsx` + `groups-client.tsx`
- `app/[locale]/(dashboard)/collections/page.tsx`
- `app/[locale]/(dashboard)/collections/[id]/page.tsx`
- `app/[locale]/(dashboard)/import/page.tsx`
- `app/[locale]/(dashboard)/settings/page.tsx` + `settings-client.tsx`
- `app/c/[slug]/page.tsx` + `like-button.tsx`

### Phase 12: 배포 아티팩트

- `Dockerfile` — 멀티 스테이지 빌드 (node:20-alpine)

---

## FR 구현 현황

| FR                  | 상태    |
| ------------------- | ------- |
| FR-01 인증          | ✅ 완료 |
| FR-02 북마크 저장   | ✅ 완료 |
| FR-03 인박스        | ✅ 완료 |
| FR-04 그룹          | ✅ 완료 |
| FR-05 컬렉션        | ✅ 완료 |
| FR-06 빠른 검색     | ✅ 완료 |
| FR-07 Extension API | ✅ 완료 |
| FR-08 Export        | ✅ 완료 |

---

## 주요 설계 결정 반영

- **인박스 레이아웃**: 카드 그리드 (Q12: A)
- **읽음 처리**: 자동(URL 클릭) + 명시적(버튼) (Q1: C)
- **좋아요**: 로그인 사용자만 (Q15: C)
- **슬러그**: nanoid 소문자+숫자 alphabet (Q5: C)
- **i18n**: next-intl 완전 적용, ko+en (Q19: C)
- **토큰 저장**: HttpOnly Cookie (Q7: A)
- **data-testid**: 모든 인터랙티브 요소에 적용
