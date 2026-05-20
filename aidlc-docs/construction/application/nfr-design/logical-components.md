# Unit 2 (Application) — Logical Components

> **작성일**: 2026-05-20  
> **단계**: Construction Phase — NFR Design

---

## 1. 논리 컴포넌트 전체 구조

```
+------------------------------------------------------------------+
|  Next.js App (ECS/Fargate)                                       |
|                                                                  |
|  +------------------+    +----------------------------------+    |
|  | Middleware Layer  |    | App Layer                        |    |
|  | (Edge Runtime)    |    | (Node.js Runtime)                |    |
|  |                  |    |                                  |    |
|  | - JWT 검증 (jose) |    | +----------------------------+  |    |
|  | - 로케일 감지     |    | | Pages / Server Components  |  |    |
|  | - 라우트 보호     |    | | (SSR, ISR)                 |  |    |
|  | - Token 갱신      |    | +----------------------------+  |    |
|  +------------------+    |             |                    |    |
|                          | +----------------------------+  |    |
|                          | | API Route Handlers         |  |    |
|                          | | + withErrorHandler()       |  |    |
|                          | +----------------------------+  |    |
|                          |             |                    |    |
|                          | +----------------------------+  |    |
|                          | | Server Actions             |  |    |
|                          | | + revalidatePath()         |  |    |
|                          | +----------------------------+  |    |
|                          |             |                    |    |
|                          | +----------------------------+  |    |
|                          | | Service Layer              |  |    |
|                          | | (Business Logic)           |  |    |
|                          | +----------------------------+  |    |
|                          |             |                    |    |
|                          | +----------------------------+  |    |
|                          | | Prisma ORM                 |  |    |
|                          | | (Connection Pool)          |  |    |
|                          | +----------------------------+  |    |
|                          +----------------------------------+    |
+------------------------------------------------------------------+
         |              |              |              |
   [Aurora PG]    [Cognito]        [S3/CF]     [CloudWatch]
   [tsvector]    [JWT/JWKS]    [Pre-signed]     [Logs]
```

---

## 2. 논리 컴포넌트 상세

### 2.1 Middleware Layer

**역할**: 모든 요청의 첫 번째 처리 지점

| 서브컴포넌트 | 역할 | 구현 |
|-------------|------|------|
| AuthGuard | JWT 서명 검증, 보호 경로 접근 제어 | `jose` + Cognito JWKS |
| TokenRefresher | Access Token 만료 시 자동 갱신 | Cognito RefreshToken API |
| LocaleDetector | 요청 로케일 감지 및 리다이렉트 | `next-intl/middleware` |
| RouteClassifier | 공개/보호/API 경로 분류 | pathname 패턴 매칭 |

**처리 순서**:
```
요청 수신
  → RouteClassifier (경로 분류)
  → 공개 경로 (/c/**, /login, /signup) → LocaleDetector → 통과
  → 보호 경로 → AuthGuard
      → 유효 → LocaleDetector → 통과
      → 만료 → TokenRefresher → 갱신 성공 → 통과
                              → 갱신 실패 → /login redirect
      → 없음 → /login redirect 또는 401
```

---

### 2.2 AuthService

**역할**: Cognito 연동 및 DB User 관리

```typescript
interface AuthService {
  // JWT 파싱 + DB User 조회 (Route Handler에서 사용)
  getUserFromToken(token: string): Promise<User>

  // 회원가입 완료 시 DB User 생성/동기화
  syncCognitoUser(cognitoSub: string, email: string): Promise<User>
}
```

**내부 구조**:
```
getUserFromToken(token)
  → jose.jwtVerify(token, JWKS)       // 서명 검증
  → JWT payload에서 sub 추출
  → prisma.user.findUnique({ cognito_sub: sub })
  → 없으면 NotFoundError (syncCognitoUser가 먼저 호출되어야 함)
  → User 반환
```

**JWKS 캐싱**: `createRemoteJWKSet`이 모듈 레벨에서 한 번만 초기화 → 이후 메모리 캐시 사용

---

### 2.3 BookmarkService

