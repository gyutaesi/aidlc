# Unit 2 (Application) — NFR Design Patterns

> **작성일**: 2026-05-20  
> **단계**: Construction Phase — NFR Design

---

## 1. 성능 패턴 (Performance Patterns)

### 1.1 풀텍스트 검색 — Generated Column + GIN 인덱스 패턴

**목표**: 검색 응답 < 300ms (NFR-PERF-01)

**패턴**: 쿼리 시점 계산 대신 저장 시점 인덱싱

```
[데이터 INSERT/UPDATE]
        |
        v
[PostgreSQL: search_vector Generated Column 자동 갱신]
  - STORED 타입: 디스크에 저장, 쿼리 시 재계산 없음
  - to_tsvector('simple', ...) 로 토큰화
        |
        v
[GIN 인덱스: 역인덱스 구조]
  - 각 토큰 → 해당 행 ID 매핑
  - @@ 연산자로 O(log n) 조회
        |
        v
[검색 쿼리: search_vector @@ plainto_tsquery('simple', query)]
  - Index Scan (Sequential Scan 없음)
  - 목표: < 300ms
```

**Bookmark 테이블 search_vector 구성**:

```sql
to_tsvector('simple',
  coalesce(title, '') || ' ' ||
  coalesce(url, '') || ' ' ||
  coalesce(memo, '')
)
-- 태그는 EXISTS 서브쿼리로 별도 처리 (JOIN 없이 GROUP BY 문제 회피)
```

**Collection 테이블 search_vector 구성**:

```sql
-- Step 1: blocks_text generated column (JSONB 텍스트 블록 추출)
(SELECT string_agg(block->>'markdown', ' ')
 FROM jsonb_array_elements(blocks) block
 WHERE block->>'type' = 'text')

-- Step 2: search_vector generated column
to_tsvector('simple',
  coalesce(name, '') || ' ' ||
  coalesce(description, '') || ' ' ||
  coalesce(blocks_text, '')
)
```

**'simple' 사전 선택 이유**: 한국어는 형태소 분석기(`korean` 사전)가 필요하지만 Aurora PostgreSQL에서 기본 제공하지 않음. `simple`은 소문자 변환만 수행하며 한국어 단어 단위 검색에 충분함.

---

### 1.2 이미지 업로드 — Client-Side Upload 패턴

**목표**: 서버 부하 최소화 (NFR-PERF-03)

**패턴**: Pre-signed URL을 통한 클라이언트 직접 업로드

```
[클라이언트]          [Next.js 서버]         [AWS S3]
     |                     |                    |
     |-- POST /api/upload/presigned -->          |
     |                     |                    |
     |                [StorageService]           |
     |                [S3 Pre-signed URL 생성]   |
     |                [유효시간: 5분]            |
     |                     |                    |
     |<-- { uploadUrl, publicUrl } --            |
     |                     |                    |
     |-- PUT {uploadUrl} (파일 직접 전송) ------>|
     |                     |                    |
     |<-- 200 OK ---------------------          |
     |                     |                    |
     |-- [publicUrl로 블록 content 업데이트] --->|
```

**서버가 처리하는 것**: Pre-signed URL 발급 요청 1회 (파일 데이터 미경유)  
**S3 경로 규칙**: `users/{userId}/{type}/{nanoid(10)}.{ext}`  
**CloudFront URL 변환**: `https://{CF_DOMAIN}/users/{userId}/...`

---

### 1.3 페이지네이션 — Offset 패턴

**목표**: 인박스/검색 목록 조회 (NFR-PERF-04)

