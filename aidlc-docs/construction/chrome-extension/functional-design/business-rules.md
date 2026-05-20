# Business Rules — Unit 3: Chrome Extension

> **Unit**: Chrome Extension  
> **작성일**: 2026-05-20

---

## 1. 인증 규칙

### BR-AUTH-01: 팝업 진입 시 인증 상태 확인
- 팝업이 열릴 때 `AuthState.isLoggedIn`을 확인한다
- 로그인 상태가 아니면 "로그인 필요" 화면을 표시하고, 저장/추천/최근 탭을 렌더링하지 않는다

### BR-AUTH-02: Access Token 만료 감지
- API 호출 전 `AuthState.expiresAt`을 현재 시각과 비교한다
- 만료됐거나 만료까지 60초 미만이면 Refresh Token으로 선제적 갱신을 시도한다
- API 호출 후 401 응답을 받으면 Refresh Token으로 갱신 후 원래 요청을 1회 재시도한다

### BR-AUTH-03: Refresh Token 만료 처리
- Refresh Token으로 갱신 시도가 실패하면 `AuthState`를 초기화(로그아웃)하고 "로그인 필요" 화면으로 전환한다

### BR-AUTH-04: 로그인 플로우
- 로그인 버튼 클릭 시 `chrome.identity.launchWebAuthFlow`로 Cognito Hosted UI를 팝업으로 연다
- OAuth 콜백에서 Authorization Code를 추출하여 Cognito Token Endpoint에 교환 요청한다
- 성공 시 `AuthState`를 `chrome.storage.local`에 저장한다

### BR-AUTH-05: 로그아웃
- 로그아웃 시 `chrome.storage.local`의 `auth` 키를 삭제한다
- `savedUrlCache`도 함께 삭제한다

---

## 2. 북마크 저장 규칙

### BR-SAVE-01: 현재 탭 정보 자동 주입
- 팝업이 열릴 때 `chrome.tabs.query({ active: true, currentWindow: true })`로 현재 탭의 URL과 title을 가져와 `BookmarkDraft`에 자동 주입한다
- URL이 `http://` 또는 `https://`로 시작하지 않으면 저장 버튼을 비활성화한다 (chrome://, file:// 등 저장 불가)

### BR-SAVE-02: 중복 저장 감지
- `BookmarkDraft.url`이 `SavedUrlCache.urls`에 포함되어 있으면 "이미 저장됨" 상태로 표시한다
- "이미 저장됨" 상태에서는 저장 버튼 대신 "웹앱에서 보기" 링크를 표시한다
- 캐시가 없거나 만료된 경우 중복 감지를 건너뛰고 저장을 허용한다 (false negative 허용)

### BR-SAVE-03: 태그 파싱
- 태그 입력 필드의 값을 쉼표(`,`)로 분리하여 배열로 변환한다
- 각 태그는 앞뒤 공백을 제거(trim)한다
- 빈 문자열 태그는 제거한다
- 최대 태그 수 제한 없음 (서버에서 처리)

### BR-SAVE-04: 저장 요청
- `POST /api/bookmarks`에 `{ url, title, memo, tagNames, groupId }` 전송한다
- `groupId`가 null이면 요청 바디에서 제외한다 (서버가 인박스로 처리)
- 저장 중에는 저장 버튼을 비활성화하고 로딩 상태를 표시한다

### BR-SAVE-05: 저장 성공 처리
- 저장 성공(201) 시 `SavedUrlCache`를 즉시 무효화한다
- 팝업을 자동으로 닫는다 (`window.close()`)

### BR-SAVE-06: 저장 실패 처리
- 저장 실패 시 토스트 알림으로 에러 메시지를 표시한다
- 팝업은 닫히지 않고 사용자가 재시도할 수 있도록 유지한다
- 401 에러는 BR-AUTH-02 토큰 갱신 후 재시도 로직이 먼저 처리한다

---

## 3. 추천 규칙

### BR-REC-01: TopSites 조회
- "추천" 탭이 활성화될 때 `chrome.topSites.get()`을 호출한다
- `SavedUrlCache`가 유효하면 캐시를 사용하고, 만료됐으면 `GET /api/bookmarks/urls`를 호출하여 갱신한다

### BR-REC-02: 필터링
- `chrome.topSites`에서 반환된 URL 중 `SavedUrlCache.urls`에 포함된 URL을 제외한다
- URL 비교는 정확한 문자열 일치(exact match)로 한다 (trailing slash 등 정규화 없음)
- 필터링 후 최대 5개를 표시한다

### BR-REC-03: 추천 사이트 저장
- 추천 목록의 사이트를 클릭하면 해당 URL과 title을 "저장" 탭의 `BookmarkDraft`에 채우고 "저장" 탭으로 전환한다

---

## 4. URL 캐시 규칙

### BR-CACHE-01: 캐시 유효성 검사
- `SavedUrlCache.cachedAt + ttl > Date.now()`이면 유효한 캐시로 간주한다
- TTL 기본값: 300,000ms (5분)

### BR-CACHE-02: 캐시 무효화
- 북마크 저장 성공 시 즉시 `savedUrlCache`를 `chrome.storage.local`에서 삭제한다
- 로그아웃 시 `savedUrlCache`를 삭제한다

### BR-CACHE-03: 캐시 갱신
- 캐시가 없거나 만료된 경우 `GET /api/bookmarks/urls`를 호출하여 새 캐시를 저장한다

---

## 5. 에러 처리 규칙

### BR-ERR-01: 네트워크 에러
- `fetch` 실패(네트워크 오류) 시 토스트로 "네트워크 오류가 발생했습니다" 메시지를 표시한다

### BR-ERR-02: 서버 에러 (5xx)
- 서버 에러 시 토스트로 "서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요" 메시지를 표시한다

### BR-ERR-03: 클라이언트 에러 (4xx, 401 제외)
- 400 에러 시 서버 응답의 `error` 필드를 토스트로 표시한다
- 403 에러 시 "접근 권한이 없습니다" 메시지를 표시한다

### BR-ERR-04: chrome.tabs 접근 불가
- `chrome.tabs.query` 실패 시 URL/title 필드를 빈 값으로 초기화하고 사용자가 직접 입력하도록 한다

### BR-ERR-05: chrome.topSites 접근 불가
- `chrome.topSites.get()` 실패 시 추천 탭에 "추천 사이트를 불러올 수 없습니다" 메시지를 표시한다

---

## 6. 탭 네비게이션 규칙

### BR-NAV-01: 기본 탭
- 팝업이 열릴 때 기본 활성 탭은 "저장" 탭이다

### BR-NAV-02: 탭 순서
- 탭 순서: 저장 → 최근 → 추천

### BR-NAV-03: 추천에서 저장으로 전환
- 추천 사이트 클릭 시 해당 URL/title을 저장 폼에 채우고 "저장" 탭으로 자동 전환한다
