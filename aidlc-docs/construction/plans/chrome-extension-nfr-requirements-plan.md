# NFR Requirements Plan — Unit 3: Chrome Extension

> **Unit**: Chrome Extension  
> **단계**: Construction Phase > NFR Requirements  
> **작성일**: 2026-05-20

---

## 실행 체크리스트

- [x] Step 1: Functional Design 아티팩트 분석
- [x] Step 2: 아래 질문에 대한 답변 수집
- [x] Step 3: NFR Requirements 아티팩트 생성
  - [x] nfr-requirements.md
  - [x] tech-stack-decisions.md

---

## 질문 (NFR Requirements 명확화)

Unit 3 Chrome Extension의 NFR을 결정하기 위해 아래 질문에 답변해 주세요.

---

### [성능]

### Q1. 팝업 초기 로딩 목표 시간

팝업이 열린 후 UI가 인터랙션 가능한 상태가 되기까지 목표 시간은?

A) 500ms 이내 (빠름)  
B) 1초 이내 (보통)  
C) 2초 이내 (느려도 무방)  
D) Other (please describe after [Answer]: tag below)

> 💡 **추천: A**  
> Extension 팝업은 "빠르게 저장하고 닫는" 도구예요. 1초 이상 걸리면 답답하게 느껴집니다. 초기화 시 병렬 API 호출(groups + savedUrls)로 500ms 이내 달성이 현실적이에요.

[Answer]: A

---

### Q2. API 호출 타임아웃

`api-client.ts`에서 각 API 호출의 타임아웃 설정은?

A) 5초 (기본값)  
B) 3초 (빠른 실패)  
C) 10초 (여유 있게)  
D) Other (please describe after [Answer]: tag below)

> 💡 **추천: B**  
> 팝업은 오래 기다리는 환경이 아니에요. 3초 안에 응답 없으면 에러 처리하고 사용자에게 알리는 게 낫습니다. 서버가 정상이라면 3초는 충분해요.

[Answer]: B

---

### Q3. 번들 크기 목표

빌드 후 Extension 전체 번들 크기 목표는?

A) 1MB 이하  
B) 500KB 이하  
C) 2MB 이하 (제한 없음)  
D) Other (please describe after [Answer]: tag below)

> 💡 **추천: A**  
> Chrome Web Store는 압축 후 10MB 제한이지만, 번들이 클수록 로딩이 느려져요. React + TailwindCSS + 최소 의존성으로 1MB 이하는 충분히 달성 가능합니다. 500KB는 TailwindCSS purge 최적화가 잘 되면 가능하지만 타이트해요.

[Answer]: A

---

### [보안]

### Q4. chrome.storage.local 토큰 저장 방식

Access Token / Refresh Token을 `chrome.storage.local`에 저장할 때 추가 보안 처리가 필요한가요?

A) 평문 저장 (chrome.storage.local 자체가 Extension 격리 보장)  
B) 토큰을 별도 암호화 후 저장  
C) Other (please describe after [Answer]: tag below)

> 💡 **추천: A**  
> `chrome.storage.local`은 해당 Extension만 접근 가능하고, 다른 Extension이나 웹페이지에서 읽을 수 없어요. MVP 수준에서 추가 암호화는 과도한 복잡도입니다. Chrome 자체가 OS 키체인과 연동해 보호하기도 해요.

[Answer]: A

---

### Q5. Content Security Policy (CSP)

`manifest.json`의 CSP 설정 수준은?

A) 기본 MV3 CSP 적용 (eval 금지, 인라인 스크립트 금지)  
B) 추가 제한: `connect-src`를 moaring API 도메인으로 명시적 제한  
C) Other (please describe after [Answer]: tag below)

> 💡 **추천: B**  
> MV3는 기본적으로 엄격한 CSP를 강제하지만, `connect-src`에 허용 도메인을 명시하면 의도치 않은 외부 API 호출을 차단할 수 있어요. 보안 강화 + Chrome Web Store 심사 통과에도 유리합니다.

[Answer]: A

---

### Q6. OAuth redirect URI 보안

`chrome.identity.launchWebAuthFlow` 사용 시 redirect URI는?

A) `https://<extension-id>.chromiumapp.org/` (Chrome 표준 방식)  
B) 커스텀 URL scheme 사용  
C) Other (please describe after [Answer]: tag below)

> 💡 **추천: A**  
> Chrome 표준 방식이에요. Extension ID 기반 URI라 다른 앱이 가로챌 수 없고, Cognito App Client에 이 URI를 등록하면 됩니다. 커스텀 scheme은 추가 설정이 복잡해요.

[Answer]: A

---

### [신뢰성 / 에러 처리]

### Q7. API 재시도 정책

네트워크 에러 또는 5xx 응답 시 자동 재시도를 할까요?

A) 재시도 없음 — 즉시 에러 표시  
B) 1회 재시도 (500ms 딜레이)  
C) 최대 2회 재시도 (지수 백오프)  
D) Other (please describe after [Answer]: tag below)

