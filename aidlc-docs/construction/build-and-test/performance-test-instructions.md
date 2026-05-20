# Performance Test Instructions — moaring (Unit 2: Next.js App)

## 성능 요구사항 (NFR)

| 항목 | 목표 | 측정 방법 |
|------|------|-----------|
| 검색 응답 시간 | < 300ms | PostgreSQL EXPLAIN ANALYZE |
| 공유 페이지 초기 로딩 | < 1.5s | Lighthouse / curl 타이밍 |
| API 응답 시간 (일반) | < 500ms | curl -w 타이밍 |

---

## 1. DB 쿼리 성능 검증 (PostgreSQL EXPLAIN ANALYZE)

### 검색 쿼리 성능

```sql
-- 로컬 DB에서 실행
EXPLAIN ANALYZE
SELECT 'bookmark' as type, b.id, b.title, b.url,
       ts_rank(b.search_vector, plainto_tsquery('simple', 'nextjs')) as rank,
       b.created_at
FROM "bookmarks" b
WHERE b.user_id = 'test-user-id'
  AND b.search_vector @@ plainto_tsquery('simple', 'nextjs')
ORDER BY rank DESC, created_at DESC
LIMIT 20;

-- 기대: "Index Scan using idx_bookmarks_search_vector" 확인
-- 목표: Execution Time < 10ms (소규모 데이터)
```

### GIN 인덱스 확인

```sql
-- 인덱스 존재 확인
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename IN ('bookmarks', 'collections')
  AND indexname LIKE '%search_vector%';

-- 기대: idx_bookmarks_search_vector, idx_collections_search_vector 존재
```

---

## 2. API 응답 시간 측정 (curl)

```bash
# 서버 실행 중 상태에서 실행

# 헬스체크 응답 시간
curl -w "\nTime: %{time_total}s\n" -o /dev/null -s \
  http://localhost:3000/api/health

# 검색 API 응답 시간 (로그인 토큰 필요)
curl -w "\nTime: %{time_total}s\n" -o /dev/null -s \
  -H "Authorization: Bearer {token}" \
  "http://localhost:3000/api/search?q=test"

# 목표: < 300ms
```

---

## 3. 공유 페이지 로딩 성능 (Lighthouse)

```bash
# Chrome DevTools Lighthouse 또는 CLI 사용
npx lighthouse http://localhost:3000/c/{slug} \
  --output=json \
  --output-path=./lighthouse-report.json \
  --only-categories=performance

# 목표 지표:
# - First Contentful Paint: < 1.5s
# - Largest Contentful Paint: < 2.5s
# - Time to Interactive: < 3.5s
```

---

## 4. 부하 테스트 (k6) — Post-MVP 권장

MVP 규모(개인/팀 1~10명)에서는 부하 테스트가 필수는 아니지만, 기본 스크립트를 준비합니다.

```javascript
// k6-load-test.js
import http from 'k6/http'
import { check, sleep } from 'k6'

export const options = {
  vus: 5,        // 동시 사용자 5명
  duration: '30s',
}

export default function () {
  // 헬스체크
  const res = http.get('http://localhost:3000/api/health')
  check(res, { 'status is 200': (r) => r.status === 200 })
  sleep(1)
}
```

```bash
# k6 설치 후 실행
k6 run k6-load-test.js

# 목표:
# - http_req_duration p(95) < 500ms
# - http_req_failed < 1%
```

---

## 5. Prisma 연결 풀 모니터링

```bash
# 프로덕션 환경에서 연결 수 모니터링
psql {DATABASE_URL} -c "
  SELECT count(*) as active_connections
  FROM pg_stat_activity
  WHERE datname = 'moaring'
    AND state = 'active';
"

# 목표: ECS 태스크 1개 기준 최대 10개 연결 이하
```

---

## 성능 최적화 체크리스트

- [ ] GIN 인덱스 생성 확인 (`add_search_vectors` 마이그레이션 적용)
- [ ] Prisma `connection_limit=10` 설정 확인
- [ ] Next.js `output: 'standalone'` 빌드 확인
- [ ] CloudFront 캐시 정책 설정 확인 (이미지: 1년, 앱: 캐시 없음)
- [ ] ISR `revalidate = 60` 공개 컬렉션 페이지 적용 확인
