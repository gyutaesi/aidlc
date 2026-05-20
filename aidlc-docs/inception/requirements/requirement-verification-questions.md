# 요구사항 명확화 질문 (Requirement Verification Questions)

> moaring 프로젝트의 요구사항을 명확히 하기 위한 질문입니다.
> 각 질문에 대해 `[Answer]:` 태그 뒤에 알파벳(A, B, C, ...) 으로 답변해주세요.
> 보기에 없는 답변은 `X) Other`를 선택하고 자유롭게 작성해주세요.
> 답변이 모두 끝나면 "완료" 또는 "done"이라고 알려주세요.

---

## A. 기술 스택 (Tech Stack)

### Question 1
프론트엔드(웹 앱) 기술 스택은 무엇을 선호하시나요?

A) Next.js (React, App Router) — SSR/SSG 지원, 공유 페이지 SEO에 유리  
B) React (Vite) + SPA — 단순한 SPA 구조  
C) SvelteKit — 가볍고 빠른 개발  
D) Nuxt (Vue) — Vue 생태계 선호  
X) Other (please describe after [Answer]: tag below)

[Answer]: A

> **💡 AWS 기준 추천: A) Next.js**
> 컬렉션 공유 페이지(`/c/{slug}`)는 외부 공개 URL이므로 SEO가 중요합니다. Next.js의 SSR/SSG를 활용하면 공유 페이지를 정적으로 생성하거나 서버 렌더링할 수 있어 검색 엔진 노출에 유리합니다. AWS에서는 Next.js를 ECS/Fargate 컨테이너로 배포하거나, AWS Amplify Hosting으로 간편하게 배포할 수 있습니다. CloudFront와 조합하면 전 세계 CDN 캐싱도 자연스럽게 연결됩니다.

### Question 2
백엔드 기술 스택은 무엇을 선호하시나요?

A) Node.js (NestJS) + TypeScript — 강타입, 구조화된 백엔드  
B) Node.js (Fastify/Express) + TypeScript — 가벼운 API 서버  
C) Next.js API Routes / Server Actions — 풀스택 단일 코드베이스  
D) Python (FastAPI) — 강타입 + 빠른 개발  
E) Go (Gin/Echo) — 고성능, 단순함  
X) Other (please describe after [Answer]: tag below)

[Answer]: C

> **💡 AWS 기준 추천: A) Node.js (NestJS) + TypeScript**
> Next.js API Routes(C)는 단일 코드베이스로 편리하지만, 링크 상태 체크 스케줄러, 메타데이터 fetch 워커, Chrome Extension API 등 백엔드 전용 로직이 많아지면 Next.js 안에서 관리하기 복잡해집니다. NestJS는 모듈 구조가 명확하고, AWS ECS/Fargate에 Docker 컨테이너로 배포하기 쉬우며, 스케줄러(cron), 큐(SQS) 연동, 인증 미들웨어 등을 체계적으로 구성할 수 있습니다. 프론트(Next.js) + 백엔드(NestJS)를 분리하면 각각 독립적으로 스케일링도 가능합니다.

### Question 3
데이터베이스는 무엇을 사용하시겠어요?

A) PostgreSQL — 관계형 + 풀텍스트 검색(GIN/tsvector) 지원  
B) MySQL — 익숙한 관계형 DB  
C) MongoDB — 문서형, 블록 구조에 유연  
D) SQLite — 로컬/소규모  
X) Other (please describe after [Answer]: tag below)

[Answer]: A

> **💡 AWS 기준 추천: A) PostgreSQL (Amazon RDS for PostgreSQL 또는 Aurora PostgreSQL)**
> AWS에서 PostgreSQL은 RDS 또는 Aurora Serverless v2로 관리형 서비스를 바로 사용할 수 있습니다. 컬렉션 블록 구조(링크/텍스트/이미지 블록)는 JSONB 컬럼으로 유연하게 저장하고, 검색은 tsvector + GIN 인덱스로 별도 검색 엔진 없이 처리 가능합니다. Aurora Serverless v2는 트래픽에 따라 자동 스케일링되어 MVP 초기 비용도 절감됩니다.

---

