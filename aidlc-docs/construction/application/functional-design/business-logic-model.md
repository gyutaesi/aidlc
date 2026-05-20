# Unit 2 (Application) — Business Logic Model

> **작성일**: 2026-05-20  
> **단계**: Construction Phase — Functional Design

---

## 1. 북마크 저장 흐름

### 1.1 웹앱에서 URL 입력 → 저장

```
[사용자: URL 붙여넣기]
        |
        v
[클라이언트: URL 형식 유효성 검사]
  - http:// 또는 https:// 시작 여부
  - 유효하지 않으면 즉시 에러 표시
        |
        v
[Server Action: createBookmark(userId, input)]
        |
        v
[BookmarkService.create()]
  |
  +-- [MetadataService.fetchMetadata(url)]
  |     - 5초 타임아웃
  |     - OG 태그 파싱 (title, description, og:image)
  |     - 실패 시 null 반환 → 클라이언트에 토스트 메시지 (Q17: B)
  |
  +-- [TagService.getOrCreate()] (태그가 있는 경우)
  |     - 태그 이름 소문자 정규화
  |     - DB upsert (user_id, name)
  |
  +-- [Prisma: Bookmark INSERT]
  |     - group_id 없음 → 인박스 상태
  |
  +-- [Prisma: BookmarkTag INSERT] (태그가 있는 경우)
        |
        v
[Response: 생성된 Bookmark]
```

### 1.2 Chrome Extension에서 저장

```
[Extension: 현재 페이지 URL + 그룹 선택 + 태그 + 메모]
        |
        v
[POST /api/bookmarks (JWT 인증)]
        |
        v
[API Route Handler]
  - Middleware: JWT 서명 검증 (Edge, jose)
  - AuthService.getUserFromToken(): DB User 조회
        |
        v
[BookmarkService.create(userId, input)]
  - 그룹 선택 시: BookmarkGroup 레코드도 생성
  - 그룹 미선택 시: 인박스 상태
```

---

## 2. 인박스 관리 흐름

### 2.1 인박스 조회

```
[BookmarkService.getInbox(userId, options)]
  |
  +-- Prisma: Bookmark WHERE user_id = ?
  |     AND NOT EXISTS (SELECT 1 FROM BookmarkGroup WHERE bookmark_id = Bookmark.id)
  |
  +-- sort: 'newest' → ORDER BY created_at DESC
  |         'oldest' → ORDER BY created_at ASC
  |
  +-- filter: 'all'    → 전체
  |           'read'   → WHERE is_read = true
  |           'unread' → WHERE is_read = false
  |
  +-- pagination: LIMIT + OFFSET
```

### 2.2 읽음 처리 (Q1: C — 자동 + 명시적)

```
경로 1 — 명시적 읽음 버튼 클릭:
[사용자: "읽음" 버튼 클릭]
        |
        v
[Server Action: markAsRead(userId, bookmarkId)]
        |
        v
[BookmarkService.markAsRead()]
  - Prisma: UPDATE Bookmark SET is_read = true WHERE id = ? AND user_id = ?

경로 2 — URL 클릭 시 자동 읽음:
[사용자: 북마크 URL 클릭 (외부 링크 열기)]
        |
        v
[클라이언트: 링크 클릭 이벤트 핸들러]
  - window.open(url, '_blank') 실행
  - 동시에 Server Action: markAsRead() 호출 (fire-and-forget)
```

### 2.3 인박스 → 그룹 추가

```
[BookmarkService.moveToGroup(userId, bookmarkId, groupId)]
  |
  +-- 소유권 검증: Bookmark.user_id == userId
  +-- 그룹 소유권 검증: Group.user_id == userId
  +-- 이미 해당 그룹에 소속 여부 확인 (중복 추가 방지)
  |
  +-- Prisma: BookmarkGroup INSERT
  |     - bookmark_id, group_id
  |     - position = 해당 그룹의 현재 최대 position + 1
  |
  -- 참고: 북마크는 여러 그룹에 동시 소속 가능 (다대다)
  -- 인박스에서 그룹으로 "이동"은 실제로 그룹에 "추가"하는 동작
  -- 인박스에서 제거하려면 별도로 그룹 소속 여부를 확인해야 함
  -- (인박스 = 어떤 그룹에도 미소속 상태이므로, 그룹 추가 후 인박스에서 자동 제외)
```

