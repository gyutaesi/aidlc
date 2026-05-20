# moaring — Component Methods

> **목적**: 각 Service 컴포넌트의 메서드 시그니처 및 입출력 정의
> **참고**: 상세 비즈니스 로직은 Construction Phase의 Functional Design에서 정의

---

## AuthService

```typescript
// Cognito JWT 검증 후 DB User 반환 (없으면 자동 생성)
getUserFromToken(token: string): Promise<User>

// Cognito 사용자 정보를 DB에 동기화 (최초 로그인 시)
syncCognitoUser(cognitoSub: string, email: string): Promise<User>
```

---

## BookmarkService

```typescript
// URL + 메타데이터로 북마크 생성 → 인박스에 추가
create(userId: string, input: CreateBookmarkInput): Promise<Bookmark>
// CreateBookmarkInput: { url, title?, description?, thumbnailUrl?, memo?, tagNames? }

// 북마크 메타데이터/태그/메모 수정
update(userId: string, bookmarkId: string, input: UpdateBookmarkInput): Promise<Bookmark>
// UpdateBookmarkInput: { title?, description?, memo?, tagNames? }

// 북마크 삭제 (BookmarkGroup 관계도 함께 삭제)
delete(userId: string, bookmarkId: string): Promise<void>

// 북마크를 특정 그룹으로 이동 (BookmarkGroup 레코드 생성/이동)
moveToGroup(userId: string, bookmarkId: string, groupId: string): Promise<void>

// 북마크를 컬렉션의 링크 블록으로 추가
// (CollectionService에 직접 의존하지 않고 block 데이터를 반환, 호출자가 CollectionService.addBlock() 호출)
getAsLinkBlock(userId: string, bookmarkId: string): Promise<LinkBlockContent>

// 인박스 목록 조회 (그룹에 미소속인 북마크)
getInbox(userId: string, options: InboxQueryOptions): Promise<PaginatedResult<Bookmark>>
// InboxQueryOptions: { sort: 'newest' | 'oldest', filter: 'all' | 'read' | 'unread', page, limit }

// 그룹별 북마크 목록 조회
getByGroup(userId: string, groupId: string): Promise<Bookmark[]>

// 최근 저장 북마크 목록 (Extension 팝업용)
getRecent(userId: string, limit?: number): Promise<Bookmark[]>

// 읽음 처리
markAsRead(userId: string, bookmarkId: string): Promise<void>

// 크롬 북마크 HTML 파싱 → 인박스 일괄 추가
importFromHtml(userId: string, htmlContent: string): Promise<{ imported: number; failed: number }>
```

---

## GroupService

```typescript
// 그룹 생성
create(userId: string, input: CreateGroupInput): Promise<Group>
// CreateGroupInput: { name, emoji, position? }

// 그룹 수정
update(userId: string, groupId: string, input: UpdateGroupInput): Promise<Group>
// UpdateGroupInput: { name?, emoji? }

// 그룹 삭제 (BookmarkGroup 레코드 삭제, 북마크 원본 유지)
delete(userId: string, groupId: string): Promise<void>

// 그룹 내 북마크 순서 변경
reorderBookmarks(userId: string, groupId: string, orderedBookmarkIds: string[]): Promise<void>

// 선택한 북마크들을 새 컬렉션의 링크 블록으로 복사 (그룹에서 제거 안 함)
convertToCollection(userId: string, groupId: string, bookmarkIds: string[], collectionInput: CreateCollectionInput): Promise<Collection>

// 사용자의 전체 그룹 목록 조회 (컬럼 순서 포함)
getAll(userId: string): Promise<Group[]>
```

---

## CollectionService

