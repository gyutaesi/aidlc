# moaring — Application Design Plan

> **목적**: 컴포넌트 구조, 서비스 레이어, 의존성 설계
> **상태**: 답변 대기 중
>
> 각 `[Answer]:` 태그 뒤에 답변을 작성해주세요.
> 완료 후 "완료" 또는 "done"이라고 알려주세요.

---

## 실행 체크리스트

- [ ] 설계 질문 답변 수집
- [ ] components.md 생성
- [ ] component-methods.md 생성
- [ ] services.md 생성
- [ ] component-dependency.md 생성
- [ ] application-design.md (통합 문서) 생성

---

## A. 컴포넌트 구성 (Component Identification)

### Question 1
Next.js 풀스택 구조에서 프론트엔드와 백엔드 API를 어떻게 구분할까요?

A) Next.js App Router 기준 — `app/` 하위에 페이지/컴포넌트, `app/api/` 하위에 API Route Handler로 명확히 분리  
B) Server Actions 위주 — API Route 최소화, 대부분의 데이터 처리를 Server Action으로 처리  
C) A + B 혼합 — 외부(Extension/Lambda)에서 호출하는 API는 Route Handler, 웹앱 내부 데이터는 Server Action  
X) Other (please describe after [Answer]: tag below)

[Answer]: C

> **💡 추천: C) 혼합 방식**
> moaring은 웹앱 외에 Chrome Extension이 동일한 백엔드를 호출합니다. Extension에서 북마크 저장 등은 반드시 HTTP API Route Handler가 필요합니다. 반면 웹앱 내부의 인박스 조회, 그룹 목록 등은 Server Action으로 처리하면 네트워크 왕복 없이 서버에서 직접 DB를 조회할 수 있어 성능이 좋습니다. 두 방식을 목적에 맞게 혼합하는 것이 가장 실용적입니다.

### Question 2
비즈니스 로직(북마크 저장, 컬렉션 관리 등)을 어디에 위치시킬까요?

A) API Route Handler / Server Action 안에 직접 작성 (단순 구조)  
B) 별도 Service 클래스/함수로 분리 (`lib/services/`) — Route Handler는 얇게 유지  
C) Repository 패턴 추가 (`lib/repositories/`) — Service → Repository → DB 3계층  
X) Other (please describe after [Answer]: tag below)

[Answer]: B

> **💡 추천: B) Service 분리**
> Route Handler/Server Action에 로직을 직접 쓰면(A) 웹앱과 Extension이 같은 로직을 중복 구현하게 됩니다. `BookmarkService.create()` 같은 Service 함수를 만들면 Route Handler와 Server Action 양쪽에서 재사용할 수 있습니다. C의 Repository 패턴은 Prisma가 이미 DB 추상화를 제공하므로 moaring 규모에서는 과도한 복잡도입니다. B가 유지보수성과 단순함의 균형이 가장 좋습니다.

### Question 3
공유 페이지(`/c/{slug}`)는 어떻게 렌더링할까요?

A) SSR (Server-Side Rendering) — 매 요청마다 서버에서 렌더링, 항상 최신 데이터  
B) ISR (Incremental Static Regeneration) — 일정 시간마다 재생성, CDN 캐싱 활용  
C) SSG (Static Site Generation) — 빌드 시 생성, 변경 시 재배포 필요  
X) Other (please describe after [Answer]: tag below)

[Answer]: A

> **💡 추천: A) SSR**
> 공유 페이지는 조회수, 좋아요 수, 블록 내용이 수시로 바뀝니다. ISR(B)은 revalidate 주기 동안 오래된 데이터를 보여줄 수 있고, SSG(C)는 컬렉션이 수정될 때마다 재배포가 필요합니다. SSR은 항상 최신 데이터를 보여주고, CloudFront에서 짧은 TTL 캐싱(예: 10초)을 적용하면 성능도 충분히 확보할 수 있습니다. 공유 페이지의 신뢰성이 더 중요하므로 SSR이 적합합니다.

### Question 4
Chrome Extension의 API 통신 방식은?

A) 웹앱과 동일한 Next.js API Route 사용 (단일 엔드포인트)  
B) Extension 전용 API 엔드포인트 분리 (`/api/extension/`)  
C) A와 동일한 API를 사용하되 Extension 전용 헤더로 구분  
X) Other (please describe after [Answer]: tag below)

[Answer]: A

> **💡 추천: A) 동일한 API Route 사용**
> Extension이 하는 일(북마크 저장, 그룹 조회, 최근 저장 목록)은 웹앱과 완전히 동일한 비즈니스 로직입니다. 별도 엔드포인트(B)를 만들면 같은 로직을 두 곳에서 관리해야 합니다. Cognito JWT 토큰으로 인증하므로 Extension도 동일한 API를 그대로 호출하면 됩니다. 단, CORS 설정에서 Extension origin(`chrome-extension://`)을 허용해야 합니다.

