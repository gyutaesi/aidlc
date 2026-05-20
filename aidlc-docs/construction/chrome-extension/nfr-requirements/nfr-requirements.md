# NFR Requirements — Unit 3: Chrome Extension

> **Unit**: Chrome Extension  
> **작성일**: 2026-05-20

---

## 1. 성능 요구사항 (Performance)

| ID | 요구사항 | 기준값 | 측정 방법 |
|----|----------|--------|-----------|
| PERF-01 | 팝업 초기 로딩 시간 | 500ms 이내 | 팝업 오픈 → UI 인터랙션 가능 상태까지 |
| PERF-02 | API 호출 타임아웃 | 3초 | `AbortController` + `signal` 사용 |
| PERF-03 | 번들 크기 (압축 전) | 1MB 이하 | `vite build` 후 `dist/` 전체 크기 |
| PERF-04 | 병렬 초기화 | 필수 | groups + savedUrls API를 `Promise.all`로 병렬 호출 |

### PERF-01 달성 전략
- 팝업 오픈 시 `Promise.all([getGroups(), getSavedUrlCache()])` 병렬 실행
- 캐시 히트 시 `GET /api/bookmarks/urls` 호출 생략 → 초기화 API 호출 1개로 감소
- React 컴포넌트 코드 스플리팅 불필요 (팝업 단일 진입점)

### PERF-03 달성 전략
- TailwindCSS PurgeCSS 적용 (사용하지 않는 클래스 제거)
- React 18 production 빌드 (개발 도구 제거)
- 외부 라이브러리 최소화 (date-fns 대신 Intl.RelativeTimeFormat 사용 등)

---

## 2. 보안 요구사항 (Security)

| ID | 요구사항 | 구현 방법 |
|----|----------|-----------|
| SEC-01 | 토큰 저장 | `chrome.storage.local` 평문 저장 (Extension 격리 보장) |
| SEC-02 | CSP | 기본 MV3 CSP 적용 (eval 금지, 인라인 스크립트 금지) |
| SEC-03 | OAuth redirect URI | `https://<extension-id>.chromiumapp.org/` (Chrome 표준) |
| SEC-04 | HTTPS 전용 | 모든 API 호출 HTTPS, HTTP 차단 |
| SEC-05 | Access Token 만료 | 만료 60초 전 선제적 갱신 (BR-AUTH-02) |
| SEC-06 | Refresh Token 만료 | 갱신 실패 시 즉시 로그아웃 + 토큰 삭제 (BR-AUTH-03) |

### SEC-01 근거
`chrome.storage.local`은 해당 Extension만 접근 가능하며, 다른 Extension이나 웹페이지에서 읽을 수 없음. Chrome은 OS 키체인과 연동하여 스토리지를 보호함. MVP 수준에서 추가 암호화는 불필요한 복잡도.

### SEC-02 참고
기본 MV3 CSP로 진행하되, Chrome Web Store 정식 배포 시 `connect-src`에 moaring API 도메인을 명시적으로 추가하는 것을 권장 (Post-MVP).

```json
// Post-MVP 권장 CSP (manifest.json)
"content_security_policy": {
  "extension_pages": "script-src 'self'; object-src 'self'; connect-src https://api.moaring.com https://*.cognito.amazonaws.com"
}
```

### SEC-03 구현
```
redirect_uri = https://<extension-id>.chromiumapp.org/
```
- Cognito App Client의 허용 redirect URI에 위 값 등록 필요
- Extension ID는 개발/프로덕션 환경에서 다를 수 있으므로 환경변수로 관리

---

## 3. 신뢰성 요구사항 (Reliability)

