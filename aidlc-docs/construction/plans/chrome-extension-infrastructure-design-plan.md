# Infrastructure Design Plan — Unit 3: Chrome Extension

> **Unit**: Chrome Extension  
> **단계**: Construction Phase > Infrastructure Design  
> **작성일**: 2026-05-20

---

## 실행 체크리스트

- [x] Step 1: Functional Design + NFR Design 아티팩트 분석
- [x] Step 2: 아래 질문에 대한 답변 수집
- [x] Step 3: Infrastructure Design 아티팩트 생성
  - [x] infrastructure-design.md
  - [x] deployment-architecture.md

---

## 분석 요약

Chrome Extension은 **클라이언트 전용 유닛**으로, 서버 인프라가 없어요.

| 인프라 카테고리 | 해당 여부 | 내용 |
|----------------|-----------|------|
| Compute | N/A | 브라우저가 런타임 (별도 서버 없음) |
| Database | N/A | chrome.storage.local (브라우저 내장) |
| Messaging/Queue | N/A | 비동기 메시징 불필요 |
| Networking | 외부 의존 | moaring API + Cognito에 HTTPS 호출 |
| CDN | N/A | Extension 파일은 로컬 설치 |
| Monitoring | 최소 | console.error (MVP) |
| Deployment | 결정 필요 | 빌드 + 배포 파이프라인 |

---

## 질문

### Q1. CI/CD 파이프라인

Extension 빌드 및 배포에 CI/CD를 적용할까요?

A) 없음 — 로컬에서 `npm run build` 후 Developer mode로 수동 로드 (MVP)  
B) GitHub Actions — PR 머지 시 자동 빌드 + `dist/` 아티팩트 업로드  
C) Other (please describe after [Answer]: tag below)

> 💡 **추천: A**  
> MVP에서 Extension은 Developer mode 배포예요. 사용자가 1~10명 수준이라 CI/CD 오버헤드가 불필요합니다. 빌드 명령 하나로 충분하고, Chrome Web Store 배포 시점에 GitHub Actions를 추가하면 돼요.

[Answer]: A

---

### Q2. 개발 환경 로컬 API 연결

로컬 개발 시 Extension이 연결할 API는?

A) `http://localhost:3000` (Unit 2 Next.js 로컬 서버)  
B) 배포된 스테이징 서버 URL  
C) Mock API만 사용 (실제 서버 연결 없음)  
D) Other (please describe after [Answer]: tag below)

> 💡 **추천: A**  
> Unit 2와 병렬 개발 전략이므로, 로컬에서 Next.js 앱을 띄우고 Extension이 연결하는 게 자연스러워요. Mock API(`VITE_USE_MOCK=true`)로 시작하다가 Unit 2 API가 준비되면 `localhost:3000`으로 전환하는 흐름이에요.

[Answer]: A

---

### Q3. Extension ID 관리

Cognito App Client의 redirect URI에 등록할 Extension ID 관리 방식은?

A) 개발용 Extension ID 고정 (unpacked 로드 시 Chrome이 자동 생성하는 ID 사용)  
B) `key` 필드를 manifest.json에 추가하여 Extension ID 고정  
C) Other (please describe after [Answer]: tag below)

> 💡 **추천: B**  
> `manifest.json`에 `key` 필드를 추가하면 개발/프로덕션 환경에서 Extension ID가 고정돼요. ID가 바뀌면 Cognito redirect URI도 바꿔야 하는데, `key`로 고정하면 이 문제가 없어요. Chrome Web Store에 등록하면 Store가 ID를 고정해주지만, 그 전까지는 `key`로 관리하는 게 안전합니다.

[Answer]: B

---

답변 완료 후 "답변완료"라고 알려주세요.
