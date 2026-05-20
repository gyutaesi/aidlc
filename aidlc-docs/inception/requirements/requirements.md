# Linkflow — 요구사항 문서 (Requirements Document)

> **버전**: 1.0  
> **작성일**: 2026-05-20  
> **상태**: 승인 대기

---

## 1. 인텐트 분석 (Intent Analysis)

| 항목 | 내용 |
|------|------|
| **사용자 요청** | 링크를 저장하고, 개인 프로필이나 가이드로 만들어 공유하는 북마크 매니저 "Linkflow" 신규 개발 |
| **요청 유형** | New Project (Greenfield) |
| **범위 추정** | System-wide — 웹 앱 + Chrome Extension + AWS 인프라 |
| **복잡도 추정** | Complex — 다중 컴포넌트, 공유 페이지, 스케줄러, 파일 업로드, 외부 API 연동 |
| **핵심 컨셉** | 단순 북마크 저장을 넘어 "링크 묶음 → 스토리가 있는 페이지 → URL 하나로 공유" |

---

## 2. 용어 정의

| 용어 | 설명 |
|------|------|
| **그룹** | 개인 북마크 관리용 묶음. 빠른 접근 목적, 나만 보는 것 (Toby 스타일) |
| **컬렉션** | 공유용 페이지. 설명/순서/템플릿이 있고 외부에 URL로 공유 가능 |
| **인박스** | 분류 전 임시 보관소 |
| **블록** | 컬렉션 안에 추가할 수 있는 콘텐츠 단위 (링크/텍스트/이미지) |
| **슬러그** | 컬렉션 공개 URL의 식별자 (예: `/c/abc123`) |

---

## 3. 기술 스택 (Tech Stack)

| 레이어 | 기술 | 비고 |
|--------|------|------|
| **프론트엔드** | Next.js (React, App Router) + TypeScript | SSR/SSG로 공유 페이지 SEO 지원 |
| **백엔드** | Next.js API Routes / Server Actions | 풀스택 단일 코드베이스 |
| **데이터베이스** | PostgreSQL (Amazon Aurora Serverless v2) | JSONB 블록 저장, tsvector 검색 |
| **파일 저장** | AWS S3 + CloudFront | 이미지 업로드, 썸네일 CDN |
| **인증** | Amazon Cognito User Pool | 이메일+비밀번호, JWT 발급, 이메일 인증, 비밀번호 재설정 내장 |
| **이메일** | Cognito 기본 이메일 (MVP) → Amazon SES (Post-MVP) | MVP: Cognito 내장 이메일 사용 (50건/일 제한), 추후 SES로 전환 |
| **스케줄러** | Amazon EventBridge Scheduler + Lambda | 링크 상태 체크 (매일 1회) |
| **큐** | Amazon SQS | 대량 링크 체크 배치 처리 |
| **컨테이너** | Amazon ECS/Fargate + ECR | 컨테이너 배포 |
| **CDN/네트워크** | Amazon CloudFront + ALB | 정적 자산 CDN, 로드밸런서 |
| **Chrome Extension** | MV3 (Manifest V3) + React | Developer mode 배포 (MVP) |

---

## 4. AWS 인프라 구성

```
[사용자 브라우저 / Chrome Extension]
        |
        v
[Amazon CloudFront] ←── [S3: 정적 자산, 이미지]
        |
        v
[ALB (Application Load Balancer)]
        |
        v
[ECS/Fargate: Next.js 앱] ←── [Amazon Cognito User Pool: 인증]
        |
        v
[Aurora PostgreSQL Serverless v2]

[EventBridge Scheduler]
        |
        v
[Lambda / ECS Task: 링크 상태 체크]
        |
        v
[SQS: 링크 체크 큐] → [Lambda Worker]

[Amazon ECR: 컨테이너 이미지]
(Amazon SES: Post-MVP — Cognito 커스텀 이메일 발신자 연동)
```

---

## 5. 기능 요구사항 (Functional Requirements)

### FR-01. 계정 및 인증

| ID | 요구사항 | 우선순위 |
|----|----------|----------|
| FR-01-1 | Amazon Cognito User Pool 기반 회원가입 (이메일 + 비밀번호) | Must |
| FR-01-2 | Cognito 기반 로그인, JWT(ID Token / Access Token) 발급 | Must |
| FR-01-3 | Cognito 이메일 인증 (가입 후 인증 코드 입력으로 활성화) | Must |
| FR-01-4 | Cognito 비밀번호 재설정 (이메일 → 코드 입력 → 새 비밀번호) | Must |
| FR-01-5 | 로그아웃 (Cognito 세션 무효화) | Must |
| FR-01-6 | JWT 기반 API 인증 (Cognito 발급 토큰 검증) | Must |
| FR-01-7 | 크로스 디바이스 동기화 (계정 기반) | Must |
| FR-01-8 | 사용자별 데이터 완전 격리 | Must |

