# Tech Stack Decisions — Unit 3: Chrome Extension

> **Unit**: Chrome Extension  
> **작성일**: 2026-05-20

---

## 확정된 기술 스택

| 레이어 | 기술 | 버전 | 결정 근거 |
|--------|------|------|-----------|
| UI 프레임워크 | React | 18.x | MV3 환경 검증, Next.js 앱과 일관성 |
| 언어 | TypeScript | 5.x | 프로젝트 전체 TypeScript 통일 |
| TS 설정 | strict: false | — | 빠른 개발 우선, 안정화 후 전환 예정 |
| 빌드 도구 | Vite + vite-plugin-web-extension | latest | MV3 자동 처리, HMR, 빠른 빌드 |
| 스타일 | TailwindCSS | 3.x | Next.js 앱과 동일, PurgeCSS로 번들 최적화 |
| 패키지 매니저 | npm | — | 모노레포 루트와 동일 |
| Extension 표준 | Manifest V3 | — | Chrome 현행 표준 |
| 인증 | chrome.identity.launchWebAuthFlow | — | MV3 표준 OAuth 패턴 |
| 토큰 저장 | chrome.storage.local | — | Extension 격리 보장 |
| 상태 관리 | Zustand | 4.x | 컴포넌트 간 이벤트 전파(토스트, savedUrls 공유), 인터셉터 패턴 지원, ~3KB gzip |
| HTTP 클라이언트 | axios | 1.x | 인터셉터로 토큰 갱신/재시도 로직 분리, 타임아웃 옵션 내장, ~13KB gzip |

---

## 의존성 목록 (예상)

### 프로덕션 의존성
```json
{
  "axios": "^1.7.0",
  "react": "^18.3.0",
  "react-dom": "^18.3.0",
  "zustand": "^4.5.0"
}
```

### 개발 의존성
```json
{
  "@types/chrome": "^0.0.268",
  "@types/react": "^18.3.0",
  "@types/react-dom": "^18.3.0",
  "@vitejs/plugin-react": "^4.3.0",
  "autoprefixer": "^10.4.0",
  "postcss": "^8.4.0",
  "tailwindcss": "^3.4.0",
  "typescript": "^5.5.0",
  "vite": "^5.4.0",
  "vite-plugin-web-extension": "^4.1.0"
}
```

**의존성 원칙**: 구현 복잡도 감소 효과가 번들 크기 증가보다 클 때 라이브러리를 채택. 아래 항목은 네이티브 API로 대체:
- `date-fns` → `Intl.RelativeTimeFormat` (상대 시간 표시, ~75KB 절약)
- `lodash` → 네이티브 JS 메서드

---

## 주요 기술 결정 상세

### 1. Vite + vite-plugin-web-extension 선택

**선택 이유**:
- MV3 `manifest.json` 자동 파싱 및 멀티 엔트리포인트 처리
- 팝업, 서비스 워커, 콘텐츠 스크립트를 별도 번들로 자동 분리
- HMR(Hot Module Replacement)로 개발 생산성 향상
- Webpack 대비 설정 코드 80% 감소

**vite.config.ts 기본 구조**:
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import webExtension from 'vite-plugin-web-extension'

export default defineConfig({
  plugins: [
    react(),
    webExtension({
      manifest: './public/manifest.json',
    }),
  ],
})
```

---

### 2. React 18 선택 (19 미선택)

**선택 이유**:
- MV3 Service Worker 환경에서 React 18 안정성 검증 완료
- React 19의 `use()` hook, Server Components 등 신기능은 Extension 팝업에 불필요
- Unit 2 (Next.js 앱)와 React 버전 일치로 공유 타입/유틸 재사용 용이

---

### 3. TypeScript strict: false 선택

**선택 이유**: 빠른 MVP 개발 우선

**전환 로드맵**:
1. MVP 완성 후 `noImplicitAny: true` 먼저 활성화
2. 이후 `strictNullChecks: true` 활성화
3. 최종적으로 `strict: true` 전환

---

### 4. 상태 관리 — Zustand 채택

**선택 이유**:
- `savedUrls`가 SavePage(중복 감지)와 Recommend(필터링) 두 곳에서 공유 필요
- 토스트 알림은 어느 컴포넌트에서든 트리거 가능해야 함
- 저장 성공 시 RecentList 갱신 등 컴포넌트 간 이벤트 전파 필요
- Zustand ~3KB gzip — 1MB 번들 제한의 0.3%, 복잡도 감소 효과가 훨씬 큼

**스토어 구조**:
```typescript
// store/useAppStore.ts
interface AppStore {
  // 인증
  authState: AuthState | null
  setAuthState: (state: AuthState | null) => void

