# Unit 2 (Application) — Tech Stack Decisions

> **작성일**: 2026-05-20  
> **단계**: Construction Phase — NFR Requirements

---

## 1. 확정된 기술 스택 전체 목록

### 1.1 코어 프레임워크

| 기술 | 버전 | 결정 근거 |
|------|------|-----------|
| Next.js | 15.x (App Router) | 요구사항 명시, SSR/SSG 공유 페이지 SEO |
| TypeScript | 5.x | 요구사항 명시, strict: true |
| React | 19.x (Next.js 15 포함) | Next.js 15 번들 |
| Node.js | 20.x LTS | ECS 컨테이너 기반 |

### 1.2 데이터베이스 & ORM

| 기술 | 버전 | 결정 근거 |
|------|------|-----------|
| Prisma | 5.x | 요구사항 명시, Aurora PostgreSQL 호환 |
| PostgreSQL | 15.x (Aurora Serverless v2) | 요구사항 명시, tsvector 검색, JSONB |

### 1.3 스타일링 & UI

| 기술 | 버전 | 결정 근거 |
|------|------|-----------|
| TailwindCSS | 3.x | 요구사항 명시 |
| shadcn/ui | latest | Q5: A — Radix UI 기반, TailwindCSS 통합, 접근성 |
| Radix UI | (shadcn/ui 내장) | shadcn/ui 의존성 |

### 1.4 상태 관리 & 데이터 페칭

| 기술 | 버전 | 결정 근거 |
|------|------|-----------|
| SWR | 2.x | Q9: A — 검색/자동완성 API 호출, Next.js 궁합 |
| React Hook Form | 7.x | Q8: A — 폼 유효성, 성능 |
| Zod | 3.x | Q8: A — 타입 안전 스키마, 서버/클라이언트 공유 |

### 1.5 인터랙션 & 에디터

| 기술 | 버전 | 결정 근거 |
|------|------|-----------|
| @dnd-kit/core | 6.x | Q6: A — 드래그앤드롭, 접근성, 터치 지원 |
| @dnd-kit/sortable | 7.x | Q6: A — dnd-kit 정렬 유틸리티 |
| react-markdown | 9.x | Q7: A — 마크다운 렌더링 |
| rehype-sanitize | 6.x | Q7: A — XSS 방어 |

### 1.6 인증

| 기술 | 버전 | 결정 근거 |
|------|------|-----------|
| jose | 5.x | Middleware Edge Runtime JWT 검증 (Cognito JWKS) |
| @aws-sdk/client-cognito-identity-provider | 3.x | Server Action Cognito API 호출 |

### 1.7 AWS SDK

| 기술 | 버전 | 결정 근거 |
|------|------|-----------|
| @aws-sdk/client-s3 | 3.x | S3 Pre-signed URL 생성 |
| @aws-sdk/s3-request-presigner | 3.x | Pre-signed URL 유틸리티 |

### 1.8 국제화

| 기술 | 버전 | 결정 근거 |
|------|------|-----------|
| next-intl | 3.x | Q19: C — 완전 적용, App Router 공식 지원 |

### 1.9 유틸리티

| 기술 | 버전 | 결정 근거 |
|------|------|-----------|
| nanoid | 5.x | 슬러그/블록 ID 생성 (URL-safe, 커스텀 alphabet) |
| cheerio | 1.x | 크롬 북마크 HTML 파싱 (서버 사이드) |

### 1.10 개발 도구

| 기술 | 버전 | 결정 근거 |
|------|------|-----------|
| ESLint | 8.x | Q16: A — Next.js 기본 포함 |
| Prettier | 3.x | Q16: A — 코드 포맷팅 |
| Husky | 9.x | Q16: A — Git hooks |
| lint-staged | 15.x | Q16: A — 커밋 전 검사 대상 파일 필터링 |
| Jest | 29.x | Q17: B — 단위 테스트 |
| ts-jest | 29.x | Q17: B — TypeScript Jest 변환 |

---

## 2. 주요 결정 사항 상세

### 2.1 shadcn/ui 선택 이유

shadcn/ui는 npm 패키지가 아니라 컴포넌트 코드를 프로젝트에 직접 복사하는 방식입니다.

**장점**:
- 번들에 사용하는 컴포넌트만 포함 (트리 쉐이킹 완벽)
- TailwindCSS 클래스로 완전 커스터마이징 가능
- Radix UI 기반으로 접근성(ARIA) 자동 처리
- Dialog, Dropdown, Toast, Command(Cmd+K) 등 필요한 컴포넌트 모두 제공

**moaring에서 사용할 주요 컴포넌트**:
```
Button, Input, Textarea, Label
Dialog (모달)
DropdownMenu (액션 메뉴)
Popover (태그 자동완성)
Command (Cmd+K 검색 팝업)
Toast / Sonner (알림)
Badge (태그 표시)
Separator, Card, Avatar
```

### 2.2 SWR vs TanStack Query

**SWR 선택 이유**:
- 대부분의 데이터 변경은 Server Action + `revalidatePath()`로 처리
- SWR은 읽기 전용 API 호출(검색, 태그 자동완성, 슬러그 체크)에만 사용
- 번들 크기: SWR ~4KB vs TanStack Query ~13KB
- Next.js와 같은 Vercel 생태계

**SWR 사용 위치**:
```typescript
// 검색 모달
const { data } = useSWR(query ? `/api/search?q=${query}` : null)

// 태그 자동완성
const { data } = useSWR(prefix ? `/api/tags?prefix=${prefix}` : null)

// 슬러그 중복 체크
const { data } = useSWR(slug ? `/api/collections/slug-check?slug=${slug}` : null)
```