---

## 3. 그룹 관리 흐름

### 3.1 그룹 대시보드 조회

```
[GroupService.getAll(userId)]
  |
  +-- Prisma: Group WHERE user_id = ? ORDER BY position ASC
  +-- 각 그룹에 대해: BookmarkGroup JOIN Bookmark (position ASC)
  +-- 결과: Group[] (각 그룹에 bookmarks 배열 포함)
```

### 3.2 그룹 → 컬렉션 변환 (Q11: A — 원본 그룹 유지)

```
[GroupService.convertToCollection(userId, groupId, bookmarkIds, collectionInput)]
  |
  +-- 소유권 검증: Group.user_id == userId
  +-- 각 bookmarkId 소유권 검증
  |
  +-- Prisma Transaction:
  |     1. Collection INSERT (nanoid 슬러그 자동 생성)
  |     2. 각 bookmarkId에 대해:
  |          - Bookmark 조회 (스냅샷 데이터 수집)
  |          - LinkBlock 생성 (bookmark_id 연결, 스냅샷 복사)
  |          - Collection.blocks 배열에 추가
  |
  +-- 원본 그룹 유지 (삭제 없음)
  +-- 원본 북마크 그룹 소속 유지 (BookmarkGroup 삭제 없음)
  |
  +-- 결과: 새로 생성된 Collection 반환
```

---

## 4. 컬렉션 관리 흐름

### 4.1 컬렉션 생성

```
[CollectionService.create(userId, input)]
  |
  +-- nanoid(10) 슬러그 자동 생성
  +-- 슬러그 충돌 확인 (극히 드물지만 재생성 로직 포함)
  |
  +-- Prisma: Collection INSERT
  |     - blocks: [] (빈 배열)
  |     - is_public: false
  |     - position: 현재 최대 position + 1
```

### 4.2 블록 추가 (Q6: C — 두 경로 지원)

```
경로 1 — 기존 북마크 연결:
[CollectionService.addBlock(userId, collectionId, { type: 'link', bookmarkId })]
  |
  +-- Bookmark 조회 (소유권 검증)
  +-- LinkBlock 생성:
  |     - bookmark_id: bookmarkId
  |     - url, title, description, thumbnail_url, tags: 북마크에서 스냅샷 복사
  +-- Collection.blocks 배열에 append
  +-- Prisma: Collection UPDATE (blocks JSONB)

경로 2 — URL 직접 입력:
[CollectionService.addBlock(userId, collectionId, { type: 'link', url })]
  |
  +-- MetadataService.fetchMetadata(url) 호출
  +-- LinkBlock 생성:
  |     - bookmark_id: null
  |     - url, title, description, thumbnail_url: OG 태그 또는 수동 입력값
  +-- Collection.blocks 배열에 append
  +-- Prisma: Collection UPDATE (blocks JSONB)
```

### 4.3 블록 순서 변경

```
[CollectionService.reorderBlocks(userId, collectionId, orderedBlockIds)]
  |
  +-- 소유권 검증
  +-- 현재 blocks 배열 로드
  +-- orderedBlockIds 순서대로 position 재할당
  +-- Prisma: Collection UPDATE (blocks JSONB 전체 교체)
```

### 4.4 공개 컬렉션 조회 (비로그인 가능)

```
[GET /c/{slug}] — 공개 라우트, 인증 불필요
        |
        v
[CollectionService.getPublicBySlug(slug)]
  |
  +-- Prisma: Collection WHERE slug = ? AND is_public = true
  +-- null이면 404 페이지
        |
        v
[CollectionStatsService.incrementViewCount(collectionId)]
  - Prisma: UPDATE Collection SET view_count = view_count + 1
  - atomic increment (race condition 안전)
        |
        v
[SSR: PublicCollectionPage 렌더링]
```

### 4.5 슬러그 중복 체크 (Q18: C)

