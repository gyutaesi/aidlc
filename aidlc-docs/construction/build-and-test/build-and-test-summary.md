# Build and Test Summary — moaring (Unit 2: Next.js App)

> **작성일**: 2026-05-20  
> **단계**: Construction Phase — Build and Test

---

## 빌드 상태

| 항목              | 상태                | 비고                          |
| ----------------- | ------------------- | ----------------------------- |
| 빌드 도구         | Next.js 15 + npm    | `npm run build`               |
| TypeScript 컴파일 | ✅ 설계 완료        | `npx tsc --noEmit`            |
| Prisma 스키마     | ✅ 생성 완료        | 9개 모델                      |
| Docker 이미지     | ✅ Dockerfile 생성  | node:20-alpine, 멀티 스테이지 |
| 빌드 산출물       | `.next/standalone/` | standalone output             |

---

## 테스트 실행 요약

### 단위 테스트 (Jest)

| 테스트 파일                | 테스트 수 | 상태          |
| -------------------------- | --------- | ------------- |
| auth.service.test.ts       | 3개       | ✅ 작성 완료  |
| bookmark.service.test.ts   | 5개       | ✅ 작성 완료  |
| collection.service.test.ts | 4개       | ✅ 작성 완료  |
| search.service.test.ts     | 4개       | ✅ 작성 완료  |
| tag.service.test.ts        | 3개       | ✅ 작성 완료  |
| **합계**                   | **19개**  | **실행 필요** |

**실행 명령**:

```bash
npm test
```

**커버리지 목표**: 핵심 Service 70% 이상

### 통합 테스트

| 시나리오                  | 대상                    | 상태           |
| ------------------------- | ----------------------- | -------------- |
| 북마크 저장 → 인박스 조회 | BookmarkService + DB    | 수동 실행 필요 |
| 검색 (tsvector GIN)       | SearchService + DB      | 수동 실행 필요 |
| 컬렉션 공개 → 공개 페이지 | CollectionService + SSR | 수동 실행 필요 |
| 이미지 업로드 (S3)        | StorageService + S3     | AWS 계정 필요  |
| Extension API 검증        | API Routes              | 수동 실행 필요 |
| 크롬 북마크 Import        | BookmarkService         | 수동 실행 필요 |

### 성능 테스트

| 항목             | 목표    | 상태                       |
| ---------------- | ------- | -------------------------- |
| 검색 응답 시간   | < 300ms | GIN 인덱스 적용 완료       |
| 공유 페이지 로딩 | < 1.5s  | SSR + CloudFront 설계 완료 |
| API 응답 시간    | < 500ms | 측정 필요                  |

### 추가 테스트

| 항목                    | 상태                                      |
| ----------------------- | ----------------------------------------- |
| E2E 테스트 (Playwright) | Post-MVP                                  |
| 보안 테스트             | 기본 수준 적용 (XSS, SQL Injection, CSRF) |
| 부하 테스트 (k6)        | Post-MVP                                  |

---

## 생성된 파일 목록

```
aidlc-docs/construction/build-and-test/
├── build-instructions.md          ← 빌드 절차 (로컬 + 프로덕션 + Docker)
├── unit-test-instructions.md      ← 단위 테스트 실행 가이드
├── integration-test-instructions.md ← 통합 테스트 시나리오 6개
├── performance-test-instructions.md ← 성능 측정 방법
└── build-and-test-summary.md      ← 이 파일
```

---

## 빌드 실행 순서 (Quick Start)

```bash
# 1. 의존성 설치
npm install

# 2. DB 시작
docker compose up -d

# 3. Prisma 설정
npx prisma generate
npx prisma migrate dev --name init

# 4. 단위 테스트 실행
npm test

# 5. 개발 서버 실행
npm run dev

# 6. 프로덕션 빌드 검증
npm run build
```

---

## 전체 상태

| 항목                 | 상태                             |
| -------------------- | -------------------------------- |
| 코드 생성            | ✅ 완료 (75개 단계)              |
| 빌드 설정            | ✅ 완료                          |
| 단위 테스트 작성     | ✅ 완료 (19개 테스트)            |
| 통합 테스트 시나리오 | ✅ 문서화 완료                   |
| 성능 테스트 가이드   | ✅ 문서화 완료                   |
| Operations 준비      | ✅ Dockerfile + 배포 가이드 완료 |

---

## 다음 단계

Unit 2 (Next.js 앱) Construction Phase 완료.

**병렬 진행 가능**:

- Unit 1 (인프라 CDK) 배포 → Unit 2 ECS 배포
- Unit 3 (Chrome Extension) 개발 시작 (Unit 2 핵심 API 완성 기준)