| ID | 요구사항 | 구현 방법 |
|----|----------|-----------|
| REL-01 | GET 재시도 | 네트워크 에러 / 5xx 시 1회 재시도 (500ms 딜레이) |
| REL-02 | POST 재시도 없음 | 중복 저장 방지 — 에러 시 즉시 토스트 표시 |
| REL-03 | 401 재시도 | 토큰 갱신 후 원래 요청 1회 재시도 (GET/POST 공통) |
| REL-04 | 오프라인 감지 | `navigator.onLine` 체크 → "오프라인 상태입니다" 즉시 표시 |
| REL-05 | chrome API 실패 | `chrome.tabs`, `chrome.topSites` 실패 시 graceful degradation |

### REL-01/02 재시도 정책 상세

```
GET 요청 (groups, bookmarks/urls, bookmarks/recent):
  1차 시도 → 실패(네트워크/5xx) → 500ms 대기 → 2차 시도 → 실패 → 토스트 에러

POST 요청 (bookmarks 저장):
  1차 시도 → 실패(네트워크/5xx) → 즉시 토스트 에러 (재시도 없음)
  이유: 멱등성 없음, 중복 저장 위험

401 응답 (GET/POST 공통):
  → 토큰 갱신 시도 → 성공 시 원래 요청 재시도 → 실패 시 로그아웃
```

### REL-04 오프라인 감지 구현
```typescript
// api-client.ts 내 공통 처리
if (!navigator.onLine) {
  throw new OfflineError('오프라인 상태입니다')
}
```

### REL-05 Graceful Degradation
- `chrome.tabs` 실패 → URL/title 빈 값, 사용자 직접 입력
- `chrome.topSites` 실패 → 추천 탭에 안내 메시지 표시, 기능 비활성화

---

## 4. 유지보수성 요구사항 (Maintainability)

| ID | 요구사항 | 구현 방법 |
|----|----------|-----------|
| MAINT-01 | 에러 로깅 | `console.error` 사용 (개발자 도구 확인) |
| MAINT-02 | TypeScript | strict: false (빠른 개발 우선) |
| MAINT-03 | Mock 전환 | `VITE_USE_MOCK` 환경변수로 Mock/Real 전환 |
| MAINT-04 | 환경 분리 | `.env.development` / `.env.production` 분리 |

### MAINT-02 참고
strict: false로 시작하되, 코드베이스가 안정화되면 strict: true로 전환 권장. 전환 시 `noImplicitAny`, `strictNullChecks`부터 단계적으로 활성화.

### MAINT-04 환경변수 목록
```
# .env.development
VITE_USE_MOCK=true
VITE_API_BASE_URL=http://localhost:3000

# .env.production
VITE_USE_MOCK=false
VITE_API_BASE_URL=https://api.moaring.com
```

---

## 5. 사용성 요구사항 (Usability)

| ID | 요구사항 | 기준 |
|----|----------|------|
| UX-01 | 팝업 너비 | 360px 고정 |
| UX-02 | 팝업 최대 높이 | 600px (내용에 따라 자동) |
| UX-03 | 로딩 상태 표시 | 모든 비동기 작업에 로딩 인디케이터 |
| UX-04 | 에러 피드백 | 토스트 알림 (3초 자동 소멸) |
| UX-05 | 저장 성공 | 팝업 자동 닫힘 (`window.close()`) |
| UX-06 | 언어 | 한국어 (MVP) |

---

## 6. 호환성 요구사항 (Compatibility)

| ID | 요구사항 | 기준 |
|----|----------|------|
| COMPAT-01 | 최소 Chrome 버전 | Chrome 102 이상 |
| COMPAT-02 | Manifest 버전 | MV3 |
| COMPAT-03 | 배포 방식 | Developer mode (MVP), Chrome Web Store (Post-MVP) |

### COMPAT-01 근거
Chrome 102는 MV3 Service Worker, `chrome.identity`, `chrome.topSites` API가 안정화된 버전. 대부분의 사용자는 자동 업데이트로 최신 버전 사용 중이나, 최소 버전 명시로 호환성 보장.

```json
// manifest.json
"minimum_chrome_version": "102"
```