> 💡 **추천: B**  
> 팝업 특성상 재시도가 너무 많으면 사용자가 기다려야 해요. 401은 토큰 갱신 후 재시도(이미 설계됨), 네트워크/5xx는 1회만 재시도하고 실패 시 토스트로 알리는 게 적절합니다.

[Answer]: D(GET은 1회 재시도, POST는 없음.)

---

### Q8. 오프라인 상태 감지

인터넷 연결이 없을 때 별도 처리가 필요한가요?

A) 별도 처리 없음 — API 타임아웃/에러로 자연스럽게 처리  
B) `navigator.onLine` 체크 후 "오프라인 상태입니다" 메시지 표시  
C) Other (please describe after [Answer]: tag below)

> 💡 **추천: B**  
> `navigator.onLine`은 구현 비용이 거의 없어요. 오프라인 상태에서 API 호출을 시도하면 타임아웃까지 기다려야 하는데, 미리 감지해서 즉시 알려주면 UX가 훨씬 좋아집니다.

[Answer]: B

---

### [유지보수성]

### Q9. 에러 로깅

Extension에서 발생하는 에러를 어떻게 추적할까요?

A) `console.error`만 사용 (개발자 도구에서만 확인)  
B) 외부 에러 트래킹 서비스 연동 (Sentry 등)  
C) Other (please describe after [Answer]: tag below)

> 💡 **추천: A**  
> MVP 수준에서 Sentry 같은 외부 서비스 연동은 과도해요. `console.error`로 충분하고, 문제 발생 시 개발자 도구로 확인 가능합니다. 사용자가 늘어나면 그때 추가하면 돼요.

[Answer]: A

---

### Q10. TypeScript strict 모드

`tsconfig.json`에서 TypeScript strict 모드를 활성화할까요?

A) strict: true (엄격 모드)  
B) strict: false (기본 모드)  
C) Other (please describe after [Answer]: tag below)

> 💡 **추천: A**  
> 프로젝트 전체가 TypeScript strict를 사용하는 방향이고, Extension도 동일하게 맞추는 게 일관성 있어요. 초기부터 strict로 시작하면 나중에 전환하는 것보다 훨씬 쉽습니다.

[Answer]: B

---

### [기술 스택]

### Q11. React 버전

Extension 팝업에 사용할 React 버전은?

A) React 18 (현재 안정 버전)  
B) React 19 (최신 버전)  
C) Other (please describe after [Answer]: tag below)

> 💡 **추천: A**  
> React 18이 현재 가장 안정적이고 Vite + MV3 환경에서 검증된 조합이에요. React 19는 아직 생태계 호환성 이슈가 있을 수 있어요. Next.js 앱(Unit 2)도 React 18 기반이라 일관성도 유지됩니다.

[Answer]: A

---

### Q12. 빌드 도구

Extension 빌드에 사용할 도구는?

A) Vite + vite-plugin-web-extension  
B) Webpack (CRA 또는 직접 설정)  
C) Parcel  
D) Other (please describe after [Answer]: tag below)

> 💡 **추천: A**  
> `vite-plugin-web-extension`은 MV3 manifest 자동 처리, HMR 지원, 빠른 빌드를 제공해요. Webpack보다 설정이 훨씬 단순하고, Vite 생태계가 현재 Extension 개발의 표준으로 자리잡고 있습니다.

[Answer]: A

---

### Q13. 패키지 매니저

Extension 프로젝트의 패키지 매니저는?

A) npm  
B) pnpm (모노레포 루트와 동일하게)  
C) yarn  
D) Other (please describe after [Answer]: tag below)

> 💡 **추천: B**  
> unit-of-work.md에서 모노레포 구조(`moaring/extension/`)로 설계되어 있어요. 루트 `package.json`과 동일한 패키지 매니저를 쓰는 게 일관성 있습니다. 루트가 pnpm이라면 B, npm이라면 A가 맞아요. 현재 루트 설정을 확인 후 결정해 주세요.

[Answer]: A

---

### Q14. 최소 지원 Chrome 버전

Extension이 지원할 최소 Chrome 버전은?

A) Chrome 102 이상 (MV3 안정화 버전)  
B) Chrome 116 이상 (최신 MV3 기능 포함)  
C) 최신 버전만 (버전 제한 없음)  
D) Other (please describe after [Answer]: tag below)

> 💡 **추천: A**  
> Chrome 102는 MV3가 안정화된 버전이에요. 대부분의 사용자가 자동 업데이트로 최신 버전을 쓰지만, 최소 버전을 명시해두면 manifest에 `minimum_chrome_version`을 설정할 수 있어요. 너무 최신 버전만 지원하면 일부 사용자가 설치 못할 수 있습니다.

[Answer]: A

---

답변 완료 후 "답변완료"라고 알려주세요.
