# Unit 2 (Application) — Business Rules

> **작성일**: 2026-05-20  
> **단계**: Construction Phase — Functional Design

---

## 1. 데이터 격리 규칙

### BR-ISO-01: 사용자 데이터 완전 격리
- 모든 Service 메서드는 `userId`를 첫 번째 인자로 받음
- 모든 DB 쿼리에 `WHERE user_id = {userId}` 조건 강제 적용
- 다른 사용자의 데이터에 접근 시 `NotFoundError` 반환 (존재 여부 노출 금지)

### BR-ISO-02: 소유권 검증
- 리소스 수정/삭제 전 반드시 소유권 검증
- 검증 실패 시 `ForbiddenError(403)` 반환
- 패턴:
  ```typescript
  const resource = await prisma.bookmark.findFirst({
    where: { id: bookmarkId, user_id: userId }
  })
  if (!resource) throw new NotFoundError('Bookmark')
  ```

---

## 2. 북마크 규칙

### BR-BM-01: URL 유효성
- `http://` 또는 `https://`로 시작해야 함
- 최대 길이: 2048자
- 유효하지 않으면 `ValidationError(400)` 반환

### BR-BM-02: 제목 필수
- 제목은 필수 (NOT NULL)
- OG 태그 fetch 실패 시: 클라이언트가 수동 입력 필요
- 수동 입력도 없으면 URL 도메인을 기본 제목으로 사용 (`new URL(url).hostname`)

### BR-BM-03: 읽음 상태 전이
- URL 클릭(자동) 또는 "읽음" 버튼 클릭(명시적) 시 `is_read = true` (Q1: C)
- 액션 메뉴의 "읽지 않음으로 표시" 기능으로 `is_read = false` 복원 가능
- `BookmarkService.markAsRead()` / `BookmarkService.markAsUnread()` 두 메서드로 처리

### BR-BM-04: 그룹 소속
- 하나의 북마크는 여러 그룹에 동시 소속 가능
- 어떤 그룹에도 속하지 않은 북마크 = 인박스 항목
- 그룹 삭제 시 `BookmarkGroup` 레코드만 삭제, 북마크 원본 유지

### BR-BM-05: Import 중복 처리
- 크롬 HTML Import 시 중복 URL도 새로 추가 허용
- 동일 URL의 북마크가 여러 개 존재할 수 있음
- Import 중 URL 유효성 검사 실패 항목은 `failed` 카운트에 포함

### BR-BM-06: 북마크 삭제 시 블록 처리
- 북마크 삭제 시 해당 북마크를 참조하는 모든 컬렉션 링크 블록의 `bookmark_id`를 null로 변경
- 블록의 `url`, `title`, `description`, `thumbnail_url`, `tags`는 스냅샷으로 보존
- 공개 컬렉션 페이지 무결성 유지

---

## 3. 태그 규칙

### BR-TAG-01: 태그 이름 정규화
- 저장 전 `name.toLowerCase().trim()` 적용
- 최대 길이: 50자
- 빈 문자열 불가

### BR-TAG-02: 태그 중복 방지
- `(user_id, name)` 조합 UNIQUE
- `getOrCreate()` 패턴으로 upsert 처리

### BR-TAG-03: 태그 자동완성
- prefix 최소 1자 이상
- 최대 10개 반환
- 사용자 본인 태그만 반환

---

## 4. 그룹 규칙

### BR-GRP-01: 그룹 이름
- 최소 1자, 최대 50자
- 사용자별 그룹 이름 중복 허용 (이모지로 구분 가능)

### BR-GRP-02: 그룹 순서
- `position`은 0부터 시작하는 정수
- 순서 변경 시 전체 그룹의 position 재할당 (0, 1, 2, ...)
- 동점 position 불허

### BR-GRP-03: 그룹 삭제
- 그룹 삭제 시 `BookmarkGroup` 레코드 cascade 삭제
- 북마크 원본은 유지 (인박스로 자동 이동)
- 그룹 내 북마크가 있어도 삭제 가능 (경고 없음)

### BR-GRP-04: 컬렉션 변환
- 선택한 북마크들을 새 컬렉션의 링크 블록으로 복사
- 원본 그룹 유지, 북마크도 그룹에 그대로 남음
- 최소 1개 이상의 북마크 선택 필요

---

## 5. 컬렉션 규칙

### BR-COL-01: 슬러그 형식
- 허용 문자: 영문 소문자, 숫자, 하이픈 (`^[a-z0-9-]+$`)
- 최소 3자, 최대 50자
- 하이픈으로 시작하거나 끝날 수 없음 (`^[a-z0-9].*[a-z0-9]$` 또는 단일 문자)
- 자동 생성: `nanoid(10)` (URL-safe 문자)

### BR-COL-02: 슬러그 중복 방지
- 전역 UNIQUE (모든 사용자 통합)
- 실시간 체크: debounce 300ms, `GET /api/collections/slug-check`
- 저장 시 최종 검증: DB UNIQUE 제약 + `ConflictError(409)`

### BR-COL-03: 공개 설정
- `is_public = false`인 컬렉션은 `/c/{slug}` 접근 시 404 반환
- 소유자는 `is_public` 관계없이 편집 페이지 접근 가능

### BR-COL-04: 블록 순서
- `position`은 0부터 시작하는 정수
- 순서 변경 시 전체 블록 position 재할당
- 블록 추가 시 `position = 현재 최대 position + 1`

### BR-COL-05: 블록 ID
- 블록 생성 시 `nanoid(8)` 로 고유 ID 부여
- JSONB 내에서 고유성 보장 (앱 레벨 관리)
- 블록 삭제 후 ID 재사용 불가

