# Unit 2 (Application) — NFR Requirements 질문

> **목적**: 기술 스택 선택 및 비기능 요구사항 구체화  
> **작성일**: 2026-05-20  
> **답변 방법**: 각 `[Answer]:` 태그 뒤에 답변을 작성해 주세요

---

> ### 📌 추천 답변 안내
> 각 질문 아래에 **추천 답변**과 **사유**를 함께 표기했습니다.  
> 동의하시면 그대로 두시고, 다른 선택을 원하시면 `[Answer]:` 뒤를 수정해 주세요.

---

## 섹션 1: 성능 요구사항

**Q1. 페이지네이션 방식 — 인박스/그룹**  
북마크 목록 조회 시 어떤 페이지네이션 방식을 사용하나요?

A) Offset 기반 (`LIMIT n OFFSET m`) — 구현 단순, 대용량 시 성능 저하  
B) Cursor 기반 (`WHERE created_at < cursor`) — 대용량에 유리, 구현 복잡  
C) 무한 스크롤 + Cursor 기반 (UX + 성능 모두 고려)

> **추천: A**  
> MVP 규모(개인/팀 1~10명, NFR-03-1)에서 북마크 수가 수천 개를 넘기 어렵습니다. Offset 방식으로 충분하고, 구현이 단순합니다. 사용자가 많아지면 Cursor 방식으로 마이그레이션할 수 있습니다. 무한 스크롤(C)은 UX는 좋지만 "특정 페이지로 이동" 기능이 없어 인박스 관리에 불편할 수 있습니다.

[Answer]: A

---

**Q2. OG 메타데이터 fetch — 캐싱 전략**  
동일 URL을 여러 번 저장할 때 OG 메타데이터를 매번 fetch하나요?

A) 매번 fetch (항상 최신 메타데이터, 구현 단순)  
B) URL 기준으로 DB에 캐싱 (동일 URL 재저장 시 캐시 사용, 24시간 TTL)  
C) 캐싱 없음 — Import 시에는 fetch 안 하고 크롬 북마크 텍스트만 사용 (현재 설계대로)

> **추천: A**  
> MVP 규모에서 동일 URL 중복 저장은 드물고, 메타데이터 fetch는 5초 타임아웃으로 이미 제한되어 있습니다. 캐싱 레이어를 추가하면 복잡도가 올라갑니다. Import 시에는 이미 fetch를 생략하도록 설계되어 있으므로 성능 문제가 없습니다.

[Answer]: A

---

**Q3. 검색 성능 — tsvector 업데이트 방식**  
북마크/컬렉션 데이터 변경 시 tsvector 인덱스를 어떻게 관리하나요?

A) 쿼리 시점에 `to_tsvector()` 실시간 계산 (인덱스 없음, 소규모에서 충분)  
B) Generated Column으로 tsvector 자동 관리 (INSERT/UPDATE 시 자동 갱신, GIN 인덱스)  
C) 별도 search_vector 컬럼 + 트리거로 관리

> **추천: B**  
> 요구사항(NFR-01-1)에 "검색 응답 시간 < 300ms"가 명시되어 있습니다. Generated Column + GIN 인덱스가 가장 표준적이고 Prisma와도 잘 맞습니다. A는 데이터가 늘어나면 300ms 기준을 맞추기 어렵습니다. C는 트리거 관리가 복잡합니다.

[Answer]: B

---

## 섹션 2: 기술 스택 선택

**Q4. Next.js 버전 및 주요 라이브러리 확정**  
아래 기술 스택 조합을 사용하시나요?

```
Next.js 15 (App Router)
TypeScript 5.x
Prisma 5.x (ORM)
TailwindCSS 3.x
```

A) 위 조합 그대로 사용  
B) 일부 변경 있음 (아래 [Answer]에 변경 사항 기재)

> **추천: A**  
> 요구사항에 명시된 스택이고, 모두 현재 안정 버전입니다. Next.js 15는 App Router가 성숙했고, Prisma 5는 Aurora PostgreSQL과 잘 호환됩니다.