## B. 인프라 및 배포 (Infrastructure & Deployment)

### Question 4
배포 환경은 어디인가요?

A) AWS (ECS/Fargate, RDS, S3, CloudFront)  
B) AWS Serverless (Lambda, API Gateway, DynamoDB/RDS, S3)  
C) Vercel + Supabase (또는 PlanetScale/Neon)  
D) 자체 서버 / Docker Compose (로컬·VPS 단일 서버)  
E) AWS Amplify (풀스택 호스팅)  
X) Other (please describe after [Answer]: tag below)

[Answer]: A

> **💡 AWS 기준 추천: A) AWS (ECS/Fargate, RDS, S3, CloudFront)**
> AWS 인프라를 사용하기로 결정했으므로 A가 가장 적합합니다. 구체적인 구성은 다음과 같습니다:
> - **프론트엔드(Next.js)**: ECS/Fargate 컨테이너 또는 AWS Amplify Hosting
> - **백엔드(NestJS)**: ECS/Fargate 컨테이너 + ALB(Application Load Balancer)
> - **DB**: Amazon RDS for PostgreSQL 또는 Aurora PostgreSQL Serverless v2
> - **파일 저장**: S3 + CloudFront (이미지, 썸네일 CDN)
> - **스케줄러(링크 체크)**: Amazon EventBridge Scheduler + Lambda 또는 ECS Task
> - **이메일(비밀번호 재설정)**: Amazon SES
> - **컨테이너 레지스트리**: Amazon ECR
> - **CI/CD**: AWS CodePipeline 또는 GitHub Actions → ECR → ECS 배포

### Question 5
이미지 업로드/저장 위치는 어디로 할까요?

A) AWS S3 + CloudFront (CDN)  
B) Cloudflare R2 / Images  
C) Supabase Storage  
D) 자체 서버의 로컬 파일 시스템  
X) Other (please describe after [Answer]: tag below)

[Answer]: A

> **💡 AWS 기준 추천: A) AWS S3 + CloudFront**
> AWS 인프라를 사용하므로 S3가 자연스러운 선택입니다. 컬렉션 이미지 블록 업로드, 북마크 썸네일 캐싱 모두 S3에 저장하고 CloudFront로 CDN 배포하면 전 세계 빠른 로딩이 가능합니다. Pre-signed URL을 사용하면 백엔드를 거치지 않고 클라이언트에서 S3로 직접 업로드할 수 있어 서버 부하도 줄어듭니다.

### Question 6
Chrome Extension 배포 방식은?

A) Chrome Web Store에 정식 배포 (배포 스크립트/매니페스트 포함)  
B) Developer mode (unpacked) 로컬 사용 위주, 추후 스토어 배포  
C) MV3 매니페스트만 준비, 배포는 별도 단계  
X) Other (please describe after [Answer]: tag below)

[Answer]: B

> **💡 AWS 기준 추천: B) Developer mode (MVP), 추후 A로 전환**
> MVP 단계에서는 Chrome Web Store 심사 과정(수일~수주 소요)을 건너뛰고 빠르게 테스트할 수 있습니다. Extension이 호출하는 백엔드 API는 AWS ECS/Fargate에 배포된 NestJS API를 그대로 사용하므로 인프라 추가 없이 연동됩니다. 정식 배포 시에는 MV3 매니페스트와 빌드 스크립트만 추가하면 됩니다.

---

## C. 인증 및 사용자 (Authentication & Users)

### Question 7
이메일+비밀번호 외 추가로 지원할 인증 방식은?

A) 이메일+비밀번호만 (MVP는 단순하게)  
B) 이메일+비밀번호 + Google OAuth  
C) 이메일+비밀번호 + Google + GitHub OAuth  
D) 매직링크(이메일 인증 링크) 위주  
X) Other (please describe after [Answer]: tag below)

[Answer]: X — AWS Cognito 사용. 이메일+비밀번호 기본 제공, 추후 Google OAuth 추가 가능.