---

## B. 컴포넌트 메서드 (Component Methods)

### Question 5
북마크 메타데이터 fetch(OG 태그 파싱)는 어디서 처리할까요?

A) API Route Handler 내 인라인 처리  
B) 별도 `MetadataService` — URL fetch, OG 파싱, 썸네일 처리 담당  
C) 별도 `MetadataService` + 큐(SQS) 비동기 처리 — 저장은 즉시, fetch는 백그라운드  
X) Other (please describe after [Answer]: tag below)

[Answer]: B

> **💡 추천: B) MetadataService 분리**
> OG 태그 fetch는 외부 URL에 HTTP 요청을 보내는 작업으로, 응답 시간이 불규칙합니다(빠르면 100ms, 느리면 수 초). 이 로직을 `MetadataService`로 분리하면 웹앱 저장과 Extension 저장 양쪽에서 재사용할 수 있습니다. C의 SQS 비동기 처리는 사용자가 저장 직후 제목/썸네일이 없는 상태를 보게 되어 UX가 나빠집니다. B처럼 동기 처리하되 타임아웃(예: 5초)을 설정하고 실패 시 수동 입력으로 fallback하는 것이 적합합니다.

### Question 7
컬렉션 조회수/클릭수 집계는 어떻게 처리할까요?

A) 매 요청마다 DB에 직접 UPDATE (단순, 동시성 이슈 가능)  
B) DB atomic increment (`UPDATE ... SET view_count = view_count + 1`)  
C) 별도 집계 서비스 — 이벤트 수집 후 배치로 집계  
X) Other (please describe after [Answer]: tag below)

[Answer]: B

> **💡 추천: B) DB atomic increment**
> A처럼 read-modify-write 방식은 동시 요청 시 카운트가 누락될 수 있습니다. B의 `UPDATE ... SET view_count = view_count + 1`은 PostgreSQL이 원자적으로 처리하므로 동시성 문제가 없습니다. C의 배치 집계는 Redis나 별도 이벤트 스토어가 필요해 MVP 인프라가 복잡해집니다. MVP 규모(1~10명)에서는 B로 충분하고, 트래픽이 늘면 C로 전환할 수 있습니다.

---

## C. 서비스 레이어 (Service Layer Design)

### Question 8
인증(Cognito JWT 검증)을 어떻게 처리할까요?

A) 각 API Route Handler에서 직접 토큰 검증  
B) Next.js Middleware (`middleware.ts`) — 보호된 경로에 대해 일괄 검증  
C) B + 별도 `AuthService` — Middleware는 라우팅, AuthService는 토큰 파싱/사용자 조회  
X) Other (please describe after [Answer]: tag below)

[Answer]: C

> **💡 추천: C) Middleware + AuthService**
> A처럼 각 Route Handler에서 검증하면 인증 코드가 중복되고 누락될 위험이 있습니다. B의 Middleware만으로는 토큰에서 사용자 ID를 추출해 Service 레이어에 전달하는 부분이 불명확합니다. C처럼 Middleware가 보호 경로를 일괄 차단하고, `AuthService.getUserFromToken()`이 토큰을 파싱해 DB의 User 레코드를 조회하면 모든 Service에서 `currentUser`를 일관되게 사용할 수 있습니다. Cognito의 JWKS 공개키 캐싱도 AuthService에서 관리하면 됩니다.

### Question 9
DB 접근 라이브러리는 무엇을 사용할까요?

A) Prisma ORM — 타입 안전, 마이그레이션 관리, Aurora PostgreSQL 지원  
B) Drizzle ORM — 경량, SQL-like 문법, TypeScript 친화적  
C) Kysely — 타입 안전 쿼리 빌더, SQL에 가까운 제어  
D) node-postgres (pg) — 순수 SQL, 최대 제어권  
X) Other (please describe after [Answer]: tag below)

[Answer]: A

> **💡 추천: A) Prisma**
> moaring은 Bookmark, Group, Collection, Tag 등 관계가 복잡한 스키마를 가집니다. Prisma는 스키마 파일 하나로 타입 생성 + 마이그레이션 + 쿼리를 모두 관리할 수 있어 개발 속도가 빠릅니다. Aurora PostgreSQL Serverless v2와 연결 풀링(PgBouncer 또는 Prisma Accelerate)도 잘 지원됩니다. Drizzle(B)은 더 가볍지만 생태계와 문서가 Prisma보다 작습니다. tsvector 풀텍스트 검색 같은 PostgreSQL 특화 기능은 Prisma의 `$queryRaw`로 처리하면 됩니다.

