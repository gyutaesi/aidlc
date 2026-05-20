# Unit 2 (Application) — NFR Requirements

> **작성일**: 2026-05-20  
> **단계**: Construction Phase — NFR Requirements

---

## 1. 성능 요구사항 (Performance)

### NFR-PERF-01: 검색 응답 시간

- **목표**: < 300ms (요구사항 NFR-01-1)
- **구현 방법**: PostgreSQL Generated Column + GIN 인덱스 (Q3: B)
  - `Bookmark` 테이블: `search_vector` generated column (`to_tsvector('simple', title || url || memo)`)
  - `Collection` 테이블: `search_vector` generated column + `blocks_text` generated column (JSONB 텍스트 추출)
  - 두 컬럼 모두 GIN 인덱스 적용
- **측정 기준**: `EXPLAIN ANALYZE` 기준 index scan 확인

### NFR-PERF-02: 공유 페이지 초기 로딩

- **목표**: < 1.5s (요구사항 NFR-01-2)
- **구현 방법**: Next.js SSR + CloudFront CDN
  - `/c/[slug]` 페이지: Server Component로 SSR
  - 이미지: CloudFront CDN 경유 (Next.js Image 컴포넌트)
  - 슬러그 인덱스: `UNIQUE INDEX idx_collection_slug` 로 빠른 조회

### NFR-PERF-03: 이미지 업로드

- **목표**: 서버 부하 최소화 (요구사항 NFR-01-3)
- **구현 방법**: S3 Pre-signed URL 직접 업로드
  - 서버는 Pre-signed URL 발급만 담당 (파일 데이터 미경유)
  - Pre-signed URL 유효시간: 5분

### NFR-PERF-04: 페이지네이션

- **방식**: Offset 기반 (`LIMIT n OFFSET m`) (Q1: A)
- **기본 페이지 크기**: 20개
- **적용 대상**: 인박스 목록, 검색 결과 (최대 20개)
- **근거**: MVP 규모(개인/팀 1~10명)에서 충분, 구현 단순

### NFR-PERF-05: OG 메타데이터 fetch

- **방식**: 매번 fetch, 캐싱 없음 (Q2: A)
- **타임아웃**: 5초
- **실패 처리**: null 반환 → 클라이언트 토스트 메시지 + 수동 입력
- **Import 시**: fetch 생략, 크롬 북마크 텍스트를 title로 사용

---

## 2. 보안 요구사항 (Security)

### NFR-SEC-01: 인증 토큰 보안

- **저장 위치**: HttpOnly Cookie (Q7 Functional Design)
- **Cookie 속성**: `HttpOnly`, `Secure`, `SameSite=Lax`
- **Access Token 만료**: 1시간 (Cognito 기본)
- **Refresh Token 만료**: 30일

### NFR-SEC-02: CSRF 방어

- **방식**: `SameSite=Lax` Cookie 설정 (Q10: A)
- **근거**: 현대 브라우저에서 대부분의 CSRF 방어, 외부 링크 접근 시 로그인 유지
- **추가 조치 없음**: CSRF 토큰 불필요 (MVP 규모)

### NFR-SEC-03: Rate Limiting

- **MVP**: 미적용 (Q11: A)
- **보호 장치**: OG fetch 5초 타임아웃, 검색 결과 20개 제한
- **Post-MVP**: AWS WAF 레벨에서 추가 예정

### NFR-SEC-04: 데이터 격리

- 모든 DB 쿼리에 `WHERE user_id = {userId}` 강제 적용 (요구사항 NFR-02-1)
- PostgreSQL RLS 미사용 (Aurora Serverless v2 성능 고려)
- 애플리케이션 레벨에서 완전 격리

### NFR-SEC-05: XSS 방어

- 마크다운 렌더링: `rehype-sanitize`로 sanitize
- URL 렌더링: `javascript:` 프로토콜 차단
- 허용 HTML 태그 화이트리스트 적용

### NFR-SEC-06: SQL Injection 방어