> **💡 AWS 기준 추천: B) 이메일+비밀번호 + Google OAuth (Amazon Cognito 활용)**
> AWS를 사용한다면 **Amazon Cognito**로 인증을 관리하는 것이 좋습니다. Cognito는 이메일+비밀번호, Google OAuth, 비밀번호 재설정, 이메일 인증을 모두 관리형으로 제공하므로 직접 구현할 필요가 없습니다. Google OAuth를 추가해도 Cognito 설정만으로 처리되며, JWT 토큰 발급/검증도 자동화됩니다. MVP라도 Cognito를 쓰면 보안 부담이 크게 줄어듭니다.

### Question 8
회원가입 시 이메일 인증(verification) 절차가 필요한가요?

A) 필요함 — 인증 메일을 통해 활성화해야 로그인 가능  
B) 불필요 — 가입 즉시 사용 가능 (MVP)  
C) 선택적 — 인증 없이 가입 가능하지만 일부 기능(공유 등)은 인증 필요  
X) Other (please describe after [Answer]: tag below)

[Answer]: X — AWS Cognito 사용 시 이메일 인증이 기본 내장. MVP부터 적용.

> **💡 AWS 기준 추천: A) 필요함 (Amazon Cognito + SES 활용)**
> Amazon Cognito를 사용하면 이메일 인증이 기본 내장 기능으로 제공됩니다. 별도 구현 없이 Cognito 설정만으로 인증 메일 발송(Amazon SES 연동)이 가능합니다. 스팸 계정 방지와 비밀번호 재설정 흐름을 위해서도 이메일 인증은 권장됩니다. 구현 비용이 거의 없으므로 MVP에서도 포함하는 것이 좋습니다.

### Question 9
비밀번호 재설정 / 비밀번호 분실 기능이 필요한가요?

A) 필요함 — 이메일을 통한 비밀번호 재설정 흐름 포함  
B) MVP에서는 제외, 추후 추가  
X) Other (please describe after [Answer]: tag below)

[Answer]: X — AWS Cognito 사용 시 비밀번호 재설정 기본 내장. MVP부터 적용.

> **💡 AWS 기준 추천: A) 필요함 (Amazon Cognito 기본 제공)**
> Cognito를 사용하면 비밀번호 재설정 흐름(이메일 발송 → 코드 입력 → 새 비밀번호 설정)이 기본 내장되어 있습니다. Amazon SES와 연동하면 커스텀 이메일 템플릿도 적용 가능합니다. 별도 구현 비용이 없으므로 MVP부터 포함하는 것이 좋습니다.

### Question 10
사용자별 데이터 저장 한도(쿼터)가 필요한가요?

A) 무제한 (MVP)  
B) 사용자당 최대 N개 북마크/이미지 용량 제한 적용  
C) 무료/유료 플랜 분리하여 한도 차등 적용  
X) Other (please describe after [Answer]: tag below)

[Answer]: A

---

## D. 북마크 및 메타데이터 (Bookmark & Metadata)

### Question 11
URL 저장 시 메타데이터(제목/설명/썸네일) 자동 fetch는 어떻게 처리할까요?

A) 백엔드 서버에서 fetch (CORS/안정성, OG 태그 파싱)  
B) 클라이언트(브라우저)에서 fetch  
C) 서버 fetch + 실패 시 사용자 수동 입력  
X) Other (please describe after [Answer]: tag below)

[Answer]: C

### Question 12
태그(tag)는 어떻게 다룰까요?

A) 자유 입력(free-form), 사용자별 태그 목록 자동 누적  
B) 사전 정의된 태그 + 자유 입력 혼합  
C) 사용자가 직접 태그 마스터를 관리  
X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 13
링크 상태 체크(404, dead link)는 어떻게 동작해야 할까요?

A) 백엔드 스케줄러(예: 매일 1회)로 모든 링크 체크  
B) 사용자가 수동으로 "체크" 버튼을 눌러 실행  
C) 최근 본/추가한 링크만 자동 체크  
D) MVP에서는 제외, 추후 추가  
X) Other (please describe after [Answer]: tag below)

[Answer]: A