[Answer]: A

---

**Q5. UI 컴포넌트 라이브러리**  
TailwindCSS 외에 UI 컴포넌트 라이브러리를 사용하나요?

A) shadcn/ui (Radix UI 기반, headless, TailwindCSS와 완벽 호환, 커스터마이징 용이)  
B) Radix UI 직접 사용 (shadcn 없이)  
C) 라이브러리 없이 직접 구현 (완전 커스텀)  
D) MUI / Chakra UI 등 다른 라이브러리

> **추천: A**  
> shadcn/ui는 컴포넌트 코드를 프로젝트에 직접 복사하는 방식이라 번들 크기 최적화가 쉽고, TailwindCSS와 완벽하게 통합됩니다. Dropdown, Modal, Toast 등 필요한 컴포넌트가 모두 있고, 접근성(ARIA)도 Radix UI 기반으로 잘 처리됩니다. MVP에서 가장 빠르게 품질 있는 UI를 만들 수 있습니다.

[Answer]: A

---

**Q6. 드래그앤드롭 라이브러리**  
블록 순서 변경 및 그룹 내 북마크 순서 변경에 사용할 라이브러리는?

A) `@dnd-kit/core` + `@dnd-kit/sortable` (현재 설계대로, 가볍고 접근성 우수)  
B) `react-beautiful-dnd` (Atlassian, 직관적이지만 유지보수 중단)  
C) `@hello-pangea/dnd` (react-beautiful-dnd 포크, 유지보수 활성)

> **추천: A**  
> dnd-kit은 현재 가장 활발히 유지보수되는 React DnD 라이브러리입니다. 터치 지원, 접근성, 성능 모두 우수하고 Next.js App Router와 호환성이 좋습니다. react-beautiful-dnd(B)는 공식 유지보수가 중단되었습니다.

[Answer]: A

---

**Q7. 마크다운 렌더링 라이브러리**  
텍스트 블록의 마크다운 렌더링에 사용할 라이브러리는?

A) `react-markdown` + `rehype-sanitize` (현재 설계대로)  
B) `@uiw/react-md-editor` (편집 + 미리보기 통합)  
C) `tiptap` (리치 텍스트 에디터, 마크다운 지원)

> **추천: A**  
> 텍스트 블록은 마크다운 입력 + 렌더링이 목적이고, 복잡한 리치 텍스트 에디터는 MVP에서 과도합니다. react-markdown은 가볍고 rehype-sanitize로 XSS를 안전하게 처리합니다. 편집은 `<textarea>`로 충분합니다.

[Answer]: A

---

**Q8. 폼 유효성 검사 라이브러리**  
클라이언트 폼 유효성 검사에 사용할 라이브러리는?

A) `react-hook-form` + `zod` (성능 우수, 타입 안전, Server Action과 호환)  
B) `formik` + `yup`  
C) 직접 구현 (useState + 커스텀 검증)

> **추천: A**  
> react-hook-form은 불필요한 리렌더링을 최소화하고, zod는 TypeScript 타입과 런타임 검증을 동시에 처리합니다. Next.js Server Action과 함께 사용할 때 `zod` 스키마를 서버/클라이언트 양쪽에서 재사용할 수 있어 코드 중복이 줄어듭니다.

[Answer]: A

---

**Q9. 서버 상태 관리 (API Route 호출용)**  
API Route를 호출하는 클라이언트 컴포넌트(검색, 태그 자동완성 등)에서 서버 상태를 어떻게 관리하나요?

A) `SWR` (Vercel 제작, 가볍고 Next.js와 궁합 좋음)  
B) `TanStack Query (React Query)` (기능 풍부, 캐싱/동기화 강력)  
C) 직접 `fetch` + `useState` (단순하지만 캐싱 없음)