```typescript
// 표준 Offset 페이지네이션 패턴
interface PaginationParams {
  page: number // 1부터 시작
  limit: number // 기본값 20
}

interface PaginatedResult<T> {
  data: T[]
  total: number
  page: number
  totalPages: number
  hasNext: boolean
}

// Prisma 구현
const [data, total] = await prisma.$transaction([
  prisma.bookmark.findMany({
    where: { user_id: userId, ...filter },
    orderBy: { created_at: sort === 'newest' ? 'desc' : 'asc' },
    skip: (page - 1) * limit,
    take: limit,
  }),
  prisma.bookmark.count({ where: { user_id: userId, ...filter } }),
])
```

---

### 1.4 SSR 캐싱 — Next.js Cache 패턴

**목표**: 공유 페이지 초기 로딩 < 1.5s (NFR-PERF-02)

```typescript
// 공개 컬렉션 페이지 — 정적 생성 + 재검증
// app/c/[slug]/page.tsx
export const revalidate = 60 // 60초마다 재검증 (ISR)

async function PublicCollectionPage({ params }) {
  const collection = await CollectionService.getPublicBySlug(params.slug)
  // ...
}

// 대시보드 페이지 — 사용자별 동적 데이터, 캐시 없음
// app/(dashboard)/inbox/page.tsx
export const dynamic = 'force-dynamic'
```

**Server Action 후 캐시 무효화**:

```typescript
// 북마크 생성 후 (next-intl 로케일 prefix 포함, 전체 로케일 무효화)
revalidatePath('/[locale]/inbox', 'page')
revalidatePath('/[locale]/groups', 'page')

// 컬렉션 수정 후
revalidatePath('/[locale]/collections/[id]', 'page')
revalidateTag(`collection-${collectionId}`)

// 공개 컬렉션 페이지 (로케일 prefix 없음)
revalidatePath(`/c/${slug}`)
```

---

## 2. 보안 패턴 (Security Patterns)

### 2.1 인증 — Layered Auth 패턴

**두 레이어의 역할 분리**:

```
Layer 1: Middleware (Edge Runtime)
  - 목적: 빠른 라우트 보호 (DB 조회 없음)
  - 방법: jose로 JWT 서명 검증 (Cognito JWKS 공개키)
  - 처리: 유효하지 않으면 즉시 redirect/401
  - 위치: middleware.ts

Layer 2: API Route Handler / Server Action (Node.js Runtime)
  - 목적: 실제 사용자 컨텍스트 확보
  - 방법: AuthService.getUserFromToken() → DB User 조회
  - 처리: userId를 Service 메서드에 전달
  - 위치: app/api/**/route.ts, app/**/actions.ts
```

**JWKS 캐싱 패턴** (Middleware 성능 최적화):

```typescript
// jose의 createRemoteJWKSet은 내부적으로 JWKS를 캐싱
// Edge Runtime에서 전역 변수로 재사용
const JWKS = createRemoteJWKSet(
  new URL(`https://cognito-idp.us-east-1.amazonaws.com/{userPoolId}/.well-known/jwks.json`)
)
// 매 요청마다 새로 생성하지 않음 — 모듈 레벨에서 한 번만 초기화
```

---

### 2.2 토큰 갱신 — Silent Refresh 패턴

```
[Middleware: Access Token 만료 감지]
        |
        v
[Cookie에서 refresh_token 확인]
  |
  +-- 없음 → /login redirect
  |
  +-- 있음 →
        |
        v
[Cognito: InitiateAuth (REFRESH_TOKEN_AUTH)]
  - 새 Access Token 발급
        |
        v
[새 access_token Cookie 갱신]
  - Set-Cookie: access_token=...; HttpOnly; Secure; SameSite=Lax; MaxAge=3600
        |
        v
[원래 요청 계속 처리 (NextResponse.next())]
```

**구현 위치**: `middleware.ts` — 모든 보호된 경로에서 자동 처리

---

### 2.3 데이터 격리 — userId 필터 패턴

**모든 Service 메서드의 표준 패턴**:

```typescript
// 패턴 1: 단순 조회 (소유권 검증 포함)
async getById(userId: string, resourceId: string) {
  const resource = await prisma.bookmark.findFirst({
    where: { id: resourceId, user_id: userId }  // user_id 필터 필수
  })
  if (!resource) throw new NotFoundError('Bookmark')  // 존재 여부 노출 금지
  return resource
}