**역할**: 북마크 CRUD, 인박스 관리, Import

**의존 컴포넌트**:
- `MetadataService` — OG 태그 fetch (내부 호출)
- `TagService` — 태그 생성/연결 (내부 호출)
- `Prisma` — DB 조작

**핵심 로직 흐름**:
```
create(userId, input)
  → URL 유효성 검사 (Zod)
  → MetadataService.fetchMetadata(url)  [5초 타임아웃, 실패 시 null]
  → TagService.getOrCreate() × N        [태그가 있는 경우]
  → prisma.bookmark.create()
  → prisma.bookmarkTag.createMany()
  → Bookmark 반환

importFromHtml(userId, htmlContent)
  → cheerio로 <A> 태그 파싱
  → 배치 처리 (URL 유효성 검사 → INSERT)
  → MetadataService 호출 없음 (성능)
  → { imported, failed } 반환
```

---

### 2.4 CollectionService

**역할**: 컬렉션 CRUD, 블록 관리, 공유 설정

**블록 관리 패턴** (JSONB 배열 조작):
```typescript
// 블록 추가
async addBlock(userId, collectionId, blockInput) {
  const collection = await this.getById(userId, collectionId)
  const newBlock: Block = {
    id: nanoid(8),
    type: blockInput.type,
    position: collection.blocks.length,  // 마지막에 추가
    content: blockInput.content,
  }
  return prisma.collection.update({
    where: { id: collectionId },
    data: { blocks: [...collection.blocks, newBlock] },
  })
}

// 블록 순서 변경
async reorderBlocks(userId, collectionId, orderedBlockIds) {
  const collection = await this.getById(userId, collectionId)
  const reordered = orderedBlockIds.map((id, index) => {
    const block = collection.blocks.find(b => b.id === id)
    if (!block) throw new NotFoundError('Block')
    return { ...block, position: index }
  })
  return prisma.collection.update({
    where: { id: collectionId },
    data: { blocks: reordered },
  })
}
```

**슬러그 생성**:
```typescript
private async generateUniqueSlug(): Promise<string> {
  const alphabet = '0123456789abcdefghijklmnopqrstuvwxyz'
  let slug = customAlphabet(alphabet, 10)()
  // 충돌 시 재생성 (극히 드문 경우)
  while (!(await this.isSlugAvailable(slug))) {
    slug = customAlphabet(alphabet, 10)()
  }
  return slug
}
```

---

### 2.4 GroupService

**역할**: 그룹 CRUD, 북마크 순서 관리, 컬렉션 변환

**의존 컴포넌트**:
- `CollectionService` — 컬렉션 변환 시 내부 호출
- `Prisma` — DB 조작

**핵심 로직 흐름**:
```
getAll(userId)
  → prisma.group.findMany({ where: { user_id: userId }, orderBy: { position: 'asc' } })
  → 각 그룹에 bookmarks 배열 포함 (BookmarkGroup JOIN Bookmark, position ASC)

reorderBookmarks(userId, groupId, orderedBookmarkIds)
  → 소유권 검증
  → prisma.$transaction([
      ...orderedBookmarkIds.map((id, index) =>
        prisma.bookmarkGroup.update({
          where: { bookmark_id_group_id: { bookmark_id: id, group_id: groupId } },
          data: { position: index },
        })
      )
    ])

convertToCollection(userId, groupId, bookmarkIds, collectionInput)
  → 소유권 검증 (그룹 + 각 북마크)
  → CollectionService.create() 호출
  → 각 북마크를 LinkBlock으로 변환 (스냅샷 복사)
  → 원본 그룹/북마크 유지 (삭제 없음)
```

---

### 2.5 SearchService

**역할**: PostgreSQL tsvector 풀텍스트 검색