```
실시간 체크 (클라이언트):
[사용자: 슬러그 입력 중]
  - debounce 300ms
  - GET /api/collections/slug-check?slug={value}&excludeId={collectionId}
  - CollectionService.isSlugAvailable() 호출
  - 중복이면 입력 필드 에러 표시 + 저장 버튼 비활성화

저장 시 최종 검증 (서버):
[CollectionService.updateSlug()]
  - DB UNIQUE 제약으로 최종 중복 방지
  - 충돌 시 ConflictError(409) 반환
```

---

## 5. 검색 흐름

### 5.1 검색 실행 (Q9: A+B+C+D+E, Q10: C)

```
[사용자: Cmd+K → 검색어 입력]
        |
        v
[GET /api/search?q={query}]
        |
        v
[SearchService.search(userId, query)]
  |
  +-- query 전처리:
  |     - 공백 trim
  |     - 특수문자 이스케이프
  |     - tsquery 형식 변환 (단어 AND 조합)
  |
  +-- Prisma.$queryRaw: 두 쿼리 UNION
  |
  |   -- 쿼리 1: 북마크 검색 (A+B+C — 제목/URL/메모/태그)
  |   SELECT DISTINCT ON (b.id)
  |          'bookmark' as type, b.id, b.title, b.url,
  |          ts_rank(
  |            to_tsvector('simple',
  |              coalesce(b.title,'') || ' ' ||
  |              coalesce(b.url,'') || ' ' ||
  |              coalesce(b.memo,'')
  |            ),
  |            plainto_tsquery('simple', {query})
  |          ) as rank,
  |          b.created_at
  |   FROM "Bookmark" b
  |   WHERE b.user_id = {userId}
  |     AND (
  |       -- 제목/URL/메모 검색
  |       to_tsvector('simple',
  |         coalesce(b.title,'') || ' ' ||
  |         coalesce(b.url,'') || ' ' ||
  |         coalesce(b.memo,'')
  |       ) @@ plainto_tsquery('simple', {query})
  |       OR
  |       -- 태그 검색 (서브쿼리)
  |       EXISTS (
  |         SELECT 1 FROM "BookmarkTag" bt
  |         JOIN "Tag" t ON t.id = bt.tag_id
  |         WHERE bt.bookmark_id = b.id
  |           AND t.name ILIKE '%' || {query} || '%'
  |       )
  |     )
  |
  |   UNION ALL
  |
  |   -- 쿼리 2: 컬렉션 검색 (D+E — 이름/설명/블록텍스트)
  |   SELECT 'collection' as type, c.id, c.name as title, NULL as url,
  |          ts_rank(
  |            to_tsvector('simple',
  |              coalesce(c.name,'') || ' ' ||
  |              coalesce(c.description,'')
  |            ),
  |            plainto_tsquery('simple', {query})
  |          ) as rank,
  |          c.created_at
  |   FROM "Collection" c
  |   WHERE c.user_id = {userId}
  |     AND to_tsvector('simple',
  |           coalesce(c.name,'') || ' ' ||
  |           coalesce(c.description,'') || ' ' ||
  |           coalesce(c.blocks_text,'')  -- generated column (블록 텍스트 추출)
  |         ) @@ plainto_tsquery('simple', {query})
  |
  +-- ORDER BY rank DESC, created_at DESC  (Q10: C)
  +-- LIMIT 20
```

---

## 6. 인증 흐름

### 6.1 회원가입 → DB User 생성 (Q8: B)

```
[사용자: 이메일 + 비밀번호 입력]
        |
        v
[Server Action: signUp()]
  - Cognito: SignUp API 호출
        |
        v
[사용자: 이메일 인증 코드 입력]
        |
        v
[Server Action: confirmSignUp()]
  - Cognito: ConfirmSignUp API 호출
        |
        v
[Server Action: syncCognitoUser(cognitoSub, email)]
  - AuthService.syncCognitoUser()
  - Prisma: User UPSERT (cognito_sub 기준)
        |
        v
[로그인 페이지로 redirect]
```

### 6.2 로그인 → 토큰 저장 (Q7: A)

```
[사용자: 이메일 + 비밀번호 입력]
        |
        v
[Server Action: signIn()]
  - Cognito: InitiateAuth API 호출
  - AccessToken + RefreshToken 수신
        |
        v
[Server Action: 토큰을 HttpOnly Cookie에 저장]
  - access_token: HttpOnly, Secure, SameSite=Lax, MaxAge=3600 (1시간)
  - refresh_token: HttpOnly, Secure, SameSite=Lax, MaxAge=2592000 (30일)
        |
        v
[대시보드로 redirect]
```