// 패턴 2: 목록 조회
async getAll(userId: string) {
  return prisma.bookmark.findMany({
    where: { user_id: userId }  // user_id 필터 필수
  })
}

// 패턴 3: 수정/삭제 (소유권 검증 후 처리)
async delete(userId: string, resourceId: string) {
  const resource = await this.getById(userId, resourceId)  // 소유권 검증
  await prisma.bookmark.delete({ where: { id: resource.id } })
}
```

**규칙**: `NotFoundError`를 반환 (`ForbiddenError` 금지 — 리소스 존재 여부 노출 방지)

---

### 2.4 입력 검증 — Zod Schema 패턴

**서버/클라이언트 스키마 공유**:

```typescript
// lib/schemas/bookmark.schema.ts — 서버/클라이언트 공유
import { z } from 'zod'

export const CreateBookmarkSchema = z.object({
  url: z.string().url().max(2048),
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(500).optional(),
  memo: z.string().max(1000).optional(),
  tagNames: z.array(z.string().min(1).max(50)).optional(),
  groupId: z.string().cuid().optional(),
})

export type CreateBookmarkInput = z.infer<typeof CreateBookmarkSchema>

// Server Action에서 사용
export async function createBookmark(userId: string, rawInput: unknown) {
  const input = CreateBookmarkSchema.parse(rawInput) // 런타임 검증
  return BookmarkService.create(userId, input)
}

// 클라이언트 폼에서 사용 (react-hook-form + zodResolver)
const form = useForm<CreateBookmarkInput>({
  resolver: zodResolver(CreateBookmarkSchema),
})
```

---

### 2.5 XSS 방어 — Sanitize 패턴

**마크다운 렌더링 파이프라인**:

```typescript
// components/ui/MarkdownRenderer.tsx
import ReactMarkdown from 'react-markdown'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'

const sanitizeSchema = {
  ...defaultSchema,
  tagNames: ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
             'ul', 'ol', 'li', 'a', 'strong', 'em',
             'code', 'pre', 'blockquote'],
  attributes: {
    ...defaultSchema.attributes,
    a: ['href', 'title'],  // href만 허용 (onclick 등 제거)
  },
  protocols: {
    href: ['http', 'https', 'mailto'],  // javascript: 차단
  },
}

export function MarkdownRenderer({ content }: { content: string }) {
  return (
    <ReactMarkdown rehypePlugins={[[rehypeSanitize, sanitizeSchema]]}>
      {content}
    </ReactMarkdown>
  )
}
```

**URL 렌더링 패턴** (링크 블록):

```typescript
function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return ['http:', 'https:'].includes(parsed.protocol)
  } catch {
    return false
  }
}

// 렌더링 시
<a href={isSafeUrl(block.content.url) ? block.content.url : '#'}
   target="_blank"
   rel="noopener noreferrer">
  {block.content.title}
</a>
```

---

### 2.6 에러 처리 — Central Error Handler 패턴

```typescript
// lib/errors.ts
export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string
  ) {
    super(message)
    this.name = this.constructor.name
  }
}
export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(404, `${resource} not found`)
  }
}
export class UnauthorizedError extends AppError {
  constructor() {
    super(401, 'Unauthorized')
  }
}
export class ForbiddenError extends AppError {
  constructor() {
    super(403, 'Forbidden')
  }
}
export class ValidationError extends AppError {
  constructor(message: string) {
    super(400, message)
  }
}
export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, message)
  }
}

// lib/api/with-error-handler.ts
type RouteHandler = (req: NextRequest, ctx: RouteContext) => Promise<NextResponse>

