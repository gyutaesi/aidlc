# Performance Test Instructions — moaring

> **상태**: Unit 3 (Chrome Extension) 성능 측정만 적용 가능. 서버측 성능은 Unit 2 완료 후.  
> **작성일**: 2026-05-20

---

## Unit 3 (Chrome Extension) 성능 요구사항

| ID | 요구사항 | 기준값 | 측정 방법 |
|----|----------|--------|-----------|
| PERF-01 | 팝업 초기 로딩 시간 | 500ms 이내 | Performance API |
| PERF-02 | API 호출 타임아웃 | 3초 | axios timeout 설정 |
| PERF-03 | 번들 크기 | 1MB 이하 | `du -sh dist/` |
| PERF-04 | 병렬 초기화 | Promise.allSettled | 코드 검증 |

---

## PERF-03: 번들 크기 측정 (✅ 통과)

### 실행

```bash
cd extension
npm run build
du -sh dist/
du -sh dist/src/popup/popup.js
du -sh dist/popup.css
```

### 현재 측정값

| 항목 | 크기 | 목표 | 결과 |
|------|------|------|------|
| 전체 dist/ | 232KB | < 1MB | ✅ 통과 (23%) |
| popup.js | 205KB (gzip 68KB) | — | — |
| popup.css | 11KB (gzip 2.9KB) | — | — |
| service-worker.js | 0.2KB | — | — |
| manifest.json | 0.7KB | — | — |

---

## PERF-01: 팝업 초기 로딩 시간 측정

### 측정 방법 (Chrome DevTools)

1. Extension 팝업을 우클릭 → "검사"로 DevTools 열기
2. Network 탭 → "Slow 3G" 시뮬레이션 (옵션)
3. Performance 탭 → 녹화 시작
4. 팝업 닫고 다시 열기
5. 녹화 종료 → "First Contentful Paint" / "Largest Contentful Paint" 확인

### 코드 기반 측정 (옵션)

`App.tsx`에 임시 측정 코드 추가:

```typescript
useEffect(() => {
  const startTime = performance.now()
  // ... 기존 init 코드
  // 초기화 완료 시점에:
  console.log('[PERF-01] Init time:', performance.now() - startTime, 'ms')
}, [])
```

### 기대 결과

- 캐시 히트 시: ~200ms
- 캐시 미스 시 (첫 호출): ~500ms 이내

---

## PERF-02: API 타임아웃 검증

### 측정 방법

`api-client.ts`의 axios 인스턴스 설정 확인:

```typescript
const client = axios.create({
  baseURL: API_BASE_URL,
  timeout: 3_000,  // ✅ 3초
})
```

### 시나리오 테스트

1. Mock 서버에 4초 지연을 시뮬레이션
2. Extension에서 API 호출 시도
3. 3초 후 TimeoutError 발생 확인
4. 토스트 알림: "요청 시간이 초과되었습니다"

---

## PERF-04: 병렬 초기화 검증

### 측정 방법

`App.tsx`의 초기화 로직 확인:

```typescript
const [groupsResult, urlsResult] = await Promise.allSettled([
  apiClient.getGroups(),
  cachedUrls !== null
    ? Promise.resolve(cachedUrls)
    : apiClient.getSavedUrls().then(...)
])
```

### 검증 항목

- `Promise.allSettled` 사용 (실패해도 다른 작업 계속)
- 두 API가 순차가 아닌 동시 호출
- 각 결과를 독립적으로 처리

---

## 서버측 성능 (Unit 2 완료 후)

Unit 2 (Next.js API) 완료 후 다음 항목 측정 예정:

| 항목 | 목표 | 도구 권장 |
|------|------|-----------|
| 검색 응답 시간 | < 300ms (NFR-01-1) | k6, Artillery |
| 공유 페이지 로딩 | < 1.5s (NFR-01-2) | Lighthouse, WebPageTest |
| API 처리량 | TBD | k6 |
| 동시 사용자 | TBD | k6 |

---

## 빌드 산출물 분석 (Bundle Analyzer)

번들 구성 분석이 필요한 경우:

```bash
cd extension
npm install --save-dev rollup-plugin-visualizer
```

`vite.config.ts`에 플러그인 추가 후 빌드하면 `stats.html` 생성.
번들에서 가장 큰 의존성을 확인하여 최적화 대상 식별 가능.