```typescript
// 컬렉션 생성
create(userId: string, input: CreateCollectionInput): Promise<Collection>
// CreateCollectionInput: { name, emoji?, description?, template: 'guide' | 'profile' }

// 컬렉션 메타데이터 수정
update(userId: string, collectionId: string, input: UpdateCollectionInput): Promise<Collection>
// UpdateCollectionInput: { name?, emoji?, description?, template? }

// 컬렉션 삭제 (블록 참조 북마크 원본 유지)
delete(userId: string, collectionId: string): Promise<void>

// 블록 추가
addBlock(userId: string, collectionId: string, block: AddBlockInput): Promise<Collection>
// AddBlockInput: { type: 'link' | 'text' | 'image', content: BlockContent, position? }

// 블록 수정
updateBlock(userId: string, collectionId: string, blockId: string, content: BlockContent): Promise<Collection>

// 블록 삭제
deleteBlock(userId: string, collectionId: string, blockId: string): Promise<Collection>

// 블록 순서 변경
reorderBlocks(userId: string, collectionId: string, orderedBlockIds: string[]): Promise<Collection>

// 공유 ON/OFF 토글
togglePublic(userId: string, collectionId: string): Promise<Collection>

// 슬러그 변경 (중복 체크 포함)
updateSlug(userId: string, collectionId: string, slug: string): Promise<Collection>

// 슬러그 중복 여부 확인 (실시간 체크용)
isSlugAvailable(slug: string, excludeCollectionId?: string): Promise<boolean>

// 공개 컬렉션 조회 (비로그인 접근 가능)
getPublicBySlug(slug: string): Promise<PublicCollection | null>

// 컬렉션 단건 조회 (편집 페이지용)
getById(userId: string, collectionId: string): Promise<Collection | null>

// 사용자의 컬렉션 목록 조회
getAll(userId: string): Promise<Collection[]>
```

---

## MetadataService

```typescript
// URL에서 OG 태그 파싱 (5초 타임아웃, 실패 시 null 반환)
fetchMetadata(url: string): Promise<UrlMetadata | null>
// UrlMetadata: { title: string, description: string | null, thumbnailUrl: string | null, favicon: string | null }
```

---

## SearchService

```typescript
// 사용자 데이터 전체 풀텍스트 검색 (북마크 + 컬렉션 블록 텍스트)
// PostgreSQL tsvector + GIN 인덱스 사용
search(userId: string, query: string, options?: SearchOptions): Promise<SearchResult[]>
// SearchOptions: { limit?: number }
// SearchResult: { type: 'bookmark' | 'collection', id: string, title: string, snippet: string, url?: string }
```

---

## TagService

```typescript
// 태그 이름으로 조회 또는 생성 (upsert)
getOrCreate(userId: string, name: string): Promise<Tag>

// 태그 자동완성 (prefix로 시작하는 태그 목록)
autocomplete(userId: string, prefix: string, limit?: number): Promise<Tag[]>

// 북마크에 연결된 태그 목록 조회
getByBookmark(userId: string, bookmarkId: string): Promise<Tag[]>

// 북마크의 태그 일괄 업데이트 (기존 태그 교체)
setBookmarkTags(userId: string, bookmarkId: string, tagNames: string[]): Promise<void>
```

---

## StorageService

```typescript
// S3 업로드용 Pre-signed URL 생성
getUploadUrl(userId: string, type: 'collection-image' | 'thumbnail', filename: string): Promise<PresignedUploadResult>
// PresignedUploadResult: { uploadUrl: string, key: string, publicUrl: string }

// S3 key를 CloudFront 공개 URL로 변환
toPublicUrl(s3Key: string): string

// 파일 삭제 (userId로 경로 소유권 검증)
deleteFile(userId: string, s3Key: string): Promise<void>
```

---

## CollectionStatsService

```typescript
// 조회수 atomic increment
incrementViewCount(collectionId: string): Promise<void>

// 링크 블록 클릭 기록
recordLinkClick(collectionId: string, blockId: string): Promise<void>

// 좋아요 토글 (IP+User-Agent 해시 기반 중복 방지)
toggleLike(collectionId: string, fingerprint: string): Promise<{ liked: boolean; likeCount: number }>

// 컬렉션 통계 조회
getStats(collectionId: string): Promise<CollectionStats>
// CollectionStats: { viewCount: number, likeCount: number, linkClicks: Record<blockId, number> }
```

---

## ExtensionAuthManager

```typescript
// Cognito 로그인 (Hosted UI 팝업)
login(): Promise<void>

// 로그아웃 (토큰 삭제)
logout(): Promise<void>

// 저장된 토큰 조회 (만료 시 자동 갱신)
getValidToken(): Promise<string | null>

// 로그인 상태 확인
isLoggedIn(): Promise<boolean>
```

---

## TopSitesRecommender

```typescript
// chrome.topSites에서 자주 방문 사이트 조회
getTopSites(): Promise<chrome.topSites.MostVisitedURL[]>

// 이미 저장된 북마크 URL 목록과 비교하여 미등록 사이트만 반환
getUnregisteredSites(savedUrls: string[]): Promise<RecommendedSite[]>
// RecommendedSite: { url: string, title: string }
```
