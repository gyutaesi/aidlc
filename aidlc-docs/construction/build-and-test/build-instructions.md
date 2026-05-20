# Build Instructions — moaring

> **상태**: Unit 3 (Chrome Extension)만 코드 생성 완료  
> **작성일**: 2026-05-20

---

## Prerequisites

| 항목 | 요구사항 |
|------|---------|
| Node.js | 20.x 이상 |
| 패키지 매니저 | npm 10.x 이상 |
| 디스크 공간 | 최소 500MB (node_modules 포함) |
| OS | macOS / Linux / Windows |

---

## Unit 3: Chrome Extension 빌드

### 1. 의존성 설치

```bash
cd extension
npm install
```

**확인**: `node_modules/` 디렉토리 생성, ~360개 패키지 설치

---

### 2. 환경변수 설정

```bash
# 개발 빌드용 (Mock API)
cp .env.example .env.development
# 필요시 VITE_COGNITO_* 값 입력 (Unit 1 배포 후)

# 프로덕션 빌드용 (실제 API)
cp .env.example .env.production
# VITE_USE_MOCK=false로 변경
# VITE_COGNITO_* 값 입력 필수
```

---

### 3. 빌드 실행

```bash
# 개발 빌드 (Mock API)
npm run build:dev

# 프로덕션 빌드 (실제 API)
npm run build

# 타입 체크만
npm run typecheck

# 개발 서버 (HMR)
npm run dev
```

---

### 4. 빌드 산출물

빌드 성공 시 `extension/dist/` 디렉토리에 다음 파일 생성:

```
dist/
├── manifest.json                  # MV3 매니페스트
├── icons/                         # 아이콘 (placeholder)
└── src/
    ├── popup/
    │   ├── popup.html             # 팝업 HTML
    │   └── popup.js               # 팝업 번들
    ├── service-worker.js          # MV3 Service Worker
└── popup.css                      # TailwindCSS 번들
```

**번들 크기 목표 (PERF-03)**: 전체 1MB 이하  
**현재 측정값**: 232KB (목표 대비 23%)

---

### 5. Chrome에 로드

1. Chrome에서 `chrome://extensions/` 열기
2. 우측 상단 "개발자 모드" 토글 ON
3. "압축해제된 확장 프로그램을 로드합니다" 클릭
4. `extension/dist/` 폴더 선택
5. Extension 카드의 **ID 값을 메모** (Cognito redirect URI 등록용)

---

## Unit 1, Unit 2 빌드 (Pending)

Unit 1 (Infrastructure - AWS CDK)와 Unit 2 (Next.js App) 코드는 아직 생성되지 않았어요.
해당 Unit의 Construction이 완료되면 이 문서에 빌드 절차를 추가합니다.

---

## Troubleshooting

### `npm install` 실패 — `EACCES: permission denied`

**원인**: npm 캐시 권한 문제  
**해결**:
```bash
sudo chown -R $(whoami) ~/.npm
```

### 빌드 실패 — `terser not found`

**원인**: Vite 5+에서 terser는 optional dependency  
**해결**: `package.json`의 devDependencies에 `terser`가 포함되어 있는지 확인. 없다면:
```bash
npm install --save-dev terser
```

### 빌드 실패 — `additionalInputs.forEach is not a function`

**원인**: `vite-plugin-web-extension`의 `additionalInputs` 옵션 형식 변경  
**해결**: `vite.config.ts`에서 `additionalInputs` 옵션 제거. 매니페스트의 `default_popup`이 자동으로 entry point로 처리됨.

### Extension 로드 실패 — `Manifest file is missing or unreadable`

**원인**: `dist/` 폴더가 아닌 `extension/` 폴더를 선택함  
**해결**: 반드시 `extension/dist/` 폴더를 선택해야 함. 빌드를 먼저 실행 (`npm run build:dev`).

### Cognito 로그인 실패 — `Invalid redirect URI`

**원인**: Extension ID가 Cognito App Client에 등록되지 않음  
**해결**:
1. `chrome://extensions/`에서 Extension ID 확인
2. Cognito App Client의 허용 redirect URI에 `https://<extension-id>.chromiumapp.org/` 추가
3. `manifest.json`에 `key` 필드를 추가하여 ID 고정 권장