### FR-02. 북마크 저장

| ID | 요구사항 | 우선순위 |
|----|----------|----------|
| FR-02-1 | URL 붙여넣기 시 자동으로 제목/설명/썸네일 fetch (백엔드 서버에서 OG 태그 파싱) | Must |
| FR-02-2 | 메타데이터 fetch 실패 시 사용자 수동 입력 가능 | Must |
| FR-02-3 | 저장 즉시 인박스로 이동 | Must |
| FR-02-4 | 저장 시 태그 추가 가능 (자유 입력, 사용자별 태그 목록 자동 누적) | Must |
| FR-02-5 | 저장된 북마크 제목/설명/태그/메모 수정 | Must |
| FR-02-6 | 크롬 북마크 HTML 파일 업로드 → 자동 파싱 → 인박스 일괄 추가 | Must |

### FR-03. 인박스

| ID | 요구사항 | 우선순위 |
|----|----------|----------|
| FR-03-1 | 분류되지 않은 링크 임시 보관 | Must |
| FR-03-2 | 인박스 아이템 읽음 처리 | Must |
| FR-03-3 | 인박스 아이템 → 그룹으로 이동 | Must |
| FR-03-4 | 인박스 아이템 → 컬렉션으로 이동 | Must |
| FR-03-5 | 인박스 아이템 삭제 | Must |
| FR-03-6 | 인박스 정렬 (최신순 / 오래된순) | Must |
| FR-03-7 | 인박스 필터 (읽음 / 미읽음) | Must |

### FR-04. 그룹

| ID | 요구사항 | 우선순위 |
|----|----------|----------|
| FR-04-1 | 그룹 생성 (이름 + 이모지) | Must |
| FR-04-2 | 그룹 수정 / 삭제 | Must |
| FR-04-3 | 개인 대시보드에서만 보임 (비공개) | Must |
| FR-04-4 | Toby 스타일 컬럼 형태로 표시 | Must |
| FR-04-5 | 그룹 내 북마크 순서 변경 (드래그 앤 드롭) | Must |
| FR-04-6 | 그룹에서 링크를 선택해 컬렉션으로 변환 | Must |

### FR-05. 컬렉션

| ID | 요구사항 | 우선순위 |
|----|----------|----------|
| FR-05-1 | 컬렉션 생성 (이름 + 이모지 + 설명) | Must |
| FR-05-2 | 컬렉션 수정 / 삭제 | Must |
| FR-05-3 | 블록 추가: 링크 블록 (URL + 설명 + 태그) | Must |
| FR-05-4 | 블록 추가: 텍스트 블록 (마크다운 간단 메모) | Must |
| FR-05-5 | 블록 추가: 이미지 블록 (S3 업로드 또는 URL) | Must |
| FR-05-6 | 블록 수정 (내용 편집) | Must |
| FR-05-7 | 블록 삭제 | Must |
| FR-05-8 | 블록 순서 드래그 앤 드롭으로 변경 | Must |
| FR-05-9 | 공유 ON/OFF 토글 | Must |
| FR-05-10 | 공개 URL 생성 (시스템 자동 생성 short ID, 사용자 커스텀 슬러그 수정 가능) | Must |
| FR-05-11 | 공유 페이지 템플릿 선택: 가이드 모드 (순서 있는 절차서) | Must |
| FR-05-12 | 공유 페이지 템플릿 선택: 프로필 모드 (개인 소개 + 링크 나열) | Must |
| FR-05-13 | 공유 페이지 조회수 + 링크 클릭수 통계 | Must |
| FR-05-14 | 공유 페이지 좋아요 (익명 가능) | Must |

### FR-06. 빠른 검색

| ID | 요구사항 | 우선순위 |
|----|----------|----------|
| FR-06-1 | 단축키 Cmd+K로 검색 팝업 열기 | Must |
| FR-06-2 | 제목 + URL + 메모 + 태그 + 컬렉션 블록 텍스트 전체 검색 | Must |
| FR-06-3 | PostgreSQL tsvector + GIN 인덱스 기반 풀텍스트 검색 | Must |

### FR-07. 링크 상태 체크

