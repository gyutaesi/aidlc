# Logical Components — Unit 3: Chrome Extension

> **Unit**: Chrome Extension  
> **작성일**: 2026-05-20

---

## 1. 논리 컴포넌트 전체 구조

```
┌─────────────────────────────────────────────────────────────┐
│                    Chrome Extension                         │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                   Popup UI Layer                    │   │
│  │  App → [SavePage | RecentList | Recommend]          │   │
│  │         Toast (전역)                                │   │
│  └──────────────────────┬──────────────────────────────┘   │
│                         │ useAppStore (Zustand)             │
│  ┌──────────────────────▼──────────────────────────────┐   │
│  │                  Application Layer                  │   │
│  │  ┌─────────────┐  ┌──────────────┐  ┌───────────┐  │   │
│  │  │ AuthManager │  │  ApiClient   │  │TopSites   │  │   │
│  │  │             │  │  (axios)     │  │Recommender│  │   │
│  │  └──────┬──────┘  └──────┬───────┘  └─────┬─────┘  │   │
│  └─────────┼────────────────┼────────────────┼─────────┘   │
│            │                │                │             │
│  ┌─────────▼────────────────▼────────────────▼─────────┐   │
│  │                 Infrastructure Layer                │   │
│  │  chrome.storage.local  │  HTTPS API  │  chrome APIs │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. 논리 컴포넌트 상세

### 2.1 AppStore (Zustand)

**역할**: 전역 상태 관리. 컴포넌트 간 공유 상태와 이벤트 전파 담당.

**위치**: `src/store/useAppStore.ts`

```typescript
interface AppStore {
  // 인증 상태
  authState: AuthState | null
  setAuthState: (state: AuthState | null) => void

  // URL 캐시 (추천 필터링 + 중복 감지)
  savedUrls: string[]
  setSavedUrls: (urls: string[]) => void
  invalidateSavedUrls: () => void   // 저장 성공 시 캐시 무효화

  // 그룹 목록 (저장 탭 드롭다운)
  groups: Group[]
  setGroups: (groups: Group[]) => void

  // 토스트 알림 (3초 자동 소멸 — showToast 내부에서 setTimeout으로 처리)
  toast: Toast | null
  showToast: (message: string, type: ToastType) => void  // 내부에서 3초 후 clearToast 자동 호출
  clearToast: () => void
}
```

```typescript
// store/useAppStore.ts
const useAppStore = create<AppStore>((set, get) => ({
  // ...
  showToast: (message, type) => {
    set({ toast: { message, type } })
    // 3초 후 자동 소멸 (UX-04) — Toast 컴포넌트가 아닌 store에서 관리
    setTimeout(() => {
      // 현재 토스트가 동일한 메시지일 때만 소멸 (연속 토스트 방지)
      if (get().toast?.message === message) {
        set({ toast: null })
      }
    }, 3000)
  },
  clearToast: () => set({ toast: null }),
}))
```

**의존 관계**:
- UI 컴포넌트 → AppStore (읽기/쓰기)
- ApiClient → AppStore (토큰 갱신 실패 시 setAuthState(null))
- AuthManager → AppStore (로그인/로그아웃 시 setAuthState)

---

### 2.2 AuthManager

**역할**: Cognito 인증 전체 생명주기 관리.

**위치**: `src/auth-manager.ts`

**인터페이스**:
```typescript
interface IAuthManager {
  // Cognito Hosted UI OAuth 플로우
  login(): Promise<AuthState>

  // 로그아웃 + chrome.storage.local 정리
  logout(): Promise<void>

  // 유효한 토큰 반환 (만료 60초 전 선제적 갱신)
  getValidToken(): Promise<string | null>

  // Refresh Token으로 Access Token 갱신
  refreshToken(): Promise<string | null>

  // chrome.storage.local에서 AuthState 읽기
  getAuthState(): Promise<AuthState | null>
}
```

**내부 흐름**:
```
getValidToken()
    │
    ▼
chrome.storage.local 읽기
    │
    ├─ 없음 → null
    ├─ 만료까지 > 60s → accessToken 반환
    └─ 만료까지 ≤ 60s → refreshToken() 호출
            │
            ├─ 성공 → 새 토큰 저장 + 반환
            └─ 실패 → logout() + null 반환
```

**chrome.storage.local 키**:
- `'auth'` → `AuthState` 객체

---

### 2.3 ApiClient

**역할**: 모든 HTTP 통신의 단일 진입점. axios 기반 인터셉터 체인으로 횡단 관심사 처리.

**위치**: `src/api-client.ts`

**인터셉터 체인**:
```
Request Interceptors (순서대로 실행):
  1. OfflineCheck    → navigator.onLine 체크
  2. TokenAttach     → AuthManager.getValidToken() → Authorization 헤더

Response Interceptors (에러 시 실행):
  1. TokenRefresh    → 401 시 refreshToken() 후 재시도
  2. GetRetry        → GET + 네트워크/5xx 시 500ms 후 1회 재시도
  3. ErrorNormalize  → AxiosError → AppError 변환
