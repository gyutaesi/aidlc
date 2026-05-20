# Deployment Architecture — Unit 3: Chrome Extension

> **Unit**: Chrome Extension  
> **작성일**: 2026-05-20

---

## 1. 전체 배포 아키텍처

```
[개발자 로컬 머신]
        |
        | npm run build
        v
[extension/dist/]  ←── Vite 빌드 산출물
        |
        | Chrome Developer mode 로드
        v
[Chrome 브라우저]
        |
        |── chrome.storage.local (토큰, URL 캐시)
        |
        |── HTTPS ──────────────────────────────────────────────────────────►
        |                                                                    |
        |                                              [Amazon Cognito]      |
        |                                              OAuth2 Token Endpoint |
        |                                                                    |
        |── HTTPS ──────────────────────────────────────────────────────────►
                                                                             |
                                                    [moaring API 서버]       |
                                                    (Unit 2 — ECS/Fargate)  |
                                                    localhost:3000 (개발)    |
                                                    api.moaring.com (운영)   |
```

---

## 2. 환경별 배포 구성

### 2.1 개발 환경 (Phase 1 — Mock API)

```
[개발자 로컬]
    |
    ├── extension/
    │   ├── .env.development  (VITE_USE_MOCK=true)
    │   └── dist/             (npm run build:dev)
    |
    └── Chrome (Developer mode)
            |
            └── MockApiClient (실제 네트워크 호출 없음)
                    └── src/mocks/handlers.ts
```

**사용 시점**: Unit 2 API 미완성 단계. Extension 독립 개발 가능.

---

### 2.2 개발 환경 (Phase 2 — 실제 API 연결)

```
[개발자 로컬]
    |
    ├── extension/
    │   ├── .env.development  (VITE_USE_MOCK=false, API_BASE=localhost:3000)
    │   └── dist/
    |
    ├── app/ (Unit 2 Next.js)
    │   └── npm run dev → localhost:3000
    |
    └── Chrome (Developer mode)
            |
            ├── HTTPS → localhost:3000 (moaring API)
            └── HTTPS → Cognito Hosted UI
```

**사용 시점**: Unit 2 핵심 API 완성 후. 실제 인증 + 저장 테스트.

---

### 2.3 운영 환경 (MVP)

```
[개발자 로컬]
    |
    ├── extension/
    │   ├── .env.production  (VITE_USE_MOCK=false, API_BASE=api.moaring.com)
    │   └── dist/            (npm run build)
    |
    └── Chrome (Developer mode — 팀 내 배포)
            |
            ├── HTTPS → api.moaring.com (ECS/Fargate)
            └── HTTPS → Cognito Hosted UI (ap-northeast-2)
```

---

## 3. 빌드 산출물 구조

```
extension/dist/
├── manifest.json           # MV3 매니페스트 (Vite가 처리)
├── popup.html              # 팝업 진입점
├── assets/
│   ├── popup-[hash].js     # 팝업 번들 (React + Zustand + axios)
│   ├── popup-[hash].css    # TailwindCSS (PurgeCSS 적용)
│   └── icons/
│       ├── icon16.png
│       ├── icon48.png
│       └── icon128.png
└── service-worker.js       # MV3 Service Worker (최소 — 현재 기능 없음)
```

**번들 크기 목표**: 전체 1MB 이하 (PERF-03)

---

## 4. manifest.json 구조

```json
{
  "manifest_version": 3,
  "name": "moaring",
  "version": "0.1.0",
  "description": "북마크를 저장하고 공유하세요",
  "key": "<base64-encoded-public-key>",
  "minimum_chrome_version": "102",

  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "assets/icons/icon16.png",
      "48": "assets/icons/icon48.png",
      "128": "assets/icons/icon128.png"
    }
  },

  "background": {
    "service_worker": "service-worker.js",
    "type": "module"
  },

  "permissions": [
    "storage",
    "identity",
    "tabs",
    "topSites"
  ],

  "host_permissions": [
    "http://localhost:3000/*",
    "https://api.moaring.com/*",
    "https://*.amazoncognito.com/*"
  ],

  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self'"
  },

  "oauth2": {
    "client_id": "<cognito-app-client-id>",
    "scopes": ["openid", "email", "profile"]
  }
}
```

**권한 설명**:
| 권한 | 용도 |
|------|------|
| `storage` | `chrome.storage.local` (토큰, URL 캐시) |
| `identity` | `chrome.identity.launchWebAuthFlow` (OAuth) |
| `tabs` | 현재 탭 URL/title 조회 |
| `topSites` | 자주 방문 사이트 추천 |

---

## 5. Cognito App Client 설정 요구사항

Unit 1 (Infrastructure) 팀에 전달할 설정 요구사항:

```
App Client 유형: Public Client (Client Secret 없음)
인증 플로우: AUTHORIZATION_CODE
PKCE: 필수 (S256)

허용 Callback URL:
  - https://<dev-extension-id>.chromiumapp.org/   (개발)
  - https://<prod-extension-id>.chromiumapp.org/  (운영, Web Store 배포 후)

허용 Sign-out URL:
  - https://<dev-extension-id>.chromiumapp.org/

OAuth Scopes:
  - openid
  - email
  - profile

Hosted UI: 활성화 필요
```

---

## 6. 개발 → 운영 전환 체크리스트

```
[ ] manifest.json에 key 필드 추가 (Extension ID 고정)
[ ] Extension ID 확인 후 Cognito App Client redirect URI 등록
[ ] .env.development 작성 (VITE_USE_MOCK=true로 시작)
[ ] npm run build:dev → Chrome Developer mode 로드 확인
[ ] Mock API로 전체 플로우 테스트
[ ] Unit 2 API 준비 후 VITE_USE_MOCK=false로 전환
[ ] localhost:3000 연결 테스트 (인증 + 저장 + 추천)
[ ] .env.production 작성
[ ] npm run build → dist/ 크기 확인 (1MB 이하)
[ ] 운영 환경 E2E 테스트
```