| ID | 요구사항 | 우선순위 |
|----|----------|----------|
| FR-07-1 | EventBridge Scheduler로 매일 1회 전체 링크 유효성 확인 | Must |
| FR-07-2 | SQS 큐 + Lambda Worker로 배치 처리 | Must |
| FR-07-3 | 404 / 접근 불가 링크에 "죽은 링크" 뱃지 표시 | Must |

### FR-08. Chrome Extension

| ID | 요구사항 | 우선순위 |
|----|----------|----------|
| FR-08-1 | 현재 페이지 저장: 그룹 선택 + 태그 입력 + 메모 입력 후 저장 | Must |
| FR-08-2 | 그룹 미선택 시 인박스로 자동 이동 | Must |
| FR-08-3 | 자동 추천: `chrome.topSites` API로 자주 방문하지만 미등록된 사이트 목록 표시 | Must |
| FR-08-4 | 자동 추천 원클릭 인박스 추가 | Must |
| FR-08-5 | AI 기반 자동 추천 — **MVP 제외, 추후 Google Gemini로 추가 예정** | Post-MVP |
| FR-08-6 | 최근 저장 목록 표시 | Must |
| FR-08-7 | Extension 로그인: Cognito Hosted UI 또는 직접 API 호출 방식으로 인증, `chrome.storage.local`에 토큰 안전 저장 | Must |
| FR-08-8 | MV3 매니페스트, Developer mode 배포 (MVP), 추후 Chrome Web Store 정식 배포 | Must |

### FR-09. 데이터 내보내기 (Export)

| ID | 요구사항 | 우선순위 |
|----|----------|----------|
| FR-09-1 | JSON 형식으로 전체 데이터 내보내기 | Must |
| FR-09-2 | Chrome 북마크 HTML 형식으로 내보내기 | Must |

---

## 6. 비기능 요구사항 (Non-Functional Requirements)

### NFR-01. 성능

| ID | 요구사항 |
|----|----------|
| NFR-01-1 | 검색 응답 시간 < 300ms (PostgreSQL GIN 인덱스 기준) |
| NFR-01-2 | 공유 페이지 초기 로딩 < 1.5s (CloudFront CDN + Next.js SSR) |
| NFR-01-3 | 이미지 업로드: S3 Pre-signed URL 직접 업로드로 서버 부하 최소화 |

### NFR-02. 보안

| ID | 요구사항 |
|----|----------|
| NFR-02-1 | 사용자별 데이터 완전 격리 (Row-level 접근 제어) |
| NFR-02-2 | HTTPS 전용 (CloudFront + ALB SSL 종료) |
| NFR-02-3 | JWT 토큰 기반 인증, Access Token 만료 시간 설정 (기본 1시간) |
| NFR-02-4 | Refresh Token으로 Access Token 자동 갱신 (Cognito 기본 제공, 만료 시 재로그인) |
| NFR-02-5 | S3 버킷 퍼블릭 직접 접근 차단, CloudFront OAC(Origin Access Control) 사용 |
| NFR-02-6 | SQL Injection 방지 (Parameterized Query / ORM 사용) |
| NFR-02-7 | XSS 방지 (마크다운 렌더링 시 sanitize 처리) |

> **참고**: Security Extension은 MVP에서 미적용 (Q27: B). 위 보안 요구사항은 기본 수준으로 적용.

### NFR-03. 확장성 / 가용성

| ID | 요구사항 |
|----|----------|
| NFR-03-1 | MVP 목표 사용자: 개인/팀 1~10명 (자체 호스팅 수준) |
| NFR-03-2 | Aurora Serverless v2 자동 스케일링으로 트래픽 증가 대응 |
| NFR-03-3 | ECS/Fargate 태스크 수 조정으로 수평 확장 가능 구조 |

### NFR-04. 유지보수성

| ID | 요구사항 |
|----|----------|
| NFR-04-1 | TypeScript 전체 적용 (프론트엔드 + 백엔드) |
| NFR-04-2 | 환경변수 기반 설정 관리 (AWS Parameter Store 연동) |
| NFR-04-3 | Docker 컨테이너 기반 배포 (ECR + ECS) |

### NFR-05. 국제화 (i18n)

| ID | 요구사항 |
|----|----------|
| NFR-05-1 | MVP: 한국어만 지원 |
| NFR-05-2 | i18n 구조 준비 (next-intl 등), 영어 번역은 Post-MVP |

### NFR-06. 접근성 / UX

| ID | 요구사항 |
|----|----------|
| NFR-06-1 | 데스크탑 + 모바일 반응형 웹 동등 지원 |
| NFR-06-2 | Cmd+K 단축키 검색 지원 |
| NFR-06-3 | 드래그 앤 드롭 블록 순서 변경 |

