# Code Generation Plan — Unit 3: Chrome Extension

> **Unit**: Chrome Extension  
> **단계**: Construction Phase > Code Generation  
> **작성일**: 2026-05-20  
> **코드 위치**: `extension/` (워크스페이스 루트 기준)

---

## Unit 컨텍스트

| 항목 | 내용 |
|------|------|
| 구현 FR | FR-07-1 ~ FR-07-8 (Chrome Extension 전체) |
| 기술 스택 | React 18, TypeScript, Vite, MV3, Zustand, axios, TailwindCSS |
| 외부 의존 | moaring API (Unit 2), Amazon Cognito (Unit 1) |
| 개발 전략 | Mock API로 시작 → Unit 1+2 배포 후 실제 API 전환 |
| 코드 위치 | `extension/` (절대 `aidlc-docs/` 아님) |

---

## 구현 스토리 매핑

| Step | FR | 내용 |
|------|----|------|
| Step 4 | FR-07-8 | MV3 manifest.json + 프로젝트 설정 |
| Step 5 | FR-07-7 | AuthManager (Cognito PKCE 로그인, 토큰 관리) |
| Step 6 | FR-07-7 | ApiClient (axios 인터셉터, Mock 전환) |
| Step 7 | FR-07-3 | TopSitesRecommender + SavedUrlCache |
| Step 8 | FR-07-1,2,3,4,6 | Zustand AppStore |
| Step 9 | FR-07-1,2 | SavePage (저장 폼) |
| Step 10 | FR-07-6 | RecentList (최근 저장 목록) |
| Step 11 | FR-07-3,4 | Recommend (추천 목록) |
| Step 12 | FR-07-7 | LoginScreen + Header + TabBar + Toast |
| Step 13 | FR-07-1~8 | App.tsx (루트, 초기화 조율) |
| Step 14 | FR-07-8 | Mock 데이터 + handlers |
| Step 15 | — | 빌드 설정 검증 + README |

---

## 실행 체크리스트

### PART 1 — Planning
- [x] Step 1: 설계 아티팩트 분석 완료
- [x] Step 2: 코드 생성 계획 작성
- [ ] Step 3: 사용자 승인 대기

### PART 2 — Generation

#### Step 4: 프로젝트 구조 설정 (FR-07-8)
- [x] `extension/package.json` 생성
- [x] `extension/tsconfig.json` 생성
- [x] `extension/vite.config.ts` 생성
- [x] `extension/tailwind.config.js` 생성
- [x] `extension/postcss.config.js` 생성
- [x] `extension/.env.development` 생성
- [x] `extension/.env.production` 생성
- [x] `extension/.env.example` 생성
- [x] `extension/public/manifest.json` 생성
- [x] `extension/public/icons/` 플레이스홀더 생성
- [x] `extension/src/popup/popup.html` 생성
- [x] `extension/src/popup/main.tsx` 생성
- [x] `extension/src/service-worker.ts` 생성
- [x] `extension/src/types.ts` 생성 (공통 타입)
- [x] `extension/src/errors.ts` 생성

#### Step 5: AuthManager (FR-07-7)
- [x] `extension/src/auth-manager.ts` 생성
  - `login()` — PKCE 생성 + launchWebAuthFlow + Token Endpoint 교환
  - `logout()` — chrome.storage.local 정리
  - `getValidToken()` — 만료 60초 전 선제적 갱신
  - `refreshToken()` — Cognito Token Endpoint refresh_token grant
  - `getAuthState()` — chrome.storage.local 읽기

#### Step 6: ApiClient (FR-07-1,2,3,4,6,7)
- [x] `extension/src/api-client.ts` 생성
  - axios 인스턴스 (timeout: 3000)
  - Request interceptor: 오프라인 감지 + 토큰 첨부
  - Response interceptor: 401 재시도(_retryAuth) + GET 재시도(_retryNetwork)
  - `postBookmark()`, `getRecentBookmarks()`, `getSavedUrls()`, `getGroups()`
  - Mock/Real 분기 (`VITE_USE_MOCK`)

#### Step 7: TopSitesRecommender + SavedUrlCache (FR-07-3)
- [x] `extension/src/top-sites.ts` 생성
  - `getRecommendations(savedUrls, limit)` — chrome.topSites + 필터링
- [x] `extension/src/saved-url-cache.ts` 생성
  - `get()`, `set()`, `invalidate()` — chrome.storage.local TTL 캐시

