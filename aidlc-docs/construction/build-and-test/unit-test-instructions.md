# Unit Test Execution — moaring (Unit 2: Next.js App)

## 테스트 대상

핵심 Service 로직 단위 테스트 (Jest + ts-jest)

| 테스트 파일                  | 테스트 대상       | 주요 케이스                                          |
| ---------------------------- | ----------------- | ---------------------------------------------------- |
| `auth.service.test.ts`       | AuthService       | JWT 검증, User 조회, syncCognitoUser                 |
| `bookmark.service.test.ts`   | BookmarkService   | create, getInbox, delete, markAsRead, importFromHtml |
| `collection.service.test.ts` | CollectionService | create, togglePublic, updateSlug, reorderBlocks      |
| `search.service.test.ts`     | SearchService     | 빈 쿼리, 검색 결과, 쿼리 길이 제한                   |
| `tag.service.test.ts`        | TagService        | getOrCreate(정규화), autocomplete, setBookmarkTags   |

---

## 단위 테스트 실행

### 1. 사전 준비

```bash
cd /home/ksg/Projects/aidlc

# 의존성 설치 (미설치 시)
npm install

# Prisma 클라이언트 생성 (미생성 시)
npx prisma generate
```

### 2. 전체 단위 테스트 실행

```bash
npm test
# 또는
npx jest --testPathPattern="lib/services/__tests__"
```

**기대 출력**:

```
PASS lib/services/__tests__/auth.service.test.ts
PASS lib/services/__tests__/bookmark.service.test.ts
PASS lib/services/__tests__/collection.service.test.ts
PASS lib/services/__tests__/search.service.test.ts
PASS lib/services/__tests__/tag.service.test.ts

Test Suites: 5 passed, 5 total
Tests:       XX passed, XX total
Snapshots:   0 total
Time:        X.XXXs
```

### 3. 커버리지 포함 실행

```bash
npm run test:coverage
# 목표: 핵심 Service 70% 이상
```

**커버리지 리포트 위치**: `coverage/lcov-report/index.html`

### 4. 특정 파일만 실행

```bash
# BookmarkService만
npx jest bookmark.service.test

# 특정 테스트 케이스만
npx jest bookmark.service.test -t "OG 메타데이터"
```

### 5. Watch 모드 (개발 중)

```bash
npm run test:watch
```

---

## 테스트 실패 시 대응

### Prisma 모킹 에러

```bash
# jest-mock-extended 재설치
npm install --save-dev jest-mock-extended
```

### 환경 변수 에러

```
# jest.setup.ts에 환경 변수가 설정되어 있는지 확인
cat jest.setup.ts
```

### TypeScript 컴파일 에러

```bash
# ts-jest 설정 확인
cat jest.config.ts
# tsconfig strict 모드와 ts-jest 호환성 확인
```

---

## 테스트 커버리지 목표

| Service           | 목표 커버리지 | 주요 테스트 항목                            |
| ----------------- | ------------- | ------------------------------------------- |
| AuthService       | 80%+          | getUserFromToken, syncCognitoUser           |
| BookmarkService   | 75%+          | create, getInbox, delete, importFromHtml    |
| CollectionService | 75%+          | create, addBlock, reorderBlocks, updateSlug |
| SearchService     | 70%+          | search (빈 쿼리, 정상 쿼리)                 |
| TagService        | 80%+          | getOrCreate, autocomplete, setBookmarkTags  |
