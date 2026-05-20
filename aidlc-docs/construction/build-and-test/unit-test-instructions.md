# Unit Test Instructions — moaring

> **상태**: Unit Test 인프라 미설정  
> **작성일**: 2026-05-20

---

## 현재 상태

Code Generation 단계에서 사용자가 명시적으로 요청하지 않아 단위 테스트는 작성되지 않았어요.
(워크플로우 규칙: "DO NOT automatically add tests unless explicitly requested by the user")

향후 단위 테스트가 필요할 때 아래 가이드를 참고하세요.

---

## 권장 테스트 스택 (Unit 3: Chrome Extension)

| 항목 | 권장 도구 | 이유 |
|------|-----------|------|
| Test Runner | Vitest | Vite 생태계 통합, 빠른 실행 |
| React 컴포넌트 테스트 | @testing-library/react | data-testid 기반 쿼리 활용 |
| chrome API Mock | @types/chrome + 수동 stub | MV3 환경 시뮬레이션 |
| HTTP Mock | MSW | Mock 핸들러 재사용 가능 |

### 설치 명령

```bash
cd extension
npm install --save-dev vitest @testing-library/react @testing-library/jest-dom jsdom
```

### vitest.config.ts 추가

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.ts'],
  },
})
```

### package.json scripts 추가

```json
{
  "scripts": {
    "test": "vitest --run",
    "test:watch": "vitest"
  }
}
```

---

## 테스트 실행 (테스트 추가 후)

```bash
# 전체 단위 테스트 (1회 실행)
npm test

# Watch 모드 (개발 중)
npm run test:watch
```

---

## 테스트 우선순위 (작성 시 권장 순서)

### 높음 (비즈니스 로직)
1. `auth-manager.ts` — PKCE 생성, 토큰 갱신 로직
2. `api-client.ts` — 인터셉터 (401 재시도, GET 재시도)
3. `saved-url-cache.ts` — TTL 만료 로직
4. `top-sites.ts` — 필터링 로직
5. `useAppStore.ts` — 토스트 동일 메시지 가드

### 중간 (UI 컴포넌트)
6. `SavePage.tsx` — 중복 감지, 태그 파싱
7. `RecentList.tsx` — 상대 시간 포맷팅
8. `Recommend.tsx` — 추천 → 저장 탭 전환

### 낮음 (단순 표현 컴포넌트)
- `Header.tsx`, `TabBar.tsx`, `Toast.tsx`, `LoginScreen.tsx`

---

## chrome API Mock 예시

```typescript
// test/setup.ts
beforeEach(() => {
  global.chrome = {
    storage: {
      local: {
        get: vi.fn().mockResolvedValue({}),
        set: vi.fn().mockResolvedValue(undefined),
        remove: vi.fn().mockResolvedValue(undefined),
      },
    },
    tabs: {
      query: vi.fn().mockResolvedValue([{ url: 'https://example.com', title: 'Example' }]),
      create: vi.fn(),
    },
    topSites: {
      get: vi.fn().mockResolvedValue([]),
    },
    identity: {
      launchWebAuthFlow: vi.fn(),
      getRedirectURL: vi.fn(() => 'https://test-id.chromiumapp.org/'),
    },
  } as never
})
```

---

## 현재 검증된 항목 (수동 검증)

| 항목 | 상태 | 검증 방법 |
|------|------|-----------|
| TypeScript 타입 체크 | ✅ | `npm run typecheck` 통과 |
| 빌드 성공 | ✅ | `npm run build:dev` 통과 |
| 번들 크기 (1MB 이하) | ✅ | 232KB (PERF-03 만족) |
| 진단 에러 없음 | ✅ | `getDiagnostics` 클린 |