### 6.3 API 요청 인증 흐름

```
[클라이언트 요청]
        |
        v
[middleware.ts (Edge Runtime)]
  - Cookie에서 access_token 추출
  - jose로 JWT 서명 검증 (Cognito JWKS 공개키)
  - 유효하지 않으면:
    - 페이지 경로: /login redirect
    - API 경로: 401 반환
        |
        v
[API Route Handler (Node.js Runtime)]
  - AuthService.getUserFromToken(token)
  - Prisma: User WHERE cognito_sub = ? 조회
  - user 객체를 이후 Service 호출에 전달
```

### 6.4 Access Token 만료 처리

```
[Middleware: JWT 검증 실패 (만료)]
        |
        v
[Cookie에서 refresh_token 확인]
  - 있으면: Cognito RefreshToken으로 새 AccessToken 발급
  - 없으면: /login redirect
        |
        v
[새 access_token을 Cookie에 갱신]
        |
        v
[원래 요청 계속 처리]
```

---

## 7. 이미지 업로드 흐름

```
[사용자: 이미지 파일 선택 (컬렉션 이미지 블록)]
        |
        v
[클라이언트: 파일 타입/크기 검증]
  - 허용 타입: image/jpeg, image/png, image/webp, image/gif
  - 최대 크기: 10MB
        |
        v
[POST /api/upload/presigned]
  - StorageService.getUploadUrl(userId, 'collection-image', filename)
  - S3 경로: users/{userId}/collection-image/{nanoid}.{ext}
  - Pre-signed URL 생성 (유효시간: 5분)
        |
        v
[클라이언트: S3에 직접 PUT 업로드]
  - Content-Type 헤더 포함
        |
        v
[클라이언트: publicUrl로 ImageBlock content 업데이트]
  - StorageService.toPublicUrl(s3Key) → CloudFront URL
```

---

## 8. 데이터 내보내기 흐름

### 8.1 JSON Export

```
[GET /api/export?format=json]
        |
        v
[BookmarkService.exportToJson(userId)]
  - 전체 북마크 + 태그 + 그룹 + 컬렉션 조회
  - JSON 직렬화
  - Response: application/json, Content-Disposition: attachment
```

### 8.2 Chrome HTML Export

```
[GET /api/export?format=html]
        |
        v
[BookmarkService.exportToHtml(userId)]
  - 전체 북마크 + 그룹 조회
  - Chrome 북마크 HTML 형식으로 변환:
    <!DOCTYPE NETSCAPE-Bookmark-file-1>
    <DL><p>
      <DT><H3>그룹명</H3>
      <DL><p>
        <DT><A HREF="url" ADD_DATE="timestamp">title</A>
      </DL><p>
    </DL><p>
  - Response: text/html, Content-Disposition: attachment
```

---

## 9. 크롬 북마크 Import 흐름 (Q3: B — 중복 허용)

```
[사용자: 크롬 북마크 HTML 파일 업로드]
        |
        v
[Server Action: importBookmarks(userId, htmlContent)]
        |
        v
[BookmarkService.importFromHtml(userId, htmlContent)]
  |
  +-- HTML 파싱 (DOMParser 또는 cheerio)
  |     - <A> 태그 추출: href, 텍스트 내용
  |     - 폴더 구조 무시 (평탄화)
  |
  +-- 각 URL에 대해 (배치 처리):
  |     - URL 유효성 검사 (http/https)
  |     - 유효하지 않으면 failed++ 후 스킵
  |     - 중복 URL도 새로 추가 (중복 허용)
  |     - MetadataService.fetchMetadata() 호출 안 함 (성능)
  |       → 크롬 북마크의 텍스트를 title로 사용
  |     - Prisma: Bookmark INSERT (인박스 상태)
  |     - imported++
  |
  +-- 결과: { imported: number; failed: number }
        |
        v
[클라이언트: 결과 토스트 표시]
  예: "300개 중 295개 추가 완료, 5개 실패"
```
