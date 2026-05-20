# Functional Design Plan — Unit 3: Chrome Extension

> **Unit**: Chrome Extension  
> **단계**: Construction Phase > Functional Design  
> **작성일**: 2026-05-20

---

## 실행 체크리스트

- [x] Step 1: Unit 컨텍스트 분석 (unit-of-work.md, application-design 아티팩트 검토)
- [x] Step 2: 아래 질문에 대한 답변 수집
- [x] Step 3: Functional Design 아티팩트 생성
  - [x] business-logic-model.md
  - [x] business-rules.md
  - [x] domain-entities.md
  - [x] frontend-components.md

---

## 질문 (Functional Design 명확화)

Unit 3 Chrome Extension의 Functional Design을 위해 아래 질문에 답변해 주세요.

---

### Q1. 팝업 UI 진입 시 인증 상태 처리

Extension 팝업을 열었을 때 로그인이 안 된 상태라면 어떻게 처리할까요?

A) 팝업 내에서 바로 로그인 폼 표시 (이메일/비밀번호 입력)  
B) "로그인 필요" 메시지 + 버튼 클릭 시 Cognito Hosted UI 팝업 오픈  
C) 팝업 내에서 로그인 폼 표시하되, Cognito Hosted UI로 리다이렉트  
D) Other (please describe after [Answer]: tag below)

> 💡 **추천: B**  
> Chrome Extension 팝업은 크기가 작아 로그인 폼을 직접 넣으면 UX가 좋지 않아요. Cognito Hosted UI를 별도 팝업으로 여는 방식이 보안상으로도 안전하고 (비밀번호를 Extension 코드가 직접 다루지 않음), 구현도 단순해요. `chrome.identity.launchWebAuthFlow`와 자연스럽게 연결됩니다.

[Answer]: B

---

### Q2. Cognito 인증 방식

Chrome Extension에서 Cognito 인증을 어떻게 구현할까요?

A) Cognito Hosted UI — `chrome.identity.launchWebAuthFlow`로 OAuth 팝업 열기  
B) Cognito User Pools API 직접 호출 — 팝업 내 이메일/비밀번호 폼으로 `InitiateAuth` 호출  
C) Other (please describe after [Answer]: tag below)

> 💡 **추천: A**  
> Hosted UI + `launchWebAuthFlow`는 Chrome Extension의 표준 OAuth 패턴이에요. Extension 코드가 사용자 비밀번호를 직접 다루지 않아 보안상 우수하고, Cognito 설정만으로 소셜 로그인 추가도 가능해요. MV3 환경에서 `fetch`로 Cognito API를 직접 호출하면 CORS 이슈가 생길 수 있어서 A가 더 안정적입니다.

[Answer]: A

---

### Q3. 토큰 갱신 전략

`chrome.storage.local`에 저장된 Access Token이 만료됐을 때 처리 방식은?

A) Refresh Token으로 자동 갱신 (사용자 개입 없음)  
B) 만료 시 로그아웃 처리 후 재로그인 요청  
C) Other (please describe after [Answer]: tag below)

> 💡 **추천: A**  
> Extension은 백그라운드에서 조용히 동작해야 해요. 팝업을 열 때마다 재로그인을 요구하면 UX가 크게 떨어집니다. Cognito의 Refresh Token 유효기간은 기본 30일이라 자동 갱신이 현실적이에요. API 호출 시 401 응답을 받으면 Refresh Token으로 갱신 후 재시도하는 패턴이 표준입니다.

[Answer]: A

---

### Q4. 팝업 탭 구조

팝업 UI의 탭/화면 구성을 어떻게 할까요?

A) 단일 화면 — 저장 폼 + 추천 + 최근 목록을 스크롤로 표시  
B) 탭 3개 — "저장" / "추천" / "최근" 탭으로 분리  
C) 기본 화면은 저장 폼, 하단에 추천과 최근 목록을 접을 수 있는 섹션으로 표시  
D) Other (please describe after [Answer]: tag below)

> 💡 **추천: B**  
> Extension 팝업은 높이 제한이 있어서 스크롤이 많아지면 불편해요. 탭으로 분리하면 각 기능에 집중할 수 있고, 필요한 탭만 열면 되니 깔끔합니다. "저장" 탭이 기본으로 열리면 가장 자주 쓰는 동작에 바로 접근 가능해요.

[Answer]: B (탭으로 분리하되, 탭 순서는 "저장", "최근", "추천" 순서로 구현)