```

**API 메서드**:
```typescript
interface IApiClient {
  // 북마크
  postBookmark(draft: BookmarkDraft): Promise<void>
  getRecentBookmarks(limit: number): Promise<RecentBookmark[]>
  getSavedUrls(): Promise<string[]>

  // 그룹
  getGroups(): Promise<Group[]>
}
```

**Mock 분기**:
```typescript
// VITE_USE_MOCK=true 시 실제 axios 호출 대신 mockHandlers 사용
const apiClient: IApiClient = import.meta.env.VITE_USE_MOCK === 'true'
  ? mockApiClient
  : realApiClient
```

---

### 2.4 TopSitesRecommender

**역할**: `chrome.topSites` API와 SavedUrlCache를 결합하여 추천 목록 생성.

**위치**: `src/top-sites.ts`

**인터페이스**:
```typescript
interface ITopSitesRecommender {
  // savedUrls에 없는 topSites 상위 N개 반환
  getRecommendations(savedUrls: string[], limit: number): Promise<RecommendedSite[]>
}
```

**내부 흐름**:
```
chrome.topSites.get()
    │
    ├─ 실패 → [] 반환 (에러 throw 안 함, graceful)
    │
    └─ 성공 → topSites 배열
            │
            ▼
        filter(site => !savedUrls.includes(site.url))
            │
            ▼
        slice(0, limit)  // 상위 5개
            │
            ▼
        RecommendedSite[] 반환
```

---

### 2.5 SavedUrlCache

**역할**: `GET /api/bookmarks/urls` 응답을 `chrome.storage.local`에 캐시. TTL 기반 유효성 관리.

**위치**: `src/saved-url-cache.ts` (유틸리티 모듈)

**인터페이스**:
```typescript
interface ISavedUrlCache {
  // 캐시 읽기 (만료 시 null 반환)
  get(): Promise<string[] | null>

  // 캐시 저장 (TTL 5분)
  set(urls: string[]): Promise<void>

  // 캐시 즉시 삭제
  invalidate(): Promise<void>
}
```

**chrome.storage.local 키**: `'savedUrlCache'`
```typescript
{
  urls: string[],
  cachedAt: number,   // Date.now()
  ttl: 300_000        // 5분
}
```

---

## 3. 컴포넌트 간 의존성

```
Popup UI
  ├── useAppStore          (Zustand 전역 상태)
  ├── ApiClient            (HTTP 통신)
  ├── AuthManager          (인증)
  └── TopSitesRecommender  (추천)

ApiClient
  ├── AuthManager          (토큰 획득)
  └── useAppStore          (토큰 갱신 실패 시 로그아웃)

AuthManager
  ├── chrome.storage.local (토큰 영속)
  └── chrome.identity      (OAuth 플로우)

TopSitesRecommender
  └── chrome.topSites      (방문 사이트)

SavedUrlCache
  └── chrome.storage.local (캐시 영속)
```

---

## 4. 데이터 흐름 요약

### 팝업 초기화
```
App mount
  → AuthManager.getAuthState()
  → 로그인 상태면 Promise.allSettled([
      ApiClient.getGroups(),        // 실패해도 다른 초기화 계속 진행
      SavedUrlCache.get() || ApiClient.getSavedUrls()
    ])
    ├─ groups 성공 → AppStore.setGroups(groups)
    ├─ groups 실패 → AppStore.setGroups([]) (드롭다운 빈 상태, 저장은 가능)
    ├─ savedUrls 성공 → AppStore.setSavedUrls(urls)
    └─ savedUrls 실패 → AppStore.setSavedUrls([]) (중복 감지 건너뜀, 저장 허용)
  → chrome.tabs.query() → BookmarkDraft 초기값 설정
  → 중복 감지: AppStore.savedUrls.includes(currentUrl)
```

### 북마크 저장
```
SavePage 저장 버튼
  → ApiClient.postBookmark(draft)
  → 성공: AppStore.invalidateSavedUrls() → window.close()
  → 실패: AppStore.showToast(errorMessage, 'error')
```

### 추천 탭 로드
```
Recommend 탭 활성화
  → TopSitesRecommender.getRecommendations(AppStore.savedUrls, 5)
  → RecommendedSite[] 렌더링
```

---

## 5. 파일 구조 (논리 컴포넌트 기준)

```
extension/src/
├── store/
│   └── useAppStore.ts          # Zustand 전역 스토어
├── auth-manager.ts             # AuthManager
├── api-client.ts               # ApiClient (axios + interceptors)
├── top-sites.ts                # TopSitesRecommender
├── saved-url-cache.ts          # SavedUrlCache 유틸리티
├── errors.ts                   # AppError, OfflineError, AuthError, ApiError
├── mocks/
│   ├── data/
│   │   ├── groups.mock.ts
│   │   ├── bookmarks.mock.ts
│   │   └── urls.mock.ts
│   └── handlers.ts
└── popup/
    ├── App.tsx
    ├── SavePage.tsx
    ├── RecentList.tsx
    ├── Recommend.tsx
    └── components/
        ├── TabBar.tsx
        ├── Header.tsx
        ├── Toast.tsx
        └── LoginScreen.tsx
```