**쿼리 구조**:
```typescript
async search(userId: string, query: string): Promise<SearchResult[]> {
  if (!query.trim()) return []

  // plainto_tsquery: 공백 구분 단어를 AND 조합으로 변환
  // 특수문자 자동 이스케이프
  const results = await prisma.$queryRaw<RawSearchResult[]>`
    SELECT 'bookmark' as type, b.id, b.title, b.url,
           ts_rank(b.search_vector, plainto_tsquery('simple', ${query})) as rank,
           b.created_at
    FROM "Bookmark" b
    WHERE b.user_id = ${userId}
      AND (
        b.search_vector @@ plainto_tsquery('simple', ${query})
        OR EXISTS (
          SELECT 1 FROM "BookmarkTag" bt
          JOIN "Tag" t ON t.id = bt.tag_id
          WHERE bt.bookmark_id = b.id
            AND t.name ILIKE '%' || replace(replace(${query}, '%', '\%'), '_', '\_') || '%' ESCAPE '\'
        )
      )

    UNION ALL

    SELECT 'collection' as type, c.id, c.name as title, NULL as url,
           ts_rank(c.search_vector, plainto_tsquery('simple', ${query})) as rank,
           c.created_at
    FROM "Collection" c
    WHERE c.user_id = ${userId}
      AND c.search_vector @@ plainto_tsquery('simple', ${query})

    ORDER BY rank DESC, created_at DESC
    LIMIT 20
  `
  return results.map(this.mapToSearchResult)
}
```

---

### 2.6 MetadataService

**역할**: URL OG 태그 fetch (외부 HTTP 요청)

**타임아웃 + Graceful Degradation**:
```typescript
async fetchMetadata(url: string): Promise<UrlMetadata | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)
  try {
    const res = await fetch(url, { signal: controller.signal })
    clearTimeout(timeout)
    if (!res.ok) return null
    const html = await res.text()
    return this.parseOgTags(html)
  } catch {
    clearTimeout(timeout)
    return null  // 실패 시 null (예외 전파 없음)
  }
}

private parseOgTags(html: string): UrlMetadata {
  // cheerio로 <meta property="og:*"> 파싱
  const $ = load(html)
  return {
    title: $('meta[property="og:title"]').attr('content')
        ?? $('title').text()
        ?? '',
    description: $('meta[property="og:description"]').attr('content') ?? null,
    thumbnailUrl: $('meta[property="og:image"]').attr('content') ?? null,
    favicon: $('link[rel="icon"]').attr('href') ?? null,
  }
}
```

---

### 2.7 StorageService

**역할**: S3 Pre-signed URL 생성, CloudFront URL 변환

```typescript
async getUploadUrl(
  userId: string,
  type: 'collection-image' | 'thumbnail',
  filename: string
): Promise<PresignedUploadResult> {
  const ext = path.extname(filename).toLowerCase()
  const key = `users/${userId}/${type}/${nanoid(10)}${ext}`

  const command = new PutObjectCommand({
    Bucket: env.AWS_S3_BUCKET_NAME,
    Key: key,
    ContentType: this.getMimeType(ext),
  })

  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 })  // 5분

  return {
    uploadUrl,
    key,
    publicUrl: this.toPublicUrl(key),
  }
}

toPublicUrl(s3Key: string): string {
  return `https://${env.AWS_CLOUDFRONT_DOMAIN}/${s3Key}`
}
```

---

### 2.8 CollectionStatsService

**역할**: 조회수/클릭수/좋아요 통계

```typescript
// 조회수 atomic increment
async incrementViewCount(collectionId: string): Promise<void> {
  await prisma.collection.update({
    where: { id: collectionId },
    data: { view_count: { increment: 1 } },
  })
}

// 좋아요 toggle (로그인 사용자, user_id 기반 fingerprint)
async toggleLike(
  collectionId: string,
  userId: string
): Promise<{ liked: boolean; likeCount: number }> {
  const fingerprint = createHash('sha256').update(userId).digest('hex')

  const existing = await prisma.collectionLike.findUnique({
    where: {
      // Prisma schema: @@unique([collection_id, fingerprint], name: "collection_id_fingerprint")
      collection_id_fingerprint: { collection_id: collectionId, fingerprint },
    },
  })

  if (existing) {
    // 좋아요 취소
    await prisma.collectionLike.delete({ where: { id: existing.id } })
  } else {
    // 좋아요 추가
    await prisma.collectionLike.create({
      data: { collection_id: collectionId, fingerprint },
    })
  }

  const likeCount = await prisma.collectionLike.count({
    where: { collection_id: collectionId },
  })

  return { liked: !existing, likeCount }
}
```

---

### 2.9 TagService

**역할**: 태그 생성/조회, 자동완성

```typescript
// getOrCreate: upsert 패턴
async getOrCreate(userId: string, name: string): Promise<Tag> {
  const normalized = name.toLowerCase().trim()
  return prisma.tag.upsert({
    where: { user_id_name: { user_id: userId, name: normalized } },
    create: { user_id: userId, name: normalized },
    update: {},  // 이미 존재하면 그대로
  })
}

