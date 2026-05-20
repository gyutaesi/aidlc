# moaring — Unit of Work Story Map

> **목적**: 기능 요구사항(FR)을 각 Unit에 매핑

---

## 1. FR → Unit 매핑

| FR | 기능 | Unit | 비고 |
|----|------|------|------|
| FR-01-1~8 | 계정 및 인증 (Cognito) | Unit 1 + Unit 2 | Cognito 프로비저닝(Unit 1) + 앱 연동(Unit 2) |
| FR-02-1~7 | 북마크 저장/수정/삭제/Import | Unit 2 | MetadataService, BookmarkService |
| FR-03-1~7 | 인박스 | Unit 2 | BookmarkService.getInbox() |
| FR-04-1~6 | 그룹 | Unit 2 | GroupService |
| FR-05-1~15 | 컬렉션 | Unit 2 | CollectionService, CollectionStatsService |
| FR-06-1~3 | 빠른 검색 (Cmd+K) | Unit 2 | SearchService, tsvector |
| FR-07-1~8 | Chrome Extension | Unit 3 | ExtensionPopup, ExtensionAuthManager |
| FR-08-1~2 | 데이터 내보내기 (Export) | Unit 2 | BookmarkService.exportToJson/Html() |

---

## 2. Unit별 FR 상세

### Unit 1: 인프라

| FR | 내용 | CDK 스택 |
|----|------|---------|
| FR-01-1~4 | Cognito 회원가입/로그인/이메일 인증/비밀번호 재설정 | `auth-stack.ts` |
| (인프라 전반) | ECS, Aurora, S3, CloudFront, ALB 프로비저닝 | 각 스택 |

**Unit 1 산출물:**
- `infra/lib/network-stack.ts`
- `infra/lib/database-stack.ts`
- `infra/lib/auth-stack.ts`
- `infra/lib/storage-stack.ts`
- `infra/lib/app-stack.ts`
- `infra/lib/config-stack.ts`

---

### Unit 2: Next.js 앱

#### FR-01. 계정 및 인증
| FR ID | 내용 | 구현 위치 |
|-------|------|-----------|
| FR-01-1 | Cognito 회원가입 | `app/(auth)/signup/` + AuthService |
| FR-01-2 | Cognito 로그인 + JWT 발급 | `app/(auth)/login/` + AuthService |
| FR-01-3 | 이메일 인증 | `app/(auth)/verify/` + Cognito 기본 |
| FR-01-4 | 비밀번호 재설정 | `app/(auth)/reset-password/` + Cognito 기본 |
| FR-01-5 | 로그아웃 | Server Action + Cognito 세션 무효화 |
| FR-01-6 | JWT API 인증 | `middleware.ts` + AuthService |
| FR-01-7 | 크로스 디바이스 동기화 | 계정 기반 DB 저장 (자동) |
| FR-01-8 | 사용자 데이터 격리 | 모든 Service `WHERE user_id = ?` |

#### FR-02. 북마크 저장
| FR ID | 내용 | 구현 위치 |
|-------|------|-----------|
| FR-02-1 | URL → OG fetch → 저장 | BookmarkService.create() + MetadataService |
| FR-02-2 | fetch 실패 시 수동 입력 + placeholder | MetadataService null 반환 처리 |
| FR-02-3 | 저장 즉시 인박스 | BookmarkService.create() |
| FR-02-4 | 태그 추가 | TagService.getOrCreate() |
| FR-02-5 | 북마크 수정 | BookmarkService.update() |
| FR-02-6 | 북마크 삭제 | BookmarkService.delete() |
| FR-02-7 | 크롬 HTML Import | BookmarkService.importFromHtml() |

#### FR-03. 인박스
| FR ID | 내용 | 구현 위치 |
|-------|------|-----------|
| FR-03-1 | 미분류 링크 보관 | BookmarkService.getInbox() |
| FR-03-2 | 읽음 처리 | BookmarkService.markAsRead() |
| FR-03-3 | 그룹으로 이동 | BookmarkService.moveToGroup() |
| FR-03-4 | 컬렉션으로 이동 | CollectionService.addBlock() |
| FR-03-5 | 삭제 | BookmarkService.delete() |
| FR-03-6 | 정렬 (최신/오래된순) | BookmarkService.getInbox() sort 옵션 |
| FR-03-7 | 필터 (읽음/미읽음) | BookmarkService.getInbox() filter 옵션 |