- Prisma ORM Parameterized Query 사용 (요구사항 NFR-02-6)
- `$queryRaw` 사용 시 `Prisma.sql` 태그드 템플릿으로 파라미터 바인딩

### NFR-SEC-07: S3 보안

- S3 버킷 퍼블릭 직접 접근 차단 (요구사항 NFR-02-5)
- CloudFront OAC(Origin Access Control) 사용
- 업로드: Pre-signed URL (5분 유효)

---

## 3. 가용성 요구사항 (Availability)

### NFR-AVAIL-01: 목표 가용성

- **MVP 목표**: 개인/팀 1~10명 자체 호스팅 수준 (요구사항 NFR-03-1)
- **공식 SLA 없음**: MVP에서 고가용성 아키텍처 불필요

### NFR-AVAIL-02: 스케일링

- **DB**: Aurora Serverless v2 자동 스케일링 (요구사항 NFR-03-2)
- **앱**: ECS/Fargate 태스크 수 조정으로 수평 확장 (요구사항 NFR-03-3)

### NFR-AVAIL-03: 에러 모니터링

- **MVP**: CloudWatch 로그만 사용 (Q13: A, ECS 기본 제공)
- **로그 레벨**: ERROR, WARN 레벨 구조화 로그 (JSON 형식)
- **Post-MVP**: Sentry 추가 예정

### NFR-AVAIL-04: 로컬 개발 환경

- **Docker Compose**: PostgreSQL만 실행 (Q12: A)
- **AWS 서비스**: 실제 AWS 개발 계정 사용 (Cognito, S3)
- **환경 변수**: `.env.local` 파일 (Q14: A)

---

## 4. 유지보수성 요구사항 (Maintainability)

### NFR-MAINT-01: TypeScript 설정

- **strict 모드**: `strict: true` (Q15: A)
- **모든 파일**: TypeScript 적용 (프론트엔드 + 백엔드)
- **tsconfig.json**: Next.js 15 기본 설정 기반

### NFR-MAINT-02: 코드 품질 도구

- **ESLint**: Next.js 기본 설정 (`eslint-config-next`)
- **Prettier**: 코드 포맷팅 통일
- **Husky + lint-staged**: 커밋 전 자동 검사 (Q16: A)
  - pre-commit: `eslint --fix` + `prettier --write`
  - 커밋 차단 조건: ESLint 에러 (warning은 통과)

### NFR-MAINT-03: 테스트 전략

- **범위**: 핵심 Service 로직 단위 테스트 (Q17: B)
- **프레임워크**: Jest + ts-jest
- **테스트 대상**:
  - `BookmarkService` (create, delete, importFromHtml, getInbox)
  - `CollectionService` (create, addBlock, reorderBlocks, togglePublic, updateSlug)
  - `SearchService` (search — 쿼리 생성 로직)
  - `TagService` (getOrCreate, autocomplete)
  - `AuthService` (getUserFromToken)
- **제외**: UI 컴포넌트, API Route Handler (통합 테스트 영역)
- **커버리지 목표**: 핵심 Service 70% 이상

### NFR-MAINT-04: 환경 변수 관리

- **로컬**: `.env.local` (`.gitignore` 포함)
- **프로덕션**: AWS Parameter Store → ECS Task Definition 환경 변수로 주입
- **필수 환경 변수 목록**:
  ```
  DATABASE_URL                    # Aurora PostgreSQL 연결 문자열
  COGNITO_USER_POOL_ID            # Cognito User Pool ID
  COGNITO_CLIENT_ID               # Cognito App Client ID
  COGNITO_REGION                  # AWS 리전 (us-east-1)
  AWS_S3_BUCKET_NAME              # S3 버킷명
  AWS_CLOUDFRONT_DOMAIN           # CloudFront 도메인
  AWS_REGION                      # AWS 리전
  NEXT_PUBLIC_APP_URL             # 앱 공개 URL (슬러그 공유 링크 생성용)
  ```