  // 캐시
  savedUrls: string[]
  setSavedUrls: (urls: string[]) => void

  // 그룹
  groups: Group[]
  setGroups: (groups: Group[]) => void

  // 토스트
  toast: { message: string; type: 'error' | 'success' | 'info' } | null
  showToast: (message: string, type: 'error' | 'success' | 'info') => void
  clearToast: () => void
}
```

---

### 6. axios 채택 (fetch 미사용)

**선택 이유**:
- `api-client.ts`에서 구현해야 할 로직: 타임아웃, 401 토큰 갱신 재시도, GET 1회 재시도, 오프라인 감지, 에러 표준화, Mock 분기
- fetch로 직접 구현 시 `api-client.ts`가 복잡한 래퍼로 비대해짐
- axios 인터셉터로 토큰 갱신(request interceptor)과 재시도(response interceptor) 로직을 깔끔하게 분리 가능
- 타임아웃을 `timeout: 3000` 옵션 하나로 처리 (fetch는 AbortController + setTimeout 조합 필요)
- ~13KB gzip — 1MB 번들 제한의 1.3%, 구현 복잡도 감소 효과가 훨씬 큼

**인터셉터 구조**:
```typescript
// api-client.ts
const client = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 3000,
})

// Request: 토큰 자동 첨부
client.interceptors.request.use(async (config) => {
  const token = await AuthManager.getValidToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Response: 401 시 토큰 갱신 후 재시도
client.interceptors.response.use(null, async (error) => {
  if (error.response?.status === 401 && !error.config._retry) {
    error.config._retry = true
    await AuthManager.refreshToken()
    return client(error.config)
  }
  throw error
})
```

**선택 이유**: 모노레포 루트와 동일한 패키지 매니저 사용으로 일관성 유지

**모노레포 워크스페이스 설정** (루트 `package.json`):
```json
{
  "workspaces": [
    "app",
    "extension",
    "infra"
  ]
}
```

---

## 미채택 기술 및 이유

| 기술 | 미채택 이유 |
|------|-------------|
| React 19 | MV3 환경 호환성 미검증, 신기능 불필요 |
| Webpack | 설정 복잡도 높음, Vite 대비 빌드 속도 느림 |
| Parcel | MV3 지원 성숙도 낮음 |
| Redux | 번들 크기 과도 (~30KB), Zustand로 충분 |
| MSW | MV3 Service Worker 환경에서 설정 복잡 |
| Sentry | MVP 수준에서 과도, 사용자 증가 후 추가 예정 |
| fetch + AbortController | 타임아웃/재시도/인터셉터 직접 구현 시 복잡도 과도 |
| TypeScript strict: true | 빠른 개발 우선, 안정화 후 전환 예정 |
| connect-src CSP 제한 | MVP에서는 기본 MV3 CSP로 충분, Web Store 배포 시 추가 |

---

## Post-MVP 기술 전환 계획

| 항목 | 현재 (MVP) | Post-MVP |
|------|-----------|----------|
| TypeScript | strict: false | strict: true (단계적 전환) |
| CSP | 기본 MV3 | connect-src 도메인 명시 |
| 에러 트래킹 | console.error | Sentry 연동 |
| 배포 | Developer mode | Chrome Web Store |
| 인증 | Cognito Hosted UI | 소셜 로그인 추가 (Google OAuth) |