#### Step 8: Zustand AppStore (FR-07-1~8)
- [x] `extension/src/store/useAppStore.ts` 생성
  - authState, savedUrls, groups, toast 슬라이스
  - `showToast()` — 3초 자동 소멸 (setTimeout + 동일 메시지 가드)
  - `invalidateSavedUrls()` — 저장 성공 시 캐시 무효화

#### Step 9: SavePage (FR-07-1, FR-07-2)
- [x] `extension/src/popup/SavePage.tsx` 생성
  - URL/title 자동 주입 (chrome.tabs)
  - AlreadySavedBanner (중복 감지)
  - GroupSelect 드롭다운 (인박스 기본)
  - TagInput (쉼표 구분)
  - MemoInput (textarea)
  - SaveButton (로딩/비활성화 상태)
  - data-testid 속성 추가

#### Step 10: RecentList (FR-07-6)
- [x] `extension/src/popup/RecentList.tsx` 생성
  - GET /api/bookmarks/recent?limit=5
  - 파비콘 + 제목 + URL + 상대 시간 (Intl.RelativeTimeFormat)
  - 클릭 시 새 탭 열기
  - data-testid 속성 추가

#### Step 11: Recommend (FR-07-3, FR-07-4)
- [x] `extension/src/popup/Recommend.tsx` 생성
  - TopSitesRecommender.getRecommendations()
  - 파비콘 + 제목 + URL
  - "저장" 버튼 → SavePage로 전환
  - data-testid 속성 추가

#### Step 12: 공통 UI 컴포넌트 (FR-07-7,8)
- [x] `extension/src/popup/components/LoginScreen.tsx` 생성
- [x] `extension/src/popup/components/Header.tsx` 생성 (설정 메뉴 + 로그아웃)
- [x] `extension/src/popup/components/TabBar.tsx` 생성 (저장/최근/추천)
- [x] `extension/src/popup/components/Toast.tsx` 생성 (AppStore toast 구독)
- [x] data-testid 속성 추가 (모든 인터랙티브 요소)

#### Step 13: App.tsx 루트 컴포넌트 (FR-07-1~8)
- [x] `extension/src/popup/App.tsx` 생성
  - 인증 상태 확인 → LoginScreen / MainLayout 분기
  - Promise.allSettled 병렬 초기화
  - chrome.tabs.query() → currentTabUrl/Title
  - 중복 감지 로직
  - activeTab 상태 관리

#### Step 14: Mock 데이터 + handlers
- [x] `extension/src/mocks/data/groups.mock.ts` 생성
- [x] `extension/src/mocks/data/bookmarks.mock.ts` 생성
- [x] `extension/src/mocks/data/urls.mock.ts` 생성
- [x] `extension/src/mocks/handlers.ts` 생성 (IApiClient 구현)

#### Step 15: 빌드 검증 + 문서
- [x] `extension/README.md` 생성 (개발 환경 설정, 빌드, 로드 방법)
- [x] `aidlc-docs/construction/chrome-extension/code/code-summary.md` 생성

---

## 파일 구조 (생성 예정)

```
extension/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.js
├── .env.development
├── .env.production
├── .env.example
├── README.md
├── public/
│   ├── manifest.json
│   └── icons/
│       ├── icon16.png  (placeholder)
│       ├── icon48.png  (placeholder)
│       └── icon128.png (placeholder)
└── src/
    ├── types.ts
    ├── errors.ts
    ├── auth-manager.ts
    ├── api-client.ts
    ├── top-sites.ts
    ├── saved-url-cache.ts
    ├── service-worker.ts
    ├── store/
    │   └── useAppStore.ts
    ├── mocks/
    │   ├── data/
    │   │   ├── groups.mock.ts
    │   │   ├── bookmarks.mock.ts
    │   │   └── urls.mock.ts
    │   └── handlers.ts
    └── popup/
        ├── main.tsx
        ├── popup.html
        ├── App.tsx
        ├── SavePage.tsx
        ├── RecentList.tsx
        ├── Recommend.tsx
        └── components/
            ├── LoginScreen.tsx
            ├── Header.tsx
            ├── TabBar.tsx
            └── Toast.tsx
```

**총 생성 파일**: 약 35개  
**코드 위치**: `extension/` (워크스페이스 루트)  
**문서 위치**: `aidlc-docs/construction/chrome-extension/code/`