---

### Q5. 현재 페이지 저장 시 메타데이터 처리

팝업에서 현재 탭 URL을 저장할 때 제목/설명/썸네일은 어떻게 가져올까요?

A) Extension이 `chrome.tabs` API로 현재 탭 제목만 가져오고, 나머지 메타데이터는 서버(MetadataService)가 처리  
B) Extension의 Content Script가 페이지 OG 태그를 직접 읽어서 팝업으로 전달  
C) 팝업에서 URL만 서버로 전송하고, 서버가 모든 메타데이터 fetch  
D) Other (please describe after [Answer]: tag below)

> 💡 **추천: A**  
> `chrome.tabs`로 제목을 가져오면 이미 로드된 페이지 정보를 즉시 활용할 수 있어요. 나머지 OG 태그(설명, 썸네일)는 서버의 MetadataService가 처리하는 게 자연스럽습니다 — 서버는 이미 이 기능을 갖추고 있고, Content Script를 추가하면 manifest 권한이 늘어나 Extension 심사가 복잡해져요. C는 서버가 방화벽 뒤 내부 페이지를 fetch할 수 없는 경우 실패할 수 있어요.

[Answer]: A

---

### Q6. 저장 시 그룹 선택

북마크 저장 시 그룹 선택 UI는?

A) 드롭다운으로 그룹 선택 (기본값: 인박스)  
B) 그룹 선택 없이 항상 인박스로 저장 (Extension에서는 그룹 선택 불필요)  
C) 저장 후 별도 단계에서 그룹 이동 가능하도록 안내  
D) Other (please describe after [Answer]: tag below)

> 💡 **추천: A**  
> 인박스가 기본값이라 B와 거의 동일하게 빠르게 저장할 수 있으면서, 자주 쓰는 그룹이 있는 사용자는 바로 분류할 수 있어요. `GET /api/groups`는 이미 Extension API 스펙에 포함되어 있어서 추가 구현 비용이 없습니다.

[Answer]: A

---

### Q7. 태그 입력

저장 시 태그 입력 기능을 팝업에 포함할까요?

A) 포함 — 태그 입력 필드 제공 (자동완성 없이 단순 입력)  
B) 포함 — 태그 자동완성 포함 (`GET /api/tags?prefix=` 호출)  
C) 미포함 — Extension에서는 태그 없이 저장, 웹앱에서 나중에 추가  
D) Other (please describe after [Answer]: tag below)

> 💡 **추천: A**  
> 태그는 북마크 분류에 유용하지만, 팝업에서 자동완성까지 구현하면 API 호출이 늘어나고 UX가 복잡해져요. 단순 입력 필드로 쉼표 구분 입력을 받는 것이 팝업의 빠른 저장 목적에 맞습니다. 자동완성은 웹앱에서 충분히 제공되니 Extension에서는 단순하게 가는 게 좋아요.

[Answer]: A

---

### Q8. 추천 목록 (TopSites) 표시 개수 및 필터링

`chrome.topSites`에서 가져온 사이트 중 몇 개를 추천으로 표시할까요?

A) 최대 5개  
B) 최대 10개  
C) 최대 3개  
D) Other (please describe after [Answer]: tag below)

> 💡 **추천: A**  
> `chrome.topSites`는 최대 20개를 반환하는데, 이미 저장된 URL을 필터링하면 실제 표시 개수는 더 줄어요. 5개는 팝업 높이 안에서 스크롤 없이 보여줄 수 있는 적당한 수이고, 10개는 너무 많아 스크롤이 필요해집니다.

[Answer]: A

---

### Q9. 이미 저장된 URL 필터링 방식

추천 목록에서 이미 저장된 URL을 제외하기 위해 `GET /api/bookmarks/urls`를 언제 호출할까요?

A) 팝업 열릴 때마다 매번 호출  
B) 팝업 열릴 때 호출하되, `chrome.storage.local`에 5분간 캐시  
C) Service Worker에서 주기적으로 백그라운드 갱신 (팝업 열릴 때는 캐시 사용)  
D) Other (please describe after [Answer]: tag below)

> 💡 **추천: B**  
> A는 팝업을 열 때마다 API를 호출해서 느릴 수 있어요. C는 MV3 Service Worker가 언제든 종료될 수 있어서 주기적 갱신이 불안정합니다. B는 5분 캐시로 대부분의 경우 빠르게 응답하면서, 방금 저장한 URL도 다음 팝업 오픈 시 반영돼요. 북마크 저장 성공 시 캐시를 즉시 무효화하면 더 정확해집니다.