> **추천: A**  
> 검색 모달, 태그 자동완성 등 실시간 API 호출이 필요한 곳에 SWR이 적합합니다. Next.js와 같은 Vercel 생태계이고, 번들 크기가 작습니다. 대부분의 데이터 변경은 Server Action + `revalidatePath()`로 처리하므로 TanStack Query(B)의 복잡한 mutation 기능은 불필요합니다.

[Answer]: A

---

## 섹션 3: 보안 요구사항

**Q10. CSRF 방어 전략**  
HttpOnly Cookie 방식에서 CSRF 공격을 어떻게 방어하나요?

A) `SameSite=Lax` Cookie 설정만으로 충분 (대부분의 CSRF 방어)  
B) `SameSite=Strict` (더 강력하지만 외부 링크에서 접근 시 로그인 풀림)  
C) CSRF 토큰 추가 (Double Submit Cookie 패턴)

> **추천: A**  
> `SameSite=Lax`는 GET 요청은 허용하고 POST/PUT/DELETE는 same-site에서만 허용합니다. 현대 브라우저에서 대부분의 CSRF를 방어하며, 외부 링크에서 접근해도 로그인 상태가 유지됩니다. MVP 규모에서 CSRF 토큰(C)은 과도합니다.

[Answer]: A

---

**Q11. Rate Limiting**  
API 엔드포인트에 Rate Limiting을 적용하나요?

A) MVP에서는 미적용 (소규모, 개인/팀 사용)  
B) Next.js Middleware에서 IP 기반 간단한 Rate Limiting 적용  
C) AWS WAF 또는 ALB 레벨에서 적용 (Unit 1 인프라 필요)

> **추천: A**  
> MVP 목표 사용자가 개인/팀 1~10명(NFR-03-1)이므로 Rate Limiting은 과도합니다. 악용 가능성이 있는 엔드포인트(OG fetch, 검색)는 이미 타임아웃과 결과 제한으로 보호됩니다. 필요 시 Post-MVP에서 AWS WAF로 추가할 수 있습니다.

[Answer]: A

---

## 섹션 4: 가용성 및 운영

**Q12. 로컬 개발 환경 — Docker Compose 구성**  
로컬 개발 시 Docker Compose로 무엇을 실행하나요?

A) PostgreSQL만 (Next.js는 로컬에서 직접 실행)  
B) PostgreSQL + Redis (캐싱/세션 필요 시)  
C) PostgreSQL + LocalStack (AWS 서비스 로컬 에뮬레이션)

> **추천: A**  
> 현재 설계에서 Redis나 LocalStack이 필요한 기능이 없습니다. Cognito는 실제 AWS를 사용하고(로컬 에뮬레이션 복잡), S3 Pre-signed URL도 실제 AWS를 사용합니다. PostgreSQL만 로컬에서 실행하고 나머지는 실제 AWS 서비스를 개발 환경에서 사용하는 것이 가장 단순합니다.

[Answer]: A

---

**Q13. 에러 모니터링 및 로깅**  
프로덕션 에러 모니터링을 어떻게 하나요?

A) MVP에서는 CloudWatch 로그만 사용 (ECS 기본 제공)  
B) Sentry 추가 (에러 트래킹, 스택 트레이스, 알림)  
C) 직접 구현 (DB에 에러 로그 저장)

> **추천: A**  
> MVP 규모에서 CloudWatch 로그로 충분합니다. Sentry(B)는 유용하지만 추가 설정과 비용이 발생합니다. 필요 시 Post-MVP에서 추가할 수 있습니다.

[Answer]: A

---

**Q14. 환경 변수 관리 — 로컬 개발**  
로컬 개발 시 환경 변수를 어떻게 관리하나요?

A) `.env.local` 파일 (Next.js 기본, `.gitignore`에 포함)  
B) `.env.local` + AWS Parameter Store에서 개발용 값 pull하는 스크립트  
C) direnv 또는 dotenv-vault

> **추천: A**  
> `.env.local`이 Next.js 표준이고 가장 단순합니다. 팀 규모가 작으므로 환경 변수 공유는 안전한 채널(1Password, Notion 비공개 페이지 등)로 충분합니다.