---

## 5. 국제화 요구사항 (i18n)

### NFR-I18N-01: MVP 적용 범위

- **방식**: `next-intl` 완전 적용 (Q19: C)
- **MVP**: 한국어 + 영어 번역 파일 모두 작성
- **라이브러리**: `next-intl` (Next.js App Router 공식 지원)

### NFR-I18N-02: 메시지 파일 구조

```
messages/
├── ko.json    # 한국어 (기본)
└── en.json    # 영어
```

### NFR-I18N-03: 적용 범위

- UI 텍스트 전체 (버튼, 레이블, 에러 메시지, 토스트 등)
- URL 구조: `/ko/...`, `/en/...` 또는 Accept-Language 헤더 기반
- 날짜/시간 포맷: `next-intl` 내장 포맷터 사용

---

## 6. 접근성 요구사항 (Accessibility)

### NFR-A11Y-01: 접근성 수준

- **MVP**: 접근성 고려 없음 (Q18: C)
- **Post-MVP**: 필요 시 WCAG 2.1 AA 준수 검토
- **참고**: shadcn/ui(Radix UI 기반)가 기본 ARIA 속성을 자동 처리하므로 최소한의 접근성은 자연스럽게 확보됨

---

## 7. 요구사항 추적 매트릭스

| 원본 NFR                                | 구현 방법                     | 상태           |
| --------------------------------------- | ----------------------------- | -------------- |
| NFR-01-1 검색 < 300ms                   | Generated Column + GIN 인덱스 | ✅ 설계 완료   |
| NFR-01-2 공유 페이지 < 1.5s             | SSR + CloudFront CDN          | ✅ 설계 완료   |
| NFR-01-3 이미지 업로드 서버 부하 최소화 | S3 Pre-signed URL             | ✅ 설계 완료   |
| NFR-02-1 데이터 격리                    | 앱 레벨 user_id 필터          | ✅ 설계 완료   |
| NFR-02-2 HTTPS 전용                     | CloudFront + ALB SSL (Unit 1) | ✅ Unit 1 담당 |
| NFR-02-3 JWT 인증                       | Cognito + HttpOnly Cookie     | ✅ 설계 완료   |
| NFR-02-4 Refresh Token 자동 갱신        | Middleware 자동 갱신          | ✅ 설계 완료   |
| NFR-02-5 S3 퍼블릭 차단                 | CloudFront OAC (Unit 1)       | ✅ Unit 1 담당 |
| NFR-02-6 SQL Injection 방어             | Prisma ORM                    | ✅ 설계 완료   |
| NFR-02-7 XSS 방어                       | rehype-sanitize               | ✅ 설계 완료   |
| NFR-03-1 MVP 규모                       | 개인/팀 1~10명                | ✅ 확인        |
| NFR-03-2 DB 스케일링                    | Aurora Serverless v2 (Unit 1) | ✅ Unit 1 담당 |
| NFR-03-3 앱 스케일링                    | ECS/Fargate (Unit 1)          | ✅ Unit 1 담당 |
| NFR-04-1 TypeScript 전체 적용           | strict: true                  | ✅ 설계 완료   |
| NFR-04-2 환경변수 관리                  | .env.local + Parameter Store  | ✅ 설계 완료   |
| NFR-04-3 Docker 컨테이너 배포           | Dockerfile + ECS (Unit 1)     | ✅ Unit 1 담당 |
| NFR-05-1 한국어만 지원 (MVP)            | next-intl 한국어              | ✅ 설계 완료   |
| NFR-05-2 i18n 구조 준비                 | next-intl 완전 적용           | ✅ 설계 완료   |
| NFR-06-1 반응형 웹                      | TailwindCSS 반응형            | ✅ 설계 완료   |
| NFR-06-2 Cmd+K 단축키                   | SearchModal 키보드 이벤트     | ✅ 설계 완료   |
| NFR-06-3 드래그앤드롭                   | dnd-kit                       | ✅ 설계 완료   |