[Answer]: B

---

### Q10. 최근 저장 목록 표시 개수

팝업의 "최근 저장" 목록에 몇 개를 표시할까요?

A) 최근 5개  
B) 최근 10개  
C) 최근 3개  
D) Other (please describe after [Answer]: tag below)

> 💡 **추천: A**  
> 최근 저장 목록은 "내가 뭘 저장했지?" 빠르게 확인하는 용도예요. 5개면 팝업 안에서 스크롤 없이 볼 수 있고, 더 보고 싶으면 웹앱으로 이동하면 됩니다. 10개는 팝업이 너무 길어지고, 3개는 너무 적어요.

[Answer]: A

---

### Q11. 현재 탭 URL이 이미 저장된 경우 처리

팝업을 열었을 때 현재 탭 URL이 이미 저장된 북마크라면?

A) "이미 저장됨" 표시 + 저장 버튼 비활성화  
B) "이미 저장됨" 표시 + 해당 북마크로 이동하는 링크 제공  
C) 별도 처리 없이 중복 저장 허용  
D) Other (please describe after [Answer]: tag below)

> 💡 **추천: B**  
> 단순히 버튼을 막는 것보다 "이미 저장됨 — 웹앱에서 보기" 링크를 제공하면 사용자가 기존 북마크를 바로 편집하러 갈 수 있어요. Q9의 URL 캐시를 활용하면 추가 API 호출 없이 구현 가능합니다.

[Answer]: B

---

### Q12. 메모 입력

저장 시 메모(memo) 입력 필드를 팝업에 포함할까요?

A) 포함 — 간단한 텍스트 입력 필드  
B) 미포함 — Extension에서는 메모 없이 저장, 웹앱에서 나중에 추가  
C) Other (please describe after [Answer]: tag below)

> 💡 **추천: A**  
> 메모는 "왜 저장했는지" 맥락을 남기는 핵심 기능이에요. 저장하는 순간이 메모를 남기기 가장 좋은 타이밍이고, 단순 textarea 하나라 구현 비용도 낮습니다. 나중에 웹앱에서 추가하는 건 번거로워서 실제로 잘 안 하게 돼요.

[Answer]: A

---

### Q13. Mock API 전략

Unit 3는 Mock API로 먼저 개발 후 실제 API로 교체하는 전략입니다. Mock 구현 방식은?

A) `api-client.ts`에 `USE_MOCK` 환경변수 플래그로 Mock/Real 전환  
B) 별도 `api-client.mock.ts` 파일로 분리, 빌드 시 교체  
C) MSW(Mock Service Worker)로 네트워크 레벨 Mock  
D) Other (please describe after [Answer]: tag below)

> 💡 **추천: A**  
> 환경변수 플래그 방식이 가장 단순하고 전환이 쉬워요. `VITE_USE_MOCK=true`로 개발하다가 실제 API 준비되면 `false`로 바꾸면 끝입니다. B는 빌드 설정이 복잡해지고, C는 MV3 Service Worker 환경에서 MSW 설정이 까다로워요.

[Answer]: A

---

### Q14. Extension 팝업 크기 및 스타일

팝업 UI의 크기와 스타일 방향은?

A) 고정 너비 360px, TailwindCSS 사용  
B) 고정 너비 400px, TailwindCSS 사용  
C) 고정 너비 320px, TailwindCSS 사용  
D) Other (please describe after [Answer]: tag below)

> 💡 **추천: A**  
> 360px은 Chrome Extension 팝업의 사실상 표준 너비예요. 320px은 좁아서 그룹 드롭다운 같은 요소가 잘릴 수 있고, 400px은 화면에서 다소 크게 느껴져요. TailwindCSS는 이미 Next.js 앱에서 사용 중이라 스타일 일관성도 유지됩니다.

[Answer]: A

---

답변 완료 후 "답변완료"라고 알려주세요.

---

## 추가 확인 항목 (검토 중 도출)

### Q15. 저장 성공 후 팝업 동작
[Answer]: B (팝업 자동 닫힘)

### Q16. 팝업 최대 높이
[Answer]: B (내용에 따라 자동, 최대 600px)

### Q17. 로그아웃 기능
[Answer]: A (설정 아이콘 또는 메뉴에 포함)

### Q18. 오프라인 / API 에러 처리
[Answer]: B (토스트 알림으로 표시)