[Answer]: A

---

## 섹션 5: 유지보수성

**Q15. TypeScript strict 모드**  
TypeScript 설정에서 strict 모드를 사용하나요?

A) `strict: true` (모든 strict 옵션 활성화 — 권장)  
B) 일부만 활성화 (`strictNullChecks: true` 등)  
C) strict 없이 사용

> **추천: A**  
> TypeScript strict 모드는 런타임 에러를 컴파일 타임에 잡아주고, 코드 품질을 높입니다. Next.js 15 기본 템플릿도 `strict: true`를 사용합니다. 초기부터 적용하는 것이 나중에 추가하는 것보다 훨씬 쉽습니다.

[Answer]: A

---

**Q16. 코드 품질 도구**  
아래 도구들을 사용하나요?

```
ESLint (Next.js 기본 포함)
Prettier (코드 포맷팅)
Husky + lint-staged (커밋 전 자동 검사)
```

A) 위 조합 모두 사용  
B) ESLint + Prettier만 (Husky 없이)  
C) ESLint만

> **추천: B**  
> ESLint + Prettier는 Next.js 프로젝트 표준입니다. Husky + lint-staged(A)는 커밋 속도를 느리게 하고, 혼자 또는 소규모 팀에서는 오히려 불편할 수 있습니다. 필요 시 나중에 추가하면 됩니다.

[Answer]: A

---

**Q17. 테스트 전략**  
어떤 수준의 테스트를 작성하나요?

A) 테스트 없음 (MVP, 빠른 개발 우선)  
B) 핵심 Service 로직만 단위 테스트 (Jest)  
C) 단위 테스트 + E2E 테스트 (Playwright)

> **추천: B**  
> 완전히 테스트를 생략하면(A) 리팩토링이 어렵고 버그 발견이 늦어집니다. 핵심 비즈니스 로직(BookmarkService, CollectionService, SearchService 등)만 단위 테스트를 작성하면 적절한 안전망이 됩니다. E2E(C)는 MVP에서 설정 비용 대비 효과가 낮습니다.

[Answer]: B

---

## 섹션 6: 접근성 및 국제화

**Q18. 접근성 (a11y) 수준**  
접근성 지원 수준은?

A) 기본 수준 — 시맨틱 HTML, alt 텍스트, 키보드 네비게이션 (Cmd+K 등)  
B) WCAG 2.1 AA 준수 (스크린 리더 완전 지원, 색상 대비 등)  
C) 접근성 고려 없음

> **추천: A**  
> shadcn/ui(Radix UI 기반)가 기본적인 ARIA 속성을 처리해줍니다. 시맨틱 HTML과 키보드 네비게이션은 자연스럽게 구현됩니다. WCAG 2.1 AA(B)는 전문적인 접근성 감사가 필요하고 MVP에서 과도합니다.

[Answer]: C

---

**Q19. i18n 구조 준비**  
요구사항(NFR-05-2)에 "i18n 구조 준비, 영어 번역은 Post-MVP"가 있습니다.  
MVP에서 어느 수준으로 준비하나요?

A) `next-intl` 설치 + 한국어 메시지 파일 구조만 잡기 (실제 번역 없음)  
B) 하드코딩된 한국어 문자열 사용 (i18n 구조 없음, Post-MVP에서 리팩토링)  
C) `next-intl` 완전 적용 (한국어 + 영어 번역 파일 모두 작성)

> **추천: B**  
> MVP에서 i18n 구조를 미리 잡으면(A) 모든 문자열을 메시지 파일로 분리해야 해서 개발 속도가 느려집니다. 하드코딩으로 빠르게 개발하고, Post-MVP에서 next-intl을 도입하면서 리팩토링하는 것이 현실적입니다. 어차피 영어 번역은 Post-MVP이므로 지금 구조를 잡아도 실질적 이득이 없습니다.

[Answer]: C

---