export function withErrorHandler(handler: RouteHandler): RouteHandler {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx)
    } catch (error) {
      // 구조화 로그 (CloudWatch JSON 형식)
      if (!(error instanceof AppError) || error.statusCode >= 500) {
        console.error(
          JSON.stringify({
            level: 'ERROR',
            message: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
            path: req.nextUrl.pathname,
            timestamp: new Date().toISOString(),
          })
        )
      }
      if (error instanceof AppError) {
        return NextResponse.json({ error: error.message }, { status: error.statusCode })
      }
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
  }
}

// 사용 예시
export const POST = withErrorHandler(async (req) => {
  const user = await authService.getUserFromToken(getTokenFromRequest(req))
  const bookmark = await bookmarkService.create(user.id, await req.json())
  return NextResponse.json(bookmark, { status: 201 })
})
```

---

## 3. 복원력 패턴 (Resilience Patterns)

### 3.1 외부 fetch — Timeout + Graceful Degradation 패턴

**OG 메타데이터 fetch**:

```typescript
// lib/services/metadata.service.ts
export class MetadataService {
  async fetchMetadata(url: string): Promise<UrlMetadata | null> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000) // 5초 타임아웃

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'moaring-bot/1.0' },
      })
      clearTimeout(timeoutId)

      if (!response.ok) return null

      const html = await response.text()
      return this.parseOgTags(html)
    } catch (error) {
      clearTimeout(timeoutId)
      // AbortError(타임아웃) 또는 네트워크 에러 — null 반환 (예외 throw 안 함)
      console.warn(
        JSON.stringify({
          level: 'WARN',
          message: 'OG metadata fetch failed',
          url,
          error: error instanceof Error ? error.message : 'Unknown',
        })
      )
      return null
    }
  }
}
```

**Graceful Degradation**: fetch 실패 시 null 반환 → 클라이언트 토스트 + 수동 입력 유도 (서비스 중단 없음)

---

### 3.2 Prisma 연결 — Singleton 패턴

**ECS 환경에서 연결 풀 관리**:

```typescript
// lib/prisma.ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    datasources: {
      db: { url: process.env.DATABASE_URL },
    },
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
// 개발 환경: 핫 리로드 시 연결 재사용 (연결 풀 고갈 방지)
// 프로덕션: 모듈 캐시로 단일 인스턴스 유지
```

**ECS 연결 풀 설정** (DATABASE_URL에 포함):

```
postgresql://user:pass@host:5432/db?connection_limit=10&pool_timeout=20
```

- `connection_limit`: ECS 태스크당 최대 연결 수 (Aurora Serverless v2 max_connections 고려)
- `pool_timeout`: 연결 대기 타임아웃 (초)

---

### 3.3 조회수 — Atomic Increment 패턴

**Race Condition 방지**:

```typescript
// lib/services/collection-stats.service.ts
async incrementViewCount(collectionId: string): Promise<void> {
  // Prisma의 atomic increment — DB 레벨에서 원자적 처리
  await prisma.collection.update({
    where: { id: collectionId },
    data: { view_count: { increment: 1 } },
  })
  // UPDATE collection SET view_count = view_count + 1 WHERE id = ?
  // 동시 요청에서도 정확한 카운트 보장
}
```

---

## 4. 유지보수성 패턴 (Maintainability Patterns)

### 4.1 구조화 로그 패턴

**CloudWatch JSON 로그 형식**:

```typescript
// lib/logger.ts
type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'

interface LogEntry {
  level: LogLevel
  message: string
  timestamp: string
  requestId?: string
  userId?: string
  [key: string]: unknown
}

export const logger = {
  info: (message: string, meta?: Record<string, unknown>) =>
    console.log(
      JSON.stringify({ level: 'INFO', message, timestamp: new Date().toISOString(), ...meta })
    ),
  warn: (message: string, meta?: Record<string, unknown>) =>
    console.warn(
      JSON.stringify({ level: 'WARN', message, timestamp: new Date().toISOString(), ...meta })
    ),
  error: (message: string, meta?: Record<string, unknown>) =>
    console.error(
      JSON.stringify({ level: 'ERROR', message, timestamp: new Date().toISOString(), ...meta })
    ),
}

