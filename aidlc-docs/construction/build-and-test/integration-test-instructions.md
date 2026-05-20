# Integration Test Instructions — moaring (Unit 2: Next.js App)

## 목적

Unit 2 내부 컴포넌트 간 통합 및 Unit 2 ↔ 외부 서비스(Aurora, Cognito, S3) 연동 검증

---

## 테스트 환경 준비

### 1. 로컬 DB 시작

```bash
cd /home/ksg/Projects/aidlc
docker compose up -d
docker compose ps  # postgres healthy 확인
```

### 2. DB 마이그레이션

```bash
npx prisma migrate dev --name integration-test
psql postgresql://moaring:moaring_local@localhost:5432/moaring \
  -f prisma/migrations/add_search_vectors/migration.sql
```

### 3. 개발 서버 시작

```bash
npm run dev
# http://localhost:3000 에서 실행 확인
```

---

## 통합 테스트 시나리오

### 시나리오 1: 북마크 저장 → 인박스 조회 흐름

**목적**: BookmarkService.create() → getInbox() 연동 검증

```bash
# 1. 회원가입 + 로그인 (Cognito 개발 계정 필요)
# 2. 북마크 저장 API 호출
curl -X POST http://localhost:3000/api/bookmarks \
  -H "Authorization: Bearer {access_token}" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com", "tagNames": ["test"]}'

# 기대 응답: 201 Created, bookmark 객체 반환

# 3. 인박스 조회
curl http://localhost:3000/api/bookmarks \
  -H "Authorization: Bearer {access_token}"

# 기대 응답: 방금 저장한 북마크 포함
```

### 시나리오 2: 검색 흐름 (tsvector GIN 인덱스)

**목적**: SearchService → PostgreSQL tsvector 검색 연동 검증

```bash
# 1. 북마크 여러 개 저장 (제목에 검색어 포함)
curl -X POST http://localhost:3000/api/bookmarks \
  -H "Authorization: Bearer {access_token}" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://nextjs.org", "title": "Next.js 공식 문서"}'

# 2. 검색 실행
curl "http://localhost:3000/api/search?q=nextjs" \
  -H "Authorization: Bearer {access_token}"

# 기대 응답: 검색어 포함 북마크 반환, 300ms 이내
```

### 시나리오 3: 컬렉션 공개 → 공개 페이지 접근

**목적**: CollectionService.togglePublic() → /c/{slug} SSR 연동 검증

```bash
# 1. 컬렉션 생성 (Server Action 또는 직접 DB 삽입)
# 2. 공개 설정
curl -X POST http://localhost:3000/api/collections/{id}/view

# 3. 공개 페이지 접근 (비로그인)
curl http://localhost:3000/c/{slug}
# 기대 응답: 200 OK, HTML 페이지 반환

# 4. 조회수 확인
# DB에서 view_count 증가 확인
psql postgresql://moaring:moaring_local@localhost:5432/moaring \
  -c "SELECT view_count FROM collections WHERE slug = '{slug}'"
```

### 시나리오 4: 이미지 업로드 흐름 (S3 Pre-signed URL)

**목적**: StorageService → S3 연동 검증 (AWS 개발 계정 필요)

```bash
# 1. Pre-signed URL 발급
curl -X POST http://localhost:3000/api/upload/presigned \
  -H "Authorization: Bearer {access_token}" \
  -H "Content-Type: application/json" \
  -d '{"type": "collection-image", "filename": "test.png"}'

# 기대 응답: { uploadUrl, key, publicUrl }

# 2. S3에 직접 업로드
curl -X PUT "{uploadUrl}" \
  -H "Content-Type: image/png" \
  --data-binary @test.png

# 기대 응답: 200 OK

# 3. CloudFront URL로 접근 확인
curl -I "{publicUrl}"
# 기대 응답: 200 OK
```

### 시나리오 5: Chrome Extension API 연동

**목적**: Extension용 API 엔드포인트 검증

```bash
# 최근 저장 목록
curl http://localhost:3000/api/bookmarks/recent \
  -H "Authorization: Bearer {access_token}"

# 저장된 URL 목록 (추천 필터링용)
curl http://localhost:3000/api/bookmarks/urls \
  -H "Authorization: Bearer {access_token}"

# 기대 응답: 각각 배열 반환
```

### 시나리오 6: 크롬 북마크 Import

**목적**: BookmarkService.importFromHtml() 대용량 처리 검증

```bash
# 테스트용 크롬 북마크 HTML 파일 생성
cat > /tmp/test-bookmarks.html << 'EOF'
<!DOCTYPE NETSCAPE-Bookmark-file-1>
<DL><p>
  <DT><A HREF="https://example.com">Example</A>
  <DT><A HREF="https://github.com">GitHub</A>
  <DT><A HREF="https://nextjs.org">Next.js</A>
</DL><p>
EOF

# Import 실행 (웹 UI 또는 직접 API)
# 기대 결과: { imported: 3, failed: 0 }
```

---

## Unit 2 ↔ Unit 3 (Extension) 연동 테스트

Unit 3 개발 시작 전 API 스펙 검증:

```bash
# Extension이 사용하는 4개 핵심 API 검증
POST /api/bookmarks        → 201 Created
GET  /api/bookmarks/recent → 200 OK, 배열
GET  /api/bookmarks/urls   → 200 OK, { urls: [] }
GET  /api/groups           → 200 OK (미구현 시 추가 필요)
```

---

## 통합 테스트 후 정리

```bash
# 테스트 데이터 삭제
psql postgresql://moaring:moaring_local@localhost:5432/moaring \
  -c "TRUNCATE users CASCADE"

# Docker 중지 (선택사항)
docker compose down
```