// 자동완성: prefix 검색
async autocomplete(userId: string, prefix: string, limit = 10): Promise<Tag[]> {
  return prisma.tag.findMany({
    where: {
      user_id: userId,
      name: { startsWith: prefix.toLowerCase() },
    },
    orderBy: { name: 'asc' },
    take: limit,
  })
}
```

---

## 3. 컴포넌트 의존성 맵

```
Middleware
  └── jose (JWT 검증)
  └── next-intl (로케일)

API Route Handlers / Server Actions
  └── withErrorHandler()
  └── AuthService
      └── jose
      └── Prisma (User)
  └── BookmarkService
      └── MetadataService (cheerio, fetch)
      └── TagService
          └── Prisma (Tag, BookmarkTag)
      └── Prisma (Bookmark)
  └── GroupService
      └── Prisma (Group, BookmarkGroup)
  └── CollectionService
      └── MetadataService (링크 블록 URL 직접 입력 시)
      └── nanoid (슬러그, 블록 ID)
      └── Prisma (Collection)
  └── SearchService
      └── Prisma.$queryRaw (tsvector)
  └── StorageService
      └── @aws-sdk/client-s3
      └── @aws-sdk/s3-request-presigner
  └── CollectionStatsService
      └── crypto (SHA256 fingerprint)
      └── Prisma (CollectionLike, CollectionLinkClick)
  └── TagService
      └── Prisma (Tag)
```

---

## 4. 데이터 흐름 요약

### 4.1 읽기 경로 (Read Path)

```
브라우저 → CloudFront → ALB → ECS
  → Middleware (JWT 검증)
  → Server Component (SSR)
    → Service Layer
      → Prisma → Aurora PostgreSQL
  → HTML 응답
```

### 4.2 쓰기 경로 (Write Path)

```
브라우저 → CloudFront → ALB → ECS
  → Middleware (JWT 검증)
  → Server Action / API Route
    → withErrorHandler()
    → AuthService.getUserFromToken()
    → Service Layer
      → Prisma → Aurora PostgreSQL
    → revalidatePath() (캐시 무효화)
  → 응답
```

### 4.3 이미지 업로드 경로

```
브라우저 → ECS (Pre-signed URL 요청)
  → StorageService → S3 Pre-signed URL 생성
  → 브라우저 → S3 (직접 PUT 업로드)
  → 브라우저 → ECS (CloudFront URL로 블록 업데이트)
```

### 4.4 검색 경로

```
브라우저 (Cmd+K) → SWR → GET /api/search
  → Middleware (JWT 검증)
  → SearchService.search()
    → Prisma.$queryRaw (GIN 인덱스 활용)
    → Aurora PostgreSQL
  → SearchResult[] 응답
  → SWR 캐시 (stale-while-revalidate)
```

---

## 5. 환경별 컴포넌트 구성

| 컴포넌트 | 로컬 개발 | 프로덕션 |
|----------|-----------|----------|
| PostgreSQL | Docker Compose | Aurora Serverless v2 |
| Cognito | 실제 AWS 개발 계정 | 실제 AWS 프로덕션 계정 |
| S3 | 실제 AWS 개발 버킷 | 실제 AWS 프로덕션 버킷 |
| CloudFront | 없음 (S3 URL 직접 사용) | CloudFront 배포 |
| 환경 변수 | `.env.local` | AWS Parameter Store → ECS |
| 로그 | 콘솔 출력 | CloudWatch Logs |