// 사용 예시
logger.error('OG fetch failed', { url, error: err.message, userId })
logger.info('Bookmark created', { bookmarkId: bookmark.id, userId })
```

---

### 4.2 환경 변수 검증 패턴

**앱 시작 시 필수 환경 변수 검증**:

```typescript
// lib/env.ts
import { z } from 'zod'

const EnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  COGNITO_USER_POOL_ID: z.string().min(1),
  COGNITO_CLIENT_ID: z.string().min(1),
  COGNITO_REGION: z.string().min(1),
  AWS_S3_BUCKET_NAME: z.string().min(1),
  AWS_CLOUDFRONT_DOMAIN: z.string().min(1),
  AWS_REGION: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.string().url(),
})

export const env = EnvSchema.parse(process.env)
// 누락된 환경 변수가 있으면 앱 시작 시 즉시 에러 (런타임 에러 방지)
```

---

## 5. i18n 패턴

### 5.1 next-intl App Router 통합 패턴

**라우팅 구조**:

```
app/
├── [locale]/
│   ├── layout.tsx          # NextIntlClientProvider 설정
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── signup/page.tsx
│   ├── (dashboard)/
│   │   └── inbox/page.tsx
│   └── c/[slug]/page.tsx   # 로케일 prefix 없음 (공유 URL 단순화)
└── layout.tsx              # 루트 레이아웃
```

**middleware.ts 로케일 처리** (기존 인증 미들웨어와 통합):

```typescript
import createMiddleware from 'next-intl/middleware'
import { NextRequest, NextResponse } from 'next/server'

const intlMiddleware = createMiddleware({
  locales: ['ko', 'en'],
  defaultLocale: 'ko',
  localePrefix: 'always',
})

export async function middleware(request: NextRequest) {
  // 1. 공개 경로 (/c/[slug]) — 인증/로케일 처리 없이 통과
  if (request.nextUrl.pathname.startsWith('/c/')) {
    return NextResponse.next()
  }

  // 2. 인증 검증 (기존 로직)
  const authResult = await handleAuth(request)
  if (authResult) return authResult

  // 3. 로케일 처리
  return intlMiddleware(request)
}
```

**Server Component에서 번역 사용**:

```typescript
// Server Component: getTranslations() 사용 (async)
import { getTranslations } from 'next-intl/server'

export default async function InboxPage() {
  const t = await getTranslations('inbox')
  return <h1>{t('title')}</h1>
}

// Client Component: useTranslations() 사용 (hook)
'use client'
import { useTranslations } from 'next-intl'

export function InboxFilter() {
  const t = useTranslations('inbox')
  return <button>{t('filter.all')}</button>
}
```

**메시지 파일 구조 예시**:

```json
// messages/ko.json
{
  "common": {
    "save": "저장",
    "cancel": "취소",
    "delete": "삭제",
    "edit": "편집"
  },
  "inbox": {
    "title": "인박스",
    "empty": "저장된 링크가 없습니다",
    "sort": { "newest": "최신순", "oldest": "오래된순" },
    "filter": { "all": "전체", "read": "읽음", "unread": "읽지 않음" }
  },
  "bookmark": {
    "save": "링크 저장",
    "urlPlaceholder": "URL을 붙여넣으세요",
    "fetchingMetadata": "메타데이터 가져오는 중...",
    "fetchFailed": "메타데이터를 가져올 수 없습니다. 직접 입력해 주세요."
  },
  "errors": {
    "notFound": "찾을 수 없습니다",
    "unauthorized": "로그인이 필요합니다",
    "serverError": "서버 오류가 발생했습니다"
  }
}
```