---

## 7. 시스템 경계 및 외부 연동

| 연동 대상 | 용도 | 비고 |
|-----------|------|------|
| Amazon Aurora PostgreSQL | 주 데이터베이스 | Serverless v2 |
| Amazon S3 | 이미지/파일 저장 | Pre-signed URL 업로드 |
| Amazon CloudFront | CDN, 정적 자산 배포 | OAC 설정 |
| Amazon Cognito User Pool | 인증 (회원가입/로그인/JWT/이메일 인증/비밀번호 재설정) | Cognito 기본 이메일 사용 (MVP) |
| Amazon SES | 커스텀 발신자 이메일 발송 | **Post-MVP** (SES 샌드박스 해제 후 Cognito 연동) |
| Amazon EventBridge Scheduler | 링크 체크 스케줄러 | 매일 1회 |
| Amazon SQS | 링크 체크 배치 큐 | Lambda Worker 연동 |
| Amazon ECS/Fargate | 앱 컨테이너 실행 | Next.js 앱 |
| Amazon ECR | 컨테이너 이미지 레지스트리 | |
| Chrome Extension API | `chrome.topSites` | 자주 방문 사이트 추천 |
| 외부 URL (OG 태그 fetch) | 북마크 메타데이터 수집 | 백엔드 서버에서 fetch |
| Google Gemini API | AI 자동 추천 | **Post-MVP** |

---

## 8. 데이터 모델 개요

### 주요 엔티티

```
User
  ├── id (내부 PK), cognito_sub (Cognito User Pool Sub, Unique), email
  └── created_at, updated_at
  (비밀번호는 Cognito가 관리 — DB에 저장하지 않음)

Bookmark
  ├── id, user_id, url, title, description, thumbnail_url
  ├── status: inbox | grouped | in_collection | archived
  ├── is_dead: boolean (링크 상태 체크 결과)
  ├── tags: string[]
  ├── memo: string (메모)
  └── created_at, updated_at

Group
  ├── id, user_id, name, emoji, position
  └── bookmark_groups: BookmarkGroup[] (북마크-그룹 관계, 순서 포함)

BookmarkGroup (북마크-그룹 관계 테이블)
  ├── bookmark_id, group_id, position

Collection
  ├── id, user_id, name, emoji, description
  ├── slug: string (공개 URL 식별자, 커스텀 가능)
  ├── is_public: boolean
  ├── template: 'guide' | 'profile'
  ├── view_count, like_count
  └── blocks: Block[] (JSONB)

Block (JSONB 내 구조)
  ├── id: string (블록 고유 ID)
  ├── type: 'link' | 'text' | 'image'
  ├── position: number
  └── content: { url?, title?, description?, tags?, markdown?, image_url?, click_count? }

Tag
  └── user_id, name (사용자별 자유 입력 누적)
```

---

## 9. MVP 범위 요약

**MVP에 포함되는 기능 (8가지 전체):**

| # | 기능 | 핵심 내용 |
|---|------|-----------|
| 1 | 북마크 저장 | URL → OG fetch → 인박스, 태그 |
| 2 | 인박스 | 임시 보관, 읽음/이동/삭제 |
| 3 | 그룹 | 컬럼 형태, 비공개, 컬렉션 변환 |
| 4 | 컬렉션 | 블록 편집, 공유 URL, 템플릿, 통계, 좋아요 |
| 5 | 빠른 검색 | Cmd+K, 풀텍스트 (PostgreSQL) |
| 6 | 링크 상태 체크 | EventBridge + SQS + Lambda, 매일 1회 |
| 7 | 북마크 Import | 크롬 HTML 파싱 → 인박스 일괄 추가 |
| 8 | Chrome Extension | 현재 페이지 저장, 자주 방문 추천(빈도 기반), 최근 저장 목록 |

**MVP 제외 (Post-MVP):**
- Google OAuth (Cognito에 추후 Social Provider 추가)
- Amazon SES 연동 (커스텀 발신자 도메인, 현재는 Cognito 기본 이메일 사용)
- AI 기반 자동 추천 (추후 Google Gemini)
- Chrome Web Store 정식 배포
- i18n 영어 번역

---

## 10. 확장 기능 설정

| Extension | 적용 여부 | 결정 시점 |
|-----------|-----------|-----------|
| Security Baseline | **미적용** (MVP, PoC 수준) | Requirements Analysis |
| Property-Based Testing | **미적용** | Requirements Analysis |
