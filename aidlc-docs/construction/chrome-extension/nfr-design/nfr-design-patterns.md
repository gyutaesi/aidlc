# NFR Design Patterns — Unit 3: Chrome Extension

> **Unit**: Chrome Extension  
> **작성일**: 2026-05-20

---

## 1. 신뢰성 패턴 (Resilience Patterns)

### 1.1 HTTP 메서드별 재시도 패턴 (REL-01, REL-02)

GET과 POST를 axios response interceptor에서 메서드로 분기하여 처리한다.

```
┌─────────────────────────────────────────────────────┐
│              axios response interceptor              │
│                                                     │
│  error 수신                                         │
│      │                                              │
│      ├─ 401? ──────────────────────────────────────►│
│      │         토큰 갱신 후 1회 재시도 (GET/POST 공통)│
│      │                                              │
│      ├─ 네트워크 에러 / 5xx?                         │
│      │      │                                       │
│      │      ├─ GET? ──► 500ms 딜레이 후 1회 재시도   │
│      │      │                                       │
│      │      └─ POST? ─► 즉시 에러 throw (재시도 없음)│
│      │                                              │
│      └─ 그 외 4xx ──► 즉시 에러 throw               │
└─────────────────────────────────────────────────────┘
```

**구현 패턴**:
```typescript
// 재시도 유틸리티
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

client.interceptors.response.use(null, async (error: AxiosError) => {
  const config = error.config as AxiosRequestConfig & { _retry?: boolean; _retryCount?: number }

  // 401: 토큰 갱신 후 재시도 (GET/POST 공통, 1회만)
  if (error.response?.status === 401 && !config._retry) {
    config._retry = true
    const newToken = await AuthManager.refreshToken()
    if (newToken) {
      config.headers!['Authorization'] = `Bearer ${newToken}`
      return client(config)
    }
    // 갱신 실패 → 로그아웃
    useAppStore.getState().setAuthState(null)
    throw error
  }

  // 네트워크 에러 / 5xx: GET만 1회 재시도
  const isRetryable = !error.response || error.response.status >= 500
  const isGet = config.method?.toUpperCase() === 'GET'
  if (isRetryable && isGet && !config._retry) {
    config._retry = true
    await delay(500)
    return client(config)
  }

  throw error
})
```

---

### 1.2 오프라인 감지 패턴 (REL-04)

API 호출 전 `navigator.onLine`을 체크하여 불필요한 네트워크 시도를 차단한다.

```
┌──────────────────────────────────────┐
│         axios request interceptor    │
│                                      │
│  요청 시작                           │
│      │                               │
│      ▼                               │
│  navigator.onLine 체크               │
│      │                               │
│      ├─ false ──► OfflineError throw │
│      │            토스트: "오프라인"  │
│      │                               │
│      └─ true ───► 요청 진행          │
└──────────────────────────────────────┘
```

**구현 패턴**:
```typescript
client.interceptors.request.use((config) => {
  if (!navigator.onLine) {
    const error = new Error('오프라인 상태입니다') as AxiosError
    error.code = 'OFFLINE'
    return Promise.reject(error)
  }
  return config
})
```

---

### 1.3 Graceful Degradation 패턴 (REL-05)

Chrome API 실패 시 기능을 비활성화하되 앱 전체가 중단되지 않도록 한다.

```
chrome.tabs.query()
    │
    ├─ 성공 ──► url, title 자동 주입
    └─ 실패 ──► url='', title='' (사용자 직접 입력)
               저장 버튼은 유지 (URL 입력 후 저장 가능)

chrome.topSites.get()
    │
    ├─ 성공 ──► 필터링 후 추천 목록 표시
    └─ 실패 ──► "추천 사이트를 불러올 수 없습니다" 표시
               다른 탭(저장, 최근)은 정상 동작
```

---

## 2. 성능 패턴 (Performance Patterns)

### 2.1 병렬 초기화 패턴 (PERF-01, PERF-04)

팝업 오픈 시 독립적인 API 호출을 `Promise.all`로 병렬 실행하여 초기화 시간을 최소화한다.

```
팝업 오픈
    │
    ▼
Promise.all([
    getGroups(),          ─────────────────────► 완료
    getSavedUrlCache()    ─────────────────────► 완료
])                                               │
    │◄────────────────────────────────────────── 두 작업 중 느린 쪽 기준
    ▼
UI 렌더링 (목표: 500ms 이내)
```

**순차 실행 대비 효과**:
- 순차: getGroups(~200ms) + getSavedUrlCache(~150ms) = ~350ms
- 병렬: max(~200ms, ~150ms) = ~200ms → **약 43% 단축**
- 캐시 히트 시: getGroups(~200ms) + 캐시 읽기(~5ms) = ~200ms

---

### 2.2 URL 캐시 패턴 (PERF-01, REL-01)

`GET /api/bookmarks/urls` 응답을 `chrome.storage.local`에 캐시하여 반복 호출을 방지한다.

```
팝업 오픈
    │
    ▼
chrome.storage.local에서 savedUrlCache 읽기
    │
    ├─ 캐시 유효 (TTL 5분 이내) ──► 캐시 사용 (API 호출 없음)
    │
    └─ 캐시 없음 / 만료
            │
            ▼
        GET /api/bookmarks/urls
            │
            ▼
        chrome.storage.local에 저장
        { urls: [...], cachedAt: Date.now(), ttl: 300_000 }
```