### 2.3 next-intl 완전 적용 (Q19: C)

**구현 방식**:
```
app/
├── [locale]/              # 로케일 기반 라우팅
│   ├── (auth)/
│   ├── (dashboard)/
│   └── c/[slug]/
└── layout.tsx

messages/
├── ko.json
└── en.json

i18n.ts                    # next-intl 설정
middleware.ts              # 로케일 감지 + 리다이렉트
```

**로케일 감지 순서**:
1. URL prefix (`/ko/`, `/en/`)
2. Accept-Language 헤더
3. 기본값: `ko`

**주의사항**: 공개 컬렉션 URL(`/c/[slug]`)은 로케일 prefix 없이 유지 (공유 링크 단순화)

### 2.4 Generated Column으로 tsvector 관리 (Q3: B)

Prisma schema에서 `Unsupported` 타입으로 선언 후 마이그레이션 SQL에서 직접 정의:

```sql
-- Bookmark 테이블 search_vector
ALTER TABLE "Bookmark"
ADD COLUMN search_vector tsvector
GENERATED ALWAYS AS (
  to_tsvector('simple',
    coalesce(title, '') || ' ' ||
    coalesce(url, '') || ' ' ||
    coalesce(memo, '')
  )
) STORED;

CREATE INDEX idx_bookmark_search_vector ON "Bookmark" USING GIN(search_vector);

-- Collection 테이블 blocks_text (JSONB에서 텍스트 블록 내용 추출)
ALTER TABLE "Collection"
ADD COLUMN blocks_text text
GENERATED ALWAYS AS (
  (
    SELECT string_agg(
      coalesce(block->>'content'->>'markdown', ''),
      ' '
    )
    FROM jsonb_array_elements(blocks) AS block
    WHERE block->>'type' = 'text'
  )
) STORED;

ALTER TABLE "Collection"
ADD COLUMN search_vector tsvector
GENERATED ALWAYS AS (
  to_tsvector('simple',
    coalesce(name, '') || ' ' ||
    coalesce(description, '') || ' ' ||
    coalesce(blocks_text, '')
  )
) STORED;

CREATE INDEX idx_collection_search_vector ON "Collection" USING GIN(search_vector);
```

**Prisma schema 선언**:
```prisma
model Bookmark {
  // ... 기존 필드
  search_vector Unsupported("tsvector")?

  @@index([search_vector], type: Gin)
}
```

### 2.5 Husky + lint-staged 설정 (Q16: A)

```json
// package.json
{
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --fix",
      "prettier --write"
    ],
    "*.{json,md,css}": [
      "prettier --write"
    ]
  }
}
```

```bash
# .husky/pre-commit
npx lint-staged
```

### 2.6 Jest 단위 테스트 설정 (Q17: B)

```typescript
// jest.config.ts
export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testPathPattern: 'lib/services/__tests__/**/*.test.ts',
  setupFilesAfterFramework: ['<rootDir>/jest.setup.ts'],
}
```

**테스트 파일 위치**:
```
lib/services/__tests__/
├── bookmark.service.test.ts
├── collection.service.test.ts
├── search.service.test.ts
├── tag.service.test.ts
└── auth.service.test.ts
```

**Prisma 모킹**: `jest-mock-extended` 또는 `@prisma/client` mock

---

## 3. package.json 의존성 목록

### dependencies
```json
{
  "next": "^15.0.0",
  "react": "^19.0.0",
  "react-dom": "^19.0.0",
  "typescript": "^5.0.0",
  "@prisma/client": "^5.0.0",
  "tailwindcss": "^3.0.0",
  "swr": "^2.0.0",
  "react-hook-form": "^7.0.0",
  "zod": "^3.0.0",
  "@dnd-kit/core": "^6.0.0",
  "@dnd-kit/sortable": "^7.0.0",
  "react-markdown": "^9.0.0",
  "rehype-sanitize": "^6.0.0",
  "next-intl": "^3.0.0",
  "nanoid": "^5.0.0",
  "cheerio": "^1.0.0",
  "jose": "^5.0.0",
  "@aws-sdk/client-cognito-identity-provider": "^3.0.0",
  "@aws-sdk/client-s3": "^3.0.0",
  "@aws-sdk/s3-request-presigner": "^3.0.0"
}
```

### devDependencies
```json
{
  "prisma": "^5.0.0",
  "eslint": "^8.0.0",
  "eslint-config-next": "^15.0.0",
  "prettier": "^3.0.0",
  "husky": "^9.0.0",
  "lint-staged": "^15.0.0",
  "jest": "^29.0.0",
  "ts-jest": "^29.0.0",
  "@types/node": "^20.0.0",
  "@types/react": "^19.0.0",
  "@types/react-dom": "^19.0.0"
}
```

---

## 4. 제외된 기술 및 이유

| 기술 | 제외 이유 |
|------|-----------|
| Redis | MVP에서 캐싱 불필요, 복잡도 증가 |
| LocalStack | Cognito 에뮬레이션 복잡, 실제 AWS 개발 계정 사용 |
| Sentry | MVP 규모에서 CloudWatch로 충분, Post-MVP 추가 |
| TanStack Query | SWR로 충분, 번들 크기 절약 |
| Playwright (E2E) | MVP 설정 비용 대비 효과 낮음, Post-MVP 추가 |
| react-beautiful-dnd | 공식 유지보수 중단 |
| formik + yup | react-hook-form + zod 대비 성능/타입 안전성 열위 |
| DOMPurify | 서버 사이드 렌더링 환경에서 rehype-sanitize가 더 적합 |
| PostgreSQL RLS | Aurora Serverless v2 성능 고려, 앱 레벨 격리로 대체 |
