# moaring — Services

> **목적**: 서비스 레이어의 책임, 오케스트레이션 패턴, 외부 연동 정의

---

## 1. 서비스 레이어 원칙

- **Route Handler / Server Action은 얇게**: 요청 파싱 → Service 호출 → 응답 반환만 담당
- **비즈니스 로직은 Service에**: 모든 도메인 로직은 `lib/services/`에 위치
- **Service는 Prisma를 직접 사용**: Repository 패턴 없이 Service → Prisma → DB
- **에러는 공통 클래스로**: `AppError`, `NotFoundError`, `UnauthorizedError`, `ValidationError`
- **인증 컨텍스트 전달**: 모든 Service 메서드는 `userId`를 첫 번째 인자로 받아 데이터 격리 보장

---

## 2. 서비스 오케스트레이션 패턴

### 2.1 북마크 저장 흐름

```
[Client: URL 입력]
        |
        v
[API Route / Server Action]
        |
        v
[AuthService.getUserFromToken()]  ← JWT 검증
        |
        v
[MetadataService.fetchMetadata(url)]  ← OG 태그 fetch (5초 타임아웃)
        |
        v
[BookmarkService.create()]
  ├── TagService.getOrCreate() (태그가 있는 경우)
  └── Prisma: Bookmark + BookmarkTag INSERT
        |
        v
[Response: 생성된 Bookmark]
```

### 2.2 컬렉션 공유 페이지 조회 흐름 (비로그인 가능)

```
[Public: GET /c/{slug}]
        |
        v
[CollectionService.getPublicBySlug(slug)]
  └── Prisma: Collection + Blocks 조회 (is_public = true 조건)
        |
        v
[CollectionStatsService.incrementViewCount()]  ← 조회수 atomic increment
        |
        v
[SSR: PublicCollectionPage 렌더링]
```

### 2.3 검색 흐름

```
[Client: Cmd+K → 검색어 입력]
        |
        v
[GET /api/search?q={query}]
        |
        v
[AuthService.getUserFromToken()]
        |
        v
[SearchService.search(userId, query)]
  └── Prisma.$queryRaw: tsvector 풀텍스트 검색
      (bookmarks + collection blocks UNION)
        |
        v
[Response: SearchResult[]]
```

### 2.4 이미지 업로드 흐름

```
[Client: 이미지 파일 선택]
        |
        v
[POST /api/upload/presigned]
        |
        v
[StorageService.getUploadUrl()]
  └── AWS SDK: S3 Pre-signed URL 생성
        |
        v
[Response: { uploadUrl, publicUrl }]
        |
        v
[Client: S3에 직접 PUT 업로드]
        |
        v
[Client: publicUrl로 블록 content 업데이트]
```

---

## 3. 외부 서비스 연동

### Amazon Cognito
- **연동 위치**: `AuthService`, `middleware.ts`
- **방식**: JWKS 공개키로 JWT 서명 검증 (공개키는 메모리 캐싱)
- **사용 SDK**: `aws-jwt-verify` 또는 `jose` 라이브러리

### Amazon S3 + CloudFront
- **연동 위치**: `StorageService`
- **방식**: AWS SDK v3 (`@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`)
- **경로 규칙**: `users/{userId}/{type}/{uuid}.{ext}`
- **공개 URL**: CloudFront 도메인으로 변환

### Aurora PostgreSQL (Prisma)
- **연동 위치**: 모든 Service
- **연결 풀링**: Prisma의 connection pool (ECS 환경에서 적절한 pool size 설정)
- **특수 쿼리**: tsvector 검색은 `prisma.$queryRaw` 사용

### AWS Parameter Store
- **연동 위치**: 앱 시작 시 환경변수로 주입 (ECS Task Definition)
- **저장 항목**: DB 연결 문자열, Cognito 설정, S3 버킷명

---

## 4. 에러 처리 패턴

```typescript
// 공통 에러 클래스
class AppError extends Error {
  constructor(public statusCode: number, message: string) { ... }
}
class NotFoundError extends AppError { constructor(resource: string) { super(404, ...) } }
class UnauthorizedError extends AppError { constructor() { super(401, ...) } }
class ForbiddenError extends AppError { constructor() { super(403, ...) } }
class ValidationError extends AppError { constructor(message: string) { super(400, ...) } }
class ConflictError extends AppError { constructor(message: string) { super(409, ...) } }

// Route Handler 레벨 중앙 에러 핸들러
function withErrorHandler(handler: RouteHandler): RouteHandler {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx)
    } catch (error) {
      if (error instanceof AppError) {
        return NextResponse.json({ error: error.message }, { status: error.statusCode })
      }
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
  }
}
```

---

## 5. 인증 컨텍스트 패턴

```typescript
// Middleware: 보호 경로 일괄 검증
// middleware.ts
export async function middleware(request: NextRequest) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '')
               ?? request.cookies.get('access_token')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  // JWT 검증 (AuthService 호출)
  ...
}

// Route Handler: AuthService로 User 조회
// app/api/bookmarks/route.ts
export const POST = withErrorHandler(async (req) => {
  const token = req.headers.get('Authorization')!.replace('Bearer ', '')
  const user = await authService.getUserFromToken(token)
  const bookmark = await bookmarkService.create(user.id, await req.json())
  return NextResponse.json(bookmark, { status: 201 })
})
```