**캐시 무효화 트리거**:
- 북마크 저장 성공 → 즉시 캐시 삭제
- 로그아웃 → 캐시 삭제
- TTL(5분) 만료 → 다음 팝업 오픈 시 갱신

---

### 2.3 번들 최적화 패턴 (PERF-03)

```
빌드 최적화 전략:

TailwindCSS PurgeCSS
    content: ['./src/**/*.{ts,tsx}']
    → 사용하지 않는 CSS 클래스 제거
    → ~3MB → ~10KB 수준으로 감소

Vite production 빌드
    → React 개발 도구 제거
    → Tree-shaking으로 미사용 코드 제거
    → 코드 압축 (terser)

네이티브 API 활용
    → Intl.RelativeTimeFormat (date-fns 대체, ~75KB 절약)
    → 네이티브 Array/Object 메서드 (lodash 대체)
```

---

## 3. 보안 패턴 (Security Patterns)

### 3.1 토큰 생명주기 관리 패턴 (SEC-01, SEC-05, SEC-06)

```
┌─────────────────────────────────────────────────────┐
│              AuthManager 토큰 관리 흐름              │
│                                                     │
│  getValidToken() 호출                               │
│      │                                              │
│      ▼                                              │
│  chrome.storage.local에서 AuthState 읽기            │
│      │                                              │
│      ├─ 토큰 없음 ──► null 반환 (로그인 필요)        │
│      │                                              │
│      ├─ 만료까지 > 60초 ──► accessToken 반환         │
│      │                                              │
│      └─ 만료까지 ≤ 60초 ──► 선제적 갱신 시도         │
│              │                                      │
│              ├─ 성공 ──► 새 accessToken 저장 후 반환 │
│              └─ 실패 ──► null 반환 (로그아웃 처리)   │
└─────────────────────────────────────────────────────┘
```

**토큰 저장 구조** (`chrome.storage.local` key: `'auth'`):
```typescript
{
  accessToken: string,    // Cognito Access Token
  refreshToken: string,   // Cognito Refresh Token (30일)
  idToken: string,        // Cognito ID Token
  expiresAt: number,      // Unix timestamp ms
  userId: string,         // Cognito sub
  email: string
}
```

---

### 3.2 OAuth PKCE 패턴 (SEC-03)

`chrome.identity.launchWebAuthFlow`는 내부적으로 PKCE를 지원한다. Cognito Hosted UI와 연동 시 Authorization Code + PKCE 플로우를 사용한다.

```
Extension                    Cognito Hosted UI
    │                               │
    │── launchWebAuthFlow() ────────►│
    │   (code_challenge 포함)        │
    │                               │
    │◄── redirect with auth_code ───│
    │    (chromiumapp.org로 리다이렉트)│
    │                               │
    │── Token Endpoint POST ────────►│
    │   (code + code_verifier)      │
    │                               │
    │◄── { access, refresh, id } ───│
    │                               │
    │── chrome.storage.local 저장   │
```

---

## 4. 유지보수성 패턴 (Maintainability Patterns)

### 4.1 Mock/Real 전환 패턴 (MAINT-03)

환경변수 `VITE_USE_MOCK`으로 Mock과 Real API를 전환한다. 인터페이스는 동일하게 유지하여 전환 시 컴포넌트 코드 변경 없음.

```
api-client.ts
    │
    ├─ VITE_USE_MOCK=true
    │       │
    │       └─► mockHandlers (src/mocks/)
    │               ├─ getGroups() → 하드코딩 Mock 데이터
    │               ├─ postBookmark() → 성공 응답 시뮬레이션
    │               └─ getRecentBookmarks() → Mock 목록
    │
    └─ VITE_USE_MOCK=false
            │
            └─► axios client (실제 API 호출)
```

**Mock 데이터 구조**:
```
src/mocks/
├── data/
│   ├── groups.mock.ts      # 샘플 그룹 목록
│   ├── bookmarks.mock.ts   # 샘플 북마크 목록
│   └── urls.mock.ts        # 샘플 저장된 URL 목록
└── handlers.ts             # Mock 핸들러 함수들
```

---

### 4.2 에러 표준화 패턴 (MAINT-01)

모든 에러를 표준화된 형태로 변환하여 컴포넌트에서 일관되게 처리한다.

```typescript
// 에러 타입 계층
class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode?: number
  ) { super(message) }
}

class OfflineError extends AppError {
  constructor() { super('OFFLINE', '오프라인 상태입니다') }
}

class AuthError extends AppError {
  constructor() { super('AUTH_REQUIRED', '로그인이 필요합니다', 401) }
}

class ApiError extends AppError {
  constructor(statusCode: number, message: string) {
    super('API_ERROR', message, statusCode)
  }
}
```

**에러 → 토스트 변환** (Zustand store):
```typescript
// 컴포넌트에서
try {
  await apiClient.postBookmark(draft)
} catch (error) {
  if (error instanceof OfflineError) {
    showToast('오프라인 상태입니다', 'error')
  } else if (error instanceof ApiError) {
    showToast(error.message, 'error')
  } else {
    showToast('알 수 없는 오류가 발생했습니다', 'error')
  }
}
```
