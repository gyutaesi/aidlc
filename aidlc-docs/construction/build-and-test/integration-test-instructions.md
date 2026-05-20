# Integration Test Instructions — moaring

> **상태**: Unit 1, Unit 2 미구현으로 통합 테스트 보류  
> **작성일**: 2026-05-20

---

## 현재 상태

Unit 3 (Chrome Extension)만 구현되어 있어요. 통합 테스트는 실제로 통합할 다른 Unit이 있어야 의미가 있으니, 아래는 향후 모든 Unit이 완료된 시점의 통합 테스트 시나리오를 정의해 두는 거예요.

---

## 통합 테스트 범위

### Unit 3 ↔ Unit 2 (Next.js API)

Extension과 백엔드 API 간의 인터페이스 검증.

| 시나리오 | 호출 흐름 | 검증 항목 |
|---------|----------|-----------|
| 북마크 저장 | Extension → POST /api/bookmarks | 200 응답, DB에 레코드 생성 |
| 최근 목록 조회 | Extension → GET /api/bookmarks/recent | 5개 이내 응답, 정렬 검증 |
| 저장된 URL 조회 | Extension → GET /api/bookmarks/urls | 저장한 URL 포함 |
| 그룹 목록 조회 | Extension → GET /api/groups | user_id별 격리 |
| 토큰 만료 갱신 | Extension → 401 → refresh → 재시도 | refresh interceptor 동작 |
| CORS | Extension origin → API | `chrome-extension://*` 허용 |

### Unit 3 ↔ Unit 1 (Cognito)

Cognito OAuth 플로우 검증.

| 시나리오 | 호출 흐름 | 검증 항목 |
|---------|----------|-----------|
| PKCE 로그인 | Extension → Hosted UI → 토큰 교환 | code_verifier 검증, JWT 수신 |
| Refresh Token | Extension → Token Endpoint (refresh_token) | 새 access_token 수신 |
| 로그아웃 | Extension → chrome.storage.local 삭제 | 토큰 제거 확인 |

---

## 사전 조건

```
[ ] Unit 1 (CDK) AWS 배포 완료
[ ] Cognito User Pool + App Client 프로비저닝 완료
[ ] Cognito App Client에 Extension redirect URI 등록
[ ] Unit 2 (Next.js App) 배포 완료 (api.moaring.com 도달 가능)
[ ] Extension의 .env.production 작성 (실제 Cognito 값 입력)
[ ] Extension 프로덕션 빌드 (npm run build)
```

---

## 통합 테스트 환경 설정

### 1. AWS 리소스 배포 (Unit 1 완료 후)

```bash
cd infra
npx cdk deploy --all
```

### 2. Next.js 앱 배포 (Unit 2 완료 후)

```bash
cd app
docker build -t moaring-app .
# ECR push + ECS 업데이트
```

### 3. Extension 빌드 + 로드

```bash
cd extension
# .env.production에 실제 Cognito 값 입력
npm run build
# Chrome Developer mode에서 dist/ 로드
```

---

## 통합 테스트 시나리오 상세

### 시나리오 1: 신규 사용자 가입 → 북마크 저장 (E2E)

**목적**: 전체 사용자 여정 검증

**스텝**:
1. Cognito Hosted UI에서 신규 계정 가입 (이메일 인증 코드 입력)
2. Chrome Extension 팝업 열기 → 로그인 버튼 클릭
3. Cognito Hosted UI 팝업 → 방금 가입한 계정으로 로그인
4. Extension 팝업이 "저장" 탭으로 자동 전환
5. 그룹 선택 (인박스 기본) + 태그 입력 + 메모 입력
6. "저장하기" 버튼 클릭
7. 팝업 자동 닫힘 → 웹앱(`moaring.com`)에서 인박스 확인

**기대 결과**:
- DB에 `users`, `bookmarks` 레코드 생성
- chrome.storage.local에 `auth` 키 저장
- 응답 시간 200~500ms 이내

---

### 시나리오 2: 토큰 자동 갱신

**목적**: REL-03 (401 토큰 갱신 재시도) 검증

**스텝**:
1. Cognito Access Token 유효기간을 5분으로 임시 단축 (테스트용)
2. 로그인 → Extension에서 6분 대기
3. "최근" 탭 클릭 → API 호출

**기대 결과**:
- 첫 요청 401 → AuthManager.refreshToken() 자동 호출
- 새 access_token 저장 → 원래 요청 재시도 성공
- 사용자에게 보이는 에러 없음

---

### 시나리오 3: 추천 → 저장 흐름

**목적**: FR-07-3, FR-07-4 검증

**스텝**:
1. Chrome에서 자주 방문하는 사이트 5개 이상 확보 (`chrome.topSites` 데이터)
2. Extension 팝업 열기 → "추천" 탭
3. 미저장 사이트 중 하나의 "저장" 버튼 클릭
4. "저장" 탭으로 자동 전환, URL/title 자동 입력
5. 저장 버튼 클릭

**기대 결과**:
- DB에 해당 URL 저장
- 다음 팝업 오픈 시 추천 목록에서 해당 URL 제외됨 (필터링)

---

### 시나리오 4: 중복 저장 방지

**목적**: BR-SAVE-02 (중복 저장 감지) 검증

**스텝**:
1. 이미 저장된 URL을 가진 페이지를 Chrome에서 열기
2. Extension 팝업 열기

**기대 결과**:
- "저장" 탭에 "이미 저장된 페이지입니다" 배너 표시
- 저장 폼 숨김
- "웹앱에서 보기" 링크 제공

---

### 시나리오 5: 오프라인 처리

**목적**: REL-04 (오프라인 감지) 검증

**스텝**:
1. 네트워크 연결 차단 (Wi-Fi off)
2. Extension 팝업 열기 → 저장 시도

**기대 결과**:
- API 호출 시 즉시 OfflineError 발생
- 토스트 알림: "오프라인 상태입니다"
- 3초 후 토스트 자동 소멸

---

## 자동화 도구 권장

E2E 자동화는 향후 다음 도구로 구현 권장:

- **Playwright** — Chrome Extension 자동화 지원
- **Puppeteer** — `--load-extension` 플래그로 Extension 로드 가능

`data-testid` 속성이 모든 인터랙티브 요소에 추가되어 있어 셀렉터 작성이 용이합니다.

---

## 통합 테스트 정리 (Cleanup)

```bash
# 테스트 데이터 정리 (Unit 2 완료 후)
psql $DATABASE_URL -c "DELETE FROM bookmarks WHERE user_id = '<test-user-id>';"
psql $DATABASE_URL -c "DELETE FROM users WHERE email = '<test-email>';"

# Cognito 테스트 사용자 삭제
aws cognito-idp admin-delete-user --user-pool-id <pool-id> --username <test-email>
```