> **💡 AWS 기준 추천: A) 백엔드 스케줄러 (Amazon EventBridge Scheduler + Lambda)**
> AWS에서는 **Amazon EventBridge Scheduler**로 매일 정해진 시간에 Lambda 함수를 트리거하거나, ECS Task를 실행하여 링크 상태를 일괄 체크할 수 있습니다. 대량 링크 처리 시에는 **Amazon SQS**에 링크를 큐잉하고 Lambda가 배치로 처리하는 패턴이 효율적입니다. 서버리스이므로 스케줄러 실행 시간에만 비용이 발생합니다.
>
> ⚠️ **참고**: 이 기능은 MVP에서 제외됨 (Post-MVP로 이동)

---

## E. 검색 (Search)

### Question 14
빠른 검색의 백엔드 구현은 어떻게 할까요?

A) PostgreSQL 풀텍스트 검색(tsvector + GIN 인덱스) — 추가 인프라 없이 충분  
B) Elasticsearch / OpenSearch — 정교한 검색 필요시  
C) Meilisearch / Typesense — 가벼운 전용 검색 엔진  
D) 단순 LIKE 쿼리 — MVP 수준  
X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 15
검색 범위는 어디까지 포함해야 하나요?

A) 제목 + URL + 메모만  
B) 제목 + URL + 메모 + 태그  
C) 제목 + URL + 메모 + 태그 + 컬렉션 블록 텍스트(텍스트 블록 내용 포함)  
X) Other (please describe after [Answer]: tag below)

[Answer]: C

---

## F. 컬렉션 / 공유 (Collections & Sharing)

### Question 16
공개 컬렉션 URL의 접근 권한은 어떻게 할까요?

A) 공개 ON 시 누구나 URL을 알면 접근 가능 (링크 공유)  
B) 공개 ON + 비밀번호 보호 옵션  
C) 공개 ON / 링크 공유 / 비밀번호 보호 3단계 선택  
X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 17
공유 페이지의 통계(조회수 등)가 필요한가요?

A) 필요 — 컬렉션별 조회수 표시  
B) 필요 — 조회수 + 클릭수(어떤 링크가 클릭되었는지)  
C) MVP에서는 제외  
X) Other (please describe after [Answer]: tag below)

[Answer]: B

### Question 18
공유 페이지에 댓글 / 좋아요 같은 인터랙션 기능이 필요한가요?

A) 필요 없음 (MVP는 읽기 전용)  
B) 좋아요만 (익명 가능)  
C) 좋아요 + 댓글 (로그인 필요)  
X) Other (please describe after [Answer]: tag below)

[Answer]: B

### Question 19
컬렉션 슬러그(공개 URL `/c/{slug}`) 정책은?

A) 시스템 자동 생성 short ID (예: `abc123_`) — 충돌 방지 자동  
B) 사용자가 원하는 커스텀 슬러그 입력 가능 (중복 검사)  
C) A + B 둘 다 (자동 생성 후 사용자가 수정 가능)  
X) Other (please describe after [Answer]: tag below)

[Answer]: C

---

## G. Chrome Extension & AI

### Question 20
"자동 추천(자주 방문 미등록 사이트)" 의 AI 호출은 어떻게 처리할까요?

A) 사용자 본인 API Key를 직접 입력 → 클라이언트(Extension)에서 직접 호출  
B) 사용자 API Key를 백엔드로 전달 → 백엔드 프록시를 통해 호출 (안정성↑)  
C) AI 기능은 일단 MVP에서 제외, 단순 빈도 기반 추천만  
X) Other (please describe after [Answer]: tag below)

[Answer]: C

> **💡 AWS 기준 추천: B) 백엔드 프록시 (AWS ECS/Fargate NestJS API)**
> 사용자 API Key를 Extension 클라이언트에 저장하면 브라우저 스토리지에 노출될 위험이 있습니다. AWS 백엔드(NestJS)를 프록시로 사용하면 API Key를 서버에서 안전하게 관리하고, AWS Secrets Manager 또는 Parameter Store에 암호화 저장할 수 있습니다. 또한 요청 로깅, 속도 제한(rate limiting), 오류 처리도 백엔드에서 일관되게 처리할 수 있습니다.

### Question 21
지원할 AI 제공자는?

A) OpenAI 만 (GPT-4o-mini 등)  
B) OpenAI + Anthropic (Claude) 선택 가능  
C) OpenAI + Anthropic + Google Gemini 선택 가능  
D) MVP는 OpenAI 호환 API (베이스URL + 모델명 입력) 하나만  
X) Other (please describe after [Answer]: tag below)