#### FR-04. 그룹
| FR ID | 내용 | 구현 위치 |
|-------|------|-----------|
| FR-04-1 | 그룹 생성 | GroupService.create() |
| FR-04-2 | 그룹 수정/삭제 | GroupService.update() / delete() |
| FR-04-3 | 비공개 | DB user_id 격리 |
| FR-04-4 | Toby 스타일 컬럼 | `components/features/GroupColumn` |
| FR-04-5 | 북마크 순서 변경 | GroupService.reorderBookmarks() |
| FR-04-6 | 컬렉션으로 변환 | GroupService.convertToCollection() |

#### FR-05. 컬렉션
| FR ID | 내용 | 구현 위치 |
|-------|------|-----------|
| FR-05-1 | 컬렉션 생성 | CollectionService.create() |
| FR-05-2 | 수정/삭제 | CollectionService.update() / delete() |
| FR-05-3~5 | 블록 추가 (링크/텍스트/이미지) | CollectionService.addBlock() |
| FR-05-6 | 블록 수정 | CollectionService.updateBlock() |
| FR-05-7 | 블록 삭제 | CollectionService.deleteBlock() |
| FR-05-8 | 블록 순서 변경 | CollectionService.reorderBlocks() |
| FR-05-9 | 공유 ON/OFF | CollectionService.togglePublic() |
| FR-05-10 | 공개 URL + 슬러그 | CollectionService.updateSlug() + isSlugAvailable() |
| FR-05-11~12 | 템플릿 (가이드/프로필) | `app/c/[slug]/` SSR 렌더링 |
| FR-05-13 | 조회수 + 클릭수 통계 | CollectionStatsService |
| FR-05-14 | 좋아요 (익명, 중복 방지) | CollectionStatsService.toggleLike() |
| FR-05-15 | 비로그인 공개 접근 | `app/c/[slug]/` 공개 라우트 |

#### FR-06. 빠른 검색
| FR ID | 내용 | 구현 위치 |
|-------|------|-----------|
| FR-06-1 | Cmd+K 단축키 | `components/features/SearchModal` |
| FR-06-2 | 전체 텍스트 검색 | SearchService.search() |
| FR-06-3 | tsvector + GIN 인덱스 | Prisma schema + $queryRaw |

#### FR-08. 데이터 내보내기
| FR ID | 내용 | 구현 위치 |
|-------|------|-----------|
| FR-08-1 | JSON 내보내기 | `app/api/export/route.ts` |
| FR-08-2 | Chrome HTML 내보내기 | `app/api/export/route.ts` |

---

### Unit 3: Chrome Extension

#### FR-07. Chrome Extension
| FR ID | 내용 | 구현 위치 |
|-------|------|-----------|
| FR-07-1 | 현재 페이지 저장 (그룹+태그+메모) | `extension/src/popup/SavePage.tsx` |
| FR-07-2 | 그룹 미선택 시 인박스 | ExtensionApiClient → POST /api/bookmarks |
| FR-07-3 | topSites 자동 추천 목록 | TopSitesRecommender |
| FR-07-4 | 원클릭 인박스 추가 | ExtensionApiClient → POST /api/bookmarks |
| FR-07-5 | AI 추천 — Post-MVP | 미구현 |
| FR-07-6 | 최근 저장 목록 | ExtensionApiClient → GET /api/bookmarks/recent |
| FR-07-7 | Cognito 로그인 + 토큰 저장 | ExtensionAuthManager |
| FR-07-8 | MV3 매니페스트 | `extension/public/manifest.json` |

---

## 3. Post-MVP 항목

| 기능 | 관련 FR | 담당 Unit |
|------|---------|-----------|
| AI 기반 자동 추천 (Google Gemini) | FR-07-5 | Unit 3 |
| Google OAuth | FR-01 확장 | Unit 1 + Unit 2 |
| Amazon SES 연동 | — | Unit 1 |
| Chrome Web Store 정식 배포 | — | Unit 3 |
| i18n 영어 번역 | — | Unit 2 |