### BR-COL-06: 컬렉션 삭제
- 컬렉션 삭제 시 블록 배열도 함께 삭제 (JSONB)
- 링크 블록이 참조하는 북마크 원본은 유지
- `CollectionLike`, `CollectionLinkClick` cascade 삭제

### BR-COL-07: 컬렉션 순서
- 사이드바 표시 순서는 `position` 컬럼으로 관리
- 컬렉션 생성 시 `position = 현재 최대 position + 1`

---

## 6. 검색 규칙

### BR-SRC-01: 검색 범위
- 로그인한 본인 데이터만 검색 대상
- 검색 대상: 북마크 제목 + URL + 메모 + 태그, 컬렉션 이름 + 설명 + 블록 텍스트

### BR-SRC-02: 검색어 처리
- 최소 1자 이상
- 최대 100자
- 특수문자 이스케이프 후 `plainto_tsquery` 변환
- 빈 검색어는 빈 결과 반환 (전체 조회 아님)

### BR-SRC-03: 검색 결과
- 최대 20개 반환
- 정렬: 관련도 DESC, 동점 시 created_at DESC
- 결과 타입: `bookmark` 또는 `collection`

---

## 7. 통계 규칙

### BR-STAT-01: 조회수
- 공개 컬렉션 페이지 접근 시 atomic increment
- 비로그인 사용자 포함 모든 접근 카운트
- 소유자 본인 접근도 카운트

### BR-STAT-02: 좋아요 (Q15: C — 로그인 사용자만)
- 로그인 사용자만 좋아요 가능
- 비로그인 사용자 클릭 시 `/login?redirect=/c/{slug}` redirect
- fingerprint = `SHA256(user_id)` — user_id 직접 노출 없이 중복 방지
- `(collection_id, fingerprint)` UNIQUE — 중복 좋아요 방지
- 좋아요 취소 가능 (toggle)

### BR-STAT-03: 링크 클릭
- 공개 컬렉션 페이지의 링크 블록 클릭 시 기록
- 비로그인 사용자 포함 모든 클릭 기록
- 클릭 기록은 삭제하지 않음 (누적)

---

## 8. 인증 규칙

### BR-AUTH-01: 토큰 저장
- Access Token + Refresh Token 모두 HttpOnly Cookie에 저장
- Cookie 속성: `Secure`, `SameSite=Lax`
- Access Token 만료: 1시간
- Refresh Token 만료: 30일

### BR-AUTH-02: 토큰 갱신
- Access Token 만료 시 Middleware에서 자동 갱신
- Refresh Token도 만료 시 `/login` redirect

### BR-AUTH-03: 로그아웃
- Cookie 삭제 (access_token, refresh_token)
- Cognito 세션 무효화 (GlobalSignOut API)

### BR-AUTH-04: User 레코드 생성
- Cognito 이메일 인증 완료 시점에 DB User 레코드 생성
- `syncCognitoUser(cognitoSub, email)` — UPSERT 패턴
- 이후 모든 API는 User가 반드시 존재한다고 가정

---

## 9. 에러 처리 규칙

### BR-ERR-01: 에러 클래스 계층

```typescript
AppError(statusCode, message)
  ├── NotFoundError(404)      — 리소스 없음 또는 소유권 없음
  ├── UnauthorizedError(401)  — 인증 필요
  ├── ForbiddenError(403)     — 권한 없음
  ├── ValidationError(400)    — 입력값 유효성 오류
  └── ConflictError(409)      — 중복 (슬러그 등)
```

### BR-ERR-02: Route Handler 에러 처리
- `withErrorHandler()` 래퍼로 중앙 처리
- `AppError` 하위 클래스: statusCode + message 반환
- 그 외 예외: 500 Internal Server Error (상세 메시지 노출 금지)

### BR-ERR-03: 소유권 없는 리소스
- `NotFoundError` 반환 (존재 여부 노출 금지)
- `ForbiddenError`를 반환하면 리소스 존재 여부가 노출됨

### BR-ERR-04: OG 메타데이터 fetch 실패
- `MetadataService.fetchMetadata()` 실패 시 null 반환 (예외 throw 안 함)
- 클라이언트에서 토스트 메시지 표시 후 수동 입력 유도

---

## 10. 입력값 유효성 검사 규칙

| 필드 | 규칙 |
|------|------|
| URL | http/https 시작, 최대 2048자 |
| 북마크 제목 | 최소 1자, 최대 200자 |
| 북마크 메모 | 최대 1000자 |
| 태그 이름 | 최소 1자, 최대 50자, 소문자 정규화 |
| 그룹 이름 | 최소 1자, 최대 50자 |
| 컬렉션 이름 | 최소 1자, 최대 100자 |
| 컬렉션 설명 | 최대 500자 |
| 슬러그 | `^[a-z0-9][a-z0-9-]*[a-z0-9]$` 또는 단일 영숫자, 3~50자 |
| 텍스트 블록 | 최대 5000자 (마크다운) |
| 검색어 | 최소 1자, 최대 100자 |
| 이미지 파일 | jpeg/png/webp/gif, 최대 10MB |

---

## 11. XSS 방지 규칙

### BR-XSS-01: 마크다운 렌더링
- 텍스트 블록의 마크다운 렌더링 시 `DOMPurify` 또는 `sanitize-html`로 sanitize
- 허용 태그: `p`, `h1`~`h6`, `ul`, `ol`, `li`, `a`, `strong`, `em`, `code`, `pre`, `blockquote`
- `<script>`, `<iframe>`, `on*` 이벤트 핸들러 제거

### BR-XSS-02: URL 렌더링
- 링크 블록의 URL 렌더링 시 `javascript:` 프로토콜 차단
- `href` 속성에 `http://` 또는 `https://`만 허용
