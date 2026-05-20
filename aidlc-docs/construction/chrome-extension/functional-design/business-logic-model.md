# Business Logic Model — Unit 3: Chrome Extension

> **Unit**: Chrome Extension  
> **작성일**: 2026-05-20

---

## 1. 핵심 비즈니스 흐름

### 1.1 팝업 초기화 흐름

```
[팝업 오픈]
    |
    v
[AuthManager.getAuthState()]
    |
    ├── 미로그인 → [LoginScreen 렌더링] → 종료
    |
    └── 로그인 상태
            |
            v
    [병렬 실행]
    ├── chrome.tabs.query() → BookmarkDraft.url, title 주입
    ├── SavedUrlCache 유효성 확인
    │       ├── 유효 → 캐시 사용
    │       └── 만료/없음 → GET /api/bookmarks/urls → 캐시 저장
    └── GET /api/groups → 그룹 목록 로드 (저장 탭 드롭다운용)
            |
            v
    [BookmarkDraft.url이 SavedUrlCache.urls에 있는지 확인]
    ├── 있음 → "이미 저장됨" 상태로 저장 탭 렌더링
    └── 없음 → 일반 저장 폼 렌더링
            |
            v
    [팝업 UI 표시 — 기본 탭: "저장"]
```

---

### 1.2 북마크 저장 흐름

```
[사용자: 저장 버튼 클릭]
    |
    v
[입력 유효성 검사]
    ├── URL이 http/https가 아님 → 저장 버튼 비활성 (이미 막혀 있음)
    └── 유효
            |
            v
[태그 파싱: "tag1, tag2" → ["tag1", "tag2"]]
    |
    v
[AuthManager.getValidToken()]
    ├── 유효한 토큰 → 사용
    └── 만료 → Cognito Token Endpoint로 갱신
            ├── 갱신 성공 → 새 토큰 사용
            └── 갱신 실패 → 로그아웃 처리 → LoginScreen
                    |
                    v
[POST /api/bookmarks { url, title, memo, tagNames, groupId }]
    ├── 201 성공
    │       ├── SavedUrlCache 즉시 무효화
    │       └── window.close() (팝업 닫힘)
    ├── 401 → 토큰 갱신 후 1회 재시도
    └── 그 외 에러 → 토스트 알림 표시, 팝업 유지
```

---

### 1.3 추천 탭 로드 흐름

```
["추천" 탭 클릭]
    |
    v
[SavedUrlCache 유효성 확인]
    ├── 유효 → 캐시의 urls 사용
    └── 만료/없음 → GET /api/bookmarks/urls → 캐시 저장
            |
            v
[chrome.topSites.get()]
    ├── 성공 → topSites 목록
    └── 실패 → "추천 사이트를 불러올 수 없습니다" 표시 → 종료
            |
            v
[필터링: topSites에서 SavedUrlCache.urls에 있는 URL 제외]
    |
    v
[상위 5개 RecommendedSite 표시]
```

---

### 1.4 추천 사이트 → 저장 전환 흐름

```
[추천 사이트 항목 클릭]
    |
    v
[BookmarkDraft.url = site.url]
[BookmarkDraft.title = site.title]
    |
    v
["저장" 탭으로 전환]
    |
    v
[BR-SAVE-02: 중복 감지 재확인]
    ├── 이미 저장됨 → "이미 저장됨" 상태 표시
    └── 미저장 → 저장 폼 표시 (url, title 채워진 상태)
```

---

### 1.5 토큰 자동 갱신 흐름

```
[API 호출 전 또는 401 응답 수신]
    |
    v
[AuthState.refreshToken 존재 여부 확인]
    ├── 없음 → 로그아웃 처리
    └── 있음
            |
            v
    [Cognito Token Endpoint POST]
    [grant_type=refresh_token, refresh_token=...]
            |
            ├── 성공 → AuthState 업데이트 (새 accessToken, expiresAt)
            │           → chrome.storage.local 저장
            │           → 원래 API 요청 재시도
            └── 실패 → AuthState 초기화 → LoginScreen 전환
```

---

## 2. 컴포넌트별 책임 분리

### ExtensionAuthManager (auth-manager.ts)
- `chrome.storage.local` 읽기/쓰기 (AuthState)
- `chrome.identity.launchWebAuthFlow` 호출
- Cognito Token Endpoint 통신 (로그인, 토큰 갱신)
- 토큰 만료 감지 및 선제적 갱신

### ExtensionApiClient (api-client.ts)
- 모든 API 호출의 단일 진입점
- `AuthManager.getValidToken()` 호출 후 Authorization 헤더 첨부
- 401 응답 시 토큰 갱신 후 1회 재시도
- Mock 모드 지원 (`VITE_USE_MOCK` 환경변수)
- 에러를 표준화된 형태로 throw

### TopSitesRecommender (top-sites.ts)
- `chrome.topSites.get()` 호출
- `SavedUrlCache`와 비교하여 미등록 사이트 필터링
- 상위 N개 반환

### ExtensionPopup (popup/App.tsx)
- 인증 상태에 따른 화면 분기 (LoginScreen vs MainTabs)
- 팝업 초기화 시 병렬 데이터 로드 조율
- 탭 상태 관리

---

## 3. Mock API 전략

`VITE_USE_MOCK=true` 환경에서 `api-client.ts`는 실제 fetch 대신 Mock 데이터를 반환한다.

```typescript
// api-client.ts 내부 구조
const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

async function postBookmark(draft: BookmarkDraft): Promise<void> {
  if (USE_MOCK) {
    await delay(300)  // 네트워크 지연 시뮬레이션
    return mockBookmarks.create(draft)
  }
  return realApi.postBookmark(draft)
}
```

**Mock 데이터 파일**: `src/mocks/` 디렉토리에 위치  
**전환 방법**: `.env.development`에서 `VITE_USE_MOCK=true` → `.env.production`에서 `VITE_USE_MOCK=false`

---

## 4. 상태 관리 전략

Extension 팝업은 단순한 단일 페이지 앱이므로 별도 상태 관리 라이브러리 없이 React `useState` + `useEffect`로 관리한다.

| 상태 | 위치 | 설명 |
|------|------|------|
| `authState` | `App.tsx` useState | 로그인 여부, 토큰 |
| `activeTab` | `App.tsx` useState | 현재 활성 탭 |
| `draft` | `SavePage.tsx` useState | 저장 폼 입력값 |
| `groups` | `SavePage.tsx` useState | 그룹 목록 |
| `recentList` | `RecentList.tsx` useState | 최근 저장 목록 |
| `recommendations` | `Recommend.tsx` useState | 추천 사이트 목록 |
| `savedUrls` | `chrome.storage.local` | URL 캐시 (영속) |