### Question 10
파일 업로드(이미지 블록, 썸네일)의 S3 Pre-signed URL 생성은 어디서 담당할까요?

A) 각 API Route에서 직접 AWS SDK 호출  
B) 별도 `StorageService` — Pre-signed URL 생성, S3 경로 관리, CloudFront URL 변환 담당  
X) Other (please describe after [Answer]: tag below)

[Answer]: B

> **💡 추천: B) StorageService 분리**
> S3 Pre-signed URL 생성에는 버킷명, 리전, 경로 규칙(`users/{userId}/collections/{collectionId}/...`), 만료 시간 등 여러 설정이 필요합니다. 이를 각 Route에 흩어놓으면 경로 규칙이 일관되지 않을 수 있습니다. `StorageService`로 분리하면 S3 경로 생성 규칙, CloudFront URL 변환(`s3://` → `https://cdn.moaring.com/...`), Pre-signed URL 만료 시간 등을 한 곳에서 관리할 수 있습니다.

---

## D. 컴포넌트 의존성 (Component Dependencies)

### Question 11
검색 기능의 위치는?

A) `BookmarkService` 내 메서드로 포함 (검색도 북마크 도메인)  
B) 별도 `SearchService` — tsvector 쿼리, 검색 인덱스 관리 담당  
X) Other (please describe after [Answer]: tag below)

[Answer]: X (Frontend에서 검색 모두 처리)

> **💡 추천: B) SearchService 분리**
> moaring의 검색은 북마크뿐 아니라 컬렉션 블록 텍스트까지 포함합니다. 즉, 여러 테이블을 가로지르는 쿼리입니다. `BookmarkService`에 넣으면 컬렉션 데이터까지 다루게 되어 단일 책임 원칙이 깨집니다. `SearchService`로 분리하면 tsvector 인덱스 관리, 검색 결과 랭킹, 향후 검색 엔진 교체(OpenSearch 등) 시 변경 범위를 최소화할 수 있습니다.

### Question 12
태그 관리는 어떻게 할까요?

A) `BookmarkService` 내에서 태그 CRUD 처리  
B) 별도 `TagService` — 태그 생성/조회/자동완성 담당  
X) Other (please describe after [Answer]: tag below)

[Answer]: B

> **💡 추천: B) TagService 분리**
> 태그는 북마크 저장 시 생성되지만, 자동완성(사용자가 입력 중인 태그 목록 조회), 태그별 북마크 필터링 등 독립적인 기능이 있습니다. `TagService`로 분리하면 `BookmarkService`가 태그 로직에 의존하지 않고, 태그 자동완성 API를 별도로 깔끔하게 제공할 수 있습니다.

---

## E. 설계 패턴 (Design Patterns)

### Question 13
에러 처리 패턴은?

A) 각 함수에서 try/catch로 직접 처리  
B) 공통 에러 클래스 정의 (`AppError`, `NotFoundError` 등) + 중앙 에러 핸들러  
C) Result 패턴 (`{ data, error }` 반환) — 예외 없이 에러를 값으로 처리  
X) Other (please describe after [Answer]: tag below)

[Answer]: B

> **💡 추천: B) 공통 에러 클래스 + 중앙 핸들러**
> A처럼 각 함수에서 try/catch를 반복하면 에러 응답 형식이 일관되지 않습니다. B처럼 `NotFoundError`, `UnauthorizedError`, `ValidationError` 등을 정의하고 Route Handler 레벨에서 일괄 처리하면 API 응답 형식이 통일됩니다. C의 Result 패턴은 TypeScript에서 강력하지만 기존 async/await 패턴과 혼용 시 코드가 복잡해집니다. B가 Next.js 생태계에서 가장 자연스럽습니다.

### Question 14
환경별 설정 관리는?

A) `.env` 파일만 사용 (로컬/배포 환경 분리)  
B) `.env` + AWS Parameter Store — 민감 정보는 Parameter Store, 일반 설정은 `.env`  
C) AWS Parameter Store 전용 — 모든 설정을 Parameter Store에서 로드  
X) Other (please describe after [Answer]: tag below)

[Answer]: B

> **💡 추천: B) .env + Parameter Store 혼합**
> Cognito Client Secret, DB 연결 문자열, S3 버킷명 같은 민감 정보는 Parameter Store(SecureString)에 저장하고 ECS Task Definition에서 환경변수로 주입합니다. 로컬 개발에서는 `.env.local`을 사용하면 됩니다. C처럼 모든 설정을 Parameter Store에서 로드하면 로컬 개발 시 AWS 자격증명이 항상 필요해 불편합니다. B가 보안과 개발 편의성의 균형이 좋습니다.