[Answer]: X — MVP에서 AI 기능 전체 제외. 추후 시간이 되면 Google Gemini부터 추가 예정.

### Question 22
Chrome Extension의 "현재 페이지 저장" 시 그룹 선택 UI는?

A) 드롭다운에서 그룹 선택 (단일)  
B) 그룹 선택 + 인박스 행 추가 (선택 안 하면 인박스로 이동)  
C) 그룹 선택 + 태그 입력 + 메모 입력  
X) Other (please describe after [Answer]: tag below)

[Answer]: C

---

## H. 비기능 요구사항 (Non-Functional)

### Question 23
예상 사용자 규모(MVP 시점)는?

A) 개인/팀 (1~10명) — 자체 호스팅 위주  
B) 소규모 SaaS (수백~수천 명)  
C) 중규모 SaaS (수만 명) — 부하 분산/캐싱 고려  
X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 24
다국어(i18n) 지원이 필요한가요?

A) 한국어만 (MVP)  
B) 한국어 + 영어 (MVP부터)  
C) 한국어 + 영어 (구조만 준비, 영어 번역은 추후)  
X) Other (please describe after [Answer]: tag below)

[Answer]: C

### Question 25
모바일 지원 범위는?

A) 데스크탑 위주, 반응형 모바일 웹은 최소 동작  
B) 데스크탑 + 모바일 반응형 웹 동등 지원  
C) 데스크탑 + 모바일 반응형 + 추후 PWA  
D) 네이티브 모바일 앱 (iOS/Android)  
X) Other (please describe after [Answer]: tag below)

[Answer]: B

### Question 26
사용자 데이터 내보내기(Export) 기능이 필요한가요?

A) 필요 — JSON / Chrome 북마크 HTML 형식으로 내보내기  
B) 필요 — JSON 만  
C) MVP에서는 제외  
X) Other (please describe after [Answer]: tag below)

[Answer]: A

---

## I. 확장 기능 옵트인 (Extensions Opt-In)

### Question 27: Security Extensions
이 프로젝트에 보안 확장 규칙을 적용할까요?

A) Yes — 모든 SECURITY 규칙을 차단 제약으로 적용 (프로덕션급 애플리케이션 권장)  
B) No — 모든 SECURITY 규칙 건너뜀 (PoC, 프로토타입, 실험적 프로젝트)  
X) Other (please describe after [Answer]: tag below)

[Answer]: B

### Question 28: Property-Based Testing Extension
이 프로젝트에 Property-Based Testing(PBT) 규칙을 적용할까요?

A) Yes — 모든 PBT 규칙을 차단 제약으로 적용 (비즈니스 로직, 데이터 변환, 직렬화, 상태 컴포넌트가 있는 프로젝트 권장)  
B) Partial — 순수 함수와 직렬화 라운드트립에만 PBT 적용 (알고리즘 복잡도가 제한적인 프로젝트)  
C) No — 모든 PBT 규칙 건너뜀 (단순 CRUD, UI 전용, 비즈니스 로직 없는 통합 레이어)  
X) Other (please describe after [Answer]: tag below)

[Answer]: C

---

## J. MVP 범위 결정

### Question 29
input.md에 정의된 8가지 기능 중 MVP에 반드시 포함되어야 하는 기능을 선택해주세요. (복수 선택 가능 — `[Answer]:` 뒤에 해당 항목 번호를 콤마로 구분)

1. 북마크 저장 (URL → 인박스 + 메타 fetch)  
2. 인박스  
3. 그룹  
4. 컬렉션 (블록 + 공유)  
5. 빠른 검색 (Cmd+K)  
6. 링크 상태 체크  
7. 북마크 Import (크롬 HTML)  
8. Chrome Extension  

[Answer]: 1, 2, 3, 4, 5, 6, 7, 8

### Question 30
혹시 추가로 명시하고 싶은 요구사항/제약사항이 있다면 자유롭게 작성해주세요. 없다면 "없음"이라고 적어주세요.

[Answer]: 없음
