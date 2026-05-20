# Infrastructure Design — Unit 3: Chrome Extension

> **Unit**: Chrome Extension  
> **작성일**: 2026-05-20

---

## 1. 인프라 개요

Chrome Extension은 **클라이언트 전용 유닛**이다. 별도의 서버, 데이터베이스, 메시징 인프라가 없으며, 브라우저가 런타임 환경 전체를 담당한다.

| 인프라 카테고리 | 상태 | 내용 |
|----------------|------|------|
| Compute | N/A | 브라우저 런타임 (Chrome) |
| Database | 브라우저 내장 | `chrome.storage.local` |
| Messaging/Queue | N/A | 불필요 |
| CDN | N/A | Extension 파일은 로컬 설치 |
| Load Balancer | N/A | 불필요 |
| Networking | 외부 의존 | moaring API + Cognito (HTTPS) |
| Monitoring | 최소 | `console.error` (MVP) |
| CI/CD | 없음 (MVP) | 로컬 빌드 + Developer mode 수동 로드 |

---

## 2. 외부 인프라 의존성

Extension이 직접 소유하지 않지만 런타임에 의존하는 외부 인프라:

### 2.1 moaring API 서버 (Unit 2 소유)

| 항목 | 내용 |
|------|------|
| 환경 | 개발: Mock API (`VITE_USE_MOCK=true`) / 운영: `https://api.moaring.com` |
| 프로토콜 | HTTPS (운영) |
| 인증 | Cognito JWT — `Authorization: Bearer <access_token>` |
| CORS | `chrome-extension://<extension-id>` origin 허용 필요 (Unit 2 설정) |
| 사용 API | `POST /api/bookmarks`, `GET /api/bookmarks/recent`, `GET /api/bookmarks/urls`, `GET /api/groups` |

### 2.2 Amazon Cognito (Unit 1 소유)

| 항목 | 내용 |
|------|------|
| 서비스 | Amazon Cognito User Pool |
| 인증 플로우 | Authorization Code + PKCE |
| Hosted UI URL | `https://<cognito-domain>.auth.<region>.amazoncognito.com` |
| Token Endpoint | `https://<cognito-domain>.auth.<region>.amazoncognito.com/oauth2/token` |
| Redirect URI | `https://<extension-id>.chromiumapp.org/` |
| App Client 설정 | Redirect URI 등록 필요, Client Secret 없음 (Public Client) |

---

## 3. 로컬 스토리지 인프라

### 3.1 chrome.storage.local

Extension의 유일한 영속 스토리지.

| Key | 타입 | 용도 | TTL |
|-----|------|------|-----|
| `auth` | `AuthState` | 인증 토큰 (accessToken, refreshToken, idToken, expiresAt) | Refresh Token 만료까지 (~30일) |
| `savedUrlCache` | `SavedUrlCache` | 저장된 URL 목록 캐시 | 5분 (TTL 기반 소프트 만료) |

**용량 제한**: `chrome.storage.local`은 기본 10MB 제한. 현재 사용량은 수 KB 수준으로 제한에 걸리지 않음.

---

## 4. Extension ID 관리

### 4.1 manifest.json `key` 필드로 ID 고정

Extension ID는 `manifest.json`의 `key` 필드로 고정한다. ID가 변경되면 Cognito redirect URI 재등록이 필요하므로, 개발 초기부터 고정하는 것이 안전하다.

**key 생성 방법**:
```bash
# 1. 개인키 생성
openssl genrsa 2048 | openssl pkcs8 -topk8 -nocrypt -out key.pem

# 2. 공개키 추출 후 base64 인코딩 → manifest.json의 key 값으로 사용
openssl rsa -in key.pem -pubout -outform DER | openssl base64 -A
```

**manifest.json 적용**:
```json
{
  "manifest_version": 3,
  "name": "moaring",
  "key": "<base64-encoded-public-key>",
  ...
}
```

**Extension ID 확인**: `chrome://extensions/` → Extension 카드의 ID 필드

### 4.2 환경별 Cognito redirect URI

| 환경 | redirect_uri |
|------|-------------|
| 개발 (key 고정) | `https://<fixed-extension-id>.chromiumapp.org/` |
| 프로덕션 (Web Store) | `https://<store-extension-id>.chromiumapp.org/` |

두 URI 모두 Cognito App Client의 허용 redirect URI 목록에 등록 필요.

---

## 5. 빌드 환경

### 5.1 환경 파일

```
extension/
├── .env.development    # VITE_USE_MOCK=true, VITE_API_BASE_URL=http://localhost:3000
├── .env.production     # VITE_USE_MOCK=false, VITE_API_BASE_URL=https://api.moaring.com
└── .env.example        # 커밋용 템플릿 (실제 값 없음)
```

**.env.development**:
```
VITE_USE_MOCK=true
VITE_API_BASE_URL=https://api.moaring.com
VITE_COGNITO_DOMAIN=<cognito-domain>
VITE_COGNITO_CLIENT_ID=<app-client-id>
VITE_COGNITO_REGION=ap-northeast-2
```

**.env.production**:
```
VITE_USE_MOCK=false
VITE_API_BASE_URL=https://api.moaring.com
VITE_COGNITO_DOMAIN=<cognito-domain>
VITE_COGNITO_CLIENT_ID=<app-client-id>
VITE_COGNITO_REGION=ap-northeast-2
```

### 5.2 빌드 명령

```bash
# 개발 빌드 (Mock API, localhost)
npm run build:dev

# 프로덕션 빌드 (Real API)
npm run build

# 개발 서버 (HMR — Extension 팝업 개발용)
npm run dev
```

**package.json scripts**:
```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build --mode production",
    "build:dev": "vite build --mode development",
    "preview": "vite preview"
  }
}
```

---

## 6. 배포 절차 (MVP — Developer mode)

```
1. 빌드
   $ npm run build:dev   (개발) 또는
   $ npm run build       (프로덕션)
   → extension/dist/ 생성

2. Chrome에 로드
   chrome://extensions/ → "개발자 모드" ON
   → "압축해제된 확장 프로그램을 로드합니다"
   → extension/dist/ 폴더 선택

3. 업데이트 시
   → 코드 수정 후 npm run build 재실행
   → chrome://extensions/ → 새로고침(↺) 버튼 클릭
```

---

## 7. Post-MVP 인프라 전환 계획

| 항목 | MVP | Post-MVP |
|------|-----|----------|
| 배포 방식 | Developer mode | Chrome Web Store 정식 배포 |
| CI/CD | 없음 | GitHub Actions (빌드 + zip + Store 업로드) |
| 모니터링 | console.error | Sentry Extension SDK |
| Extension ID | key 필드 고정 | Web Store가 ID 고정 |
