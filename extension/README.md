# moaring Chrome Extension

moaring 북마크 매니저의 Chrome Extension (Unit 3)

## 기능

- 현재 페이지를 빠르게 moaring에 저장
- 그룹/태그/메모와 함께 저장
- 자주 방문하지만 미저장 사이트 추천 (`chrome.topSites` 기반)
- 최근 저장 북마크 목록 표시
- Cognito Hosted UI 기반 OAuth 로그인 (PKCE)

## 기술 스택

- React 18 + TypeScript (strict: false)
- Vite + vite-plugin-web-extension
- Manifest V3
- TailwindCSS
- Zustand (전역 상태)
- axios (HTTP 클라이언트, 인터셉터 체인)

## 개발 환경 설정

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경변수 설정

`.env.example`을 복사하여 `.env.development` 또는 `.env.production`을 만듭니다.

```bash
cp .env.example .env.development
```

| 변수 | 설명 |
|------|------|
| `VITE_USE_MOCK` | `true`이면 Mock API 사용, `false`이면 실제 API |
| `VITE_API_BASE_URL` | moaring API 서버 URL |
| `VITE_COGNITO_DOMAIN` | Cognito 도메인 prefix (Unit 1 배포 후 입력) |
| `VITE_COGNITO_CLIENT_ID` | Cognito App Client ID |
| `VITE_COGNITO_REGION` | Cognito 리전 (기본: `ap-northeast-2`) |
| `VITE_WEBAPP_URL` | 웹앱 URL (이미 저장된 북마크 → 웹앱 보기 링크) |

### 3. 빌드

```bash
# 개발 빌드 (Mock API)
npm run build:dev

# 프로덕션 빌드 (실제 API)
npm run build

# 개발 서버 (HMR)
npm run dev

# 타입 체크
npm run typecheck
```

### 4. Chrome에 로드

1. `chrome://extensions/` 열기
2. 우측 상단 "개발자 모드" 활성화
3. "압축해제된 확장 프로그램을 로드합니다" 클릭
4. `extension/dist/` 폴더 선택

코드 변경 후에는 `npm run build`를 다시 실행하고, `chrome://extensions/`에서 새로고침(↺) 버튼을 클릭합니다.

## 프로젝트 구조

```
extension/
├── public/
│   ├── manifest.json       # MV3 매니페스트
│   └── icons/              # 아이콘 (16/48/128px)
└── src/
    ├── types.ts            # 공통 도메인 타입
    ├── errors.ts           # AppError 계층
    ├── auth-manager.ts     # Cognito PKCE 인증
    ├── api-client.ts       # axios + 인터셉터 (Mock/Real 분기)
    ├── top-sites.ts        # chrome.topSites 추천
    ├── saved-url-cache.ts  # URL 캐시 (TTL 5분)
    ├── service-worker.ts   # MV3 Service Worker (최소)
    ├── store/
    │   └── useAppStore.ts  # Zustand 전역 상태
    ├── mocks/              # Mock API
    │   ├── data/
    │   └── handlers.ts
    └── popup/
        ├── popup.html
        ├── main.tsx
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

## Cognito 설정 요구사항

Unit 1 (Infrastructure) 팀에 다음 설정을 요청해야 합니다.

```
App Client 유형: Public Client (Client Secret 없음)
인증 플로우: AUTHORIZATION_CODE
PKCE: 필수 (S256)

허용 Callback URL:
  - https://<extension-id>.chromiumapp.org/

OAuth Scopes: openid, email, profile
Hosted UI: 활성화 필요
```

Extension ID는 `chrome://extensions/`에서 확인 가능합니다.
프로덕션 배포 전에는 `manifest.json`의 `key` 필드를 추가하여 ID를 고정하세요.

## API 의존성 (Unit 2)

| 메서드 | 엔드포인트 | 용도 |
|--------|-----------|------|
| POST | `/api/bookmarks` | 북마크 저장 |
| GET | `/api/bookmarks/recent` | 최근 저장 목록 |
| GET | `/api/bookmarks/urls` | 저장된 URL 목록 (캐시용) |
| GET | `/api/groups` | 그룹 목록 |

**CORS 요구사항** (Unit 2 설정):
`Access-Control-Allow-Origin: chrome-extension://<extension-id>` 허용 필요.

## 개발 모드 (Mock API)

`VITE_USE_MOCK=true`로 빌드하면 모든 API 호출이 `src/mocks/handlers.ts`의 Mock 데이터로 대체됩니다.
Unit 2 API 미완성 상태에서도 Extension UI를 독립적으로 개발/테스트할 수 있습니다.

## 빌드 산출물

`npm run build` 후 `extension/dist/`에 다음 파일이 생성됩니다.

- `manifest.json`
- `popup.html` + 번들된 JS/CSS
- `service-worker.js`
- `icons/`

번들 크기 목표: **1MB 이하** (PERF-03)
