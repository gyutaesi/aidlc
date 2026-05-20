# Code Generation Summary — Unit 3: Chrome Extension

> **Unit**: Chrome Extension  
> **작성일**: 2026-05-20  
> **코드 위치**: `extension/` (워크스페이스 루트)

---

## 생성된 파일 (35개)

### 프로젝트 설정 (10개)
- `extension/package.json` — 의존성 (axios, react, zustand) + 스크립트
- `extension/tsconfig.json` — TypeScript 설정 (strict: false)
- `extension/vite.config.ts` — Vite + vite-plugin-web-extension
- `extension/tailwind.config.js` — TailwindCSS 설정
- `extension/postcss.config.js` — PostCSS + autoprefixer
- `extension/.env.development` — Mock 모드
- `extension/.env.production` — 실제 API 모드
- `extension/.env.example` — 템플릿
- `extension/.gitignore`
- `extension/public/manifest.json` — MV3 매니페스트

### 진입점 (3개)
- `extension/src/popup/popup.html` — 팝업 HTML (360px × 600px max)
- `extension/src/popup/main.tsx` — React 진입점
- `extension/src/popup/styles.css` — TailwindCSS 진입점
- `extension/src/service-worker.ts` — MV3 Service Worker (최소)

### 도메인 / 유틸 (3개)
- `extension/src/types.ts` — AuthState, Group, BookmarkDraft 등
- `extension/src/errors.ts` — AppError 계층 (Offline/Auth/Api/Network/Timeout)

### 애플리케이션 레이어 (5개)
- `extension/src/auth-manager.ts` — Cognito PKCE 로그인, 토큰 갱신
- `extension/src/api-client.ts` — axios + 인터셉터 (오프라인/토큰/재시도)
- `extension/src/top-sites.ts` — chrome.topSites + 필터링
- `extension/src/saved-url-cache.ts` — chrome.storage.local TTL 캐시
- `extension/src/store/useAppStore.ts` — Zustand 전역 상태

### Mock 데이터 (4개)
- `extension/src/mocks/data/groups.mock.ts`
- `extension/src/mocks/data/bookmarks.mock.ts`
- `extension/src/mocks/data/urls.mock.ts`
- `extension/src/mocks/handlers.ts` — IApiClient Mock 구현

### UI 컴포넌트 (8개)
- `extension/src/popup/App.tsx` — 루트, 병렬 초기화 (Promise.allSettled)
- `extension/src/popup/SavePage.tsx` — 저장 폼 + 중복 감지
- `extension/src/popup/RecentList.tsx` — 최근 5개 (상대 시간)
- `extension/src/popup/Recommend.tsx` — 추천 5개 + 저장 탭 전환
- `extension/src/popup/components/LoginScreen.tsx`
- `extension/src/popup/components/Header.tsx` — 로그아웃 메뉴
- `extension/src/popup/components/TabBar.tsx` — 저장/최근/추천
- `extension/src/popup/components/Toast.tsx` — 에러/성공 알림

### 문서 (1개)
- `extension/README.md`
- `extension/public/icons/README.md` — 아이콘 placeholder

---

## FR 매핑

| FR | 구현 위치 |
|----|-----------|
| FR-07-1 (현재 페이지 저장) | `SavePage.tsx` + `api-client.postBookmark` |
| FR-07-2 (그룹 미선택 시 인박스) | `SavePage.tsx` selectedGroupId='' |
| FR-07-3 (topSites 추천) | `top-sites.ts` + `Recommend.tsx` |
| FR-07-4 (원클릭 추천 저장) | `Recommend.tsx` onSelectSite → SavePage |
| FR-07-5 (AI 추천) | Post-MVP, 미구현 |
| FR-07-6 (최근 저장 목록) | `RecentList.tsx` |
| FR-07-7 (Cognito 로그인) | `auth-manager.ts` PKCE |
| FR-07-8 (MV3 매니페스트) | `public/manifest.json` |

---

## 적용된 NFR 패턴

| 패턴 | 위치 |
|------|------|
| 401 토큰 갱신 재시도 (`_retryAuth`) | `api-client.ts` response interceptor |
| GET 1회 재시도 (`_retryNetwork`) | `api-client.ts` response interceptor |
| POST 재시도 없음 | `api-client.ts` response interceptor |
| 오프라인 감지 (`navigator.onLine`) | `api-client.ts` request interceptor |
| 병렬 초기화 (`Promise.allSettled`) | `App.tsx` useEffect |
| URL 캐시 TTL 5분 | `saved-url-cache.ts` |
| 토큰 선제적 갱신 (60초 전) | `auth-manager.ts` getValidToken |
| PKCE 직접 구현 | `auth-manager.ts` generateCodeVerifier/Challenge |
| 토스트 3초 자동 소멸 (동일 메시지 가드) | `useAppStore.ts` showToast |
| Mock/Real 전환 (`VITE_USE_MOCK`) | `api-client.ts` 단일 export |
| 에러 표준화 (`AppError` 계층) | `errors.ts` + `normalizeError` |
| Graceful Degradation | `top-sites.ts`, `App.tsx` chrome.tabs catch |
| `data-testid` 자동화 친화 | 모든 UI 컴포넌트 |

---

## 다음 단계

1. **의존성 설치 + 빌드 검증**: `npm install` → `npm run build:dev`
2. **Chrome 로드 + Mock 동작 확인**: `dist/` 폴더 → Developer mode 로드
3. **Cognito 설정 입력**: Unit 1 배포 후 `.env`에 `VITE_COGNITO_*` 입력
4. **Build and Test 단계**: 모든 Unit 완료 후 통합 빌드/테스트
