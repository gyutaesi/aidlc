# Unit 2 (Application) — Domain Entities

> **작성일**: 2026-05-20  
> **단계**: Construction Phase — Functional Design

---

## 1. 엔티티 관계 개요

```
User
 |
 +--< Bookmark >--< BookmarkTag >--< Tag
 |        |
 |        +--< BookmarkGroup >--< Group
 |
 +--< Collection
          |
          +-- blocks: Block[] (JSONB)
          +--< CollectionLike
          +--< CollectionLinkClick
```

---

## 2. User

### 속성

| 필드 | 타입 | 제약 | 설명 |
|------|------|------|------|
| id | String (CUID) | PK | 내부 식별자 |
| cognito_sub | String | UNIQUE, NOT NULL | Cognito User Pool Sub |
| email | String | UNIQUE, NOT NULL | 이메일 주소 |
| created_at | DateTime | NOT NULL | 생성 시각 |
| updated_at | DateTime | NOT NULL | 수정 시각 |

### 비즈니스 규칙
- 비밀번호는 Cognito가 관리 — DB에 저장하지 않음
- `cognito_sub`는 Cognito JWT의 `sub` 클레임과 1:1 매핑
- 회원가입 이메일 인증 완료 시점에 DB 레코드 생성 (Server Action)
- 이후 모든 API는 User가 반드시 존재한다고 가정

### 생명주기
```
[Cognito 회원가입 + 이메일 인증 완료]
        |
        v
[Server Action: syncCognitoUser()]
        |
        v
[DB User 레코드 생성]
        |
        v
[이후 모든 데이터는 user_id로 격리]
```

---

## 3. Bookmark

### 속성

| 필드 | 타입 | 제약 | 설명 |
|------|------|------|------|
| id | String (CUID) | PK | 내부 식별자 |
| user_id | String | FK → User, NOT NULL | 소유자 |
| url | String | NOT NULL | 저장된 URL |
| title | String | NOT NULL | 제목 (OG 또는 수동 입력) |
| description | String? | nullable | 설명 (OG 또는 수동 입력) |
| thumbnail_url | String? | nullable | 썸네일 이미지 URL |
| memo | String? | nullable | 사용자 메모 |
| is_read | Boolean | DEFAULT false | 읽음 여부 |
| created_at | DateTime | NOT NULL | 생성 시각 |
| updated_at | DateTime | NOT NULL | 수정 시각 |

### 읽음 상태 정의 (Q1: C)
- **명시적 읽음**: 사용자가 "읽음" 버튼 클릭 → `is_read = true`
- **자동 읽음**: 북마크 URL 클릭(외부 링크 열기) 시 → `is_read = true` (클라이언트에서 API 호출)
- 두 경로 모두 `BookmarkService.markAsRead()` 호출

### 그룹 소속 판단
- `BookmarkGroup` 관계 레코드 존재 여부로 판단
- 어떤 그룹에도 속하지 않은 북마크 = 인박스 항목

### 컬렉션 블록 참조 관계
- 북마크 삭제 시 (Q2: B): 해당 북마크를 참조하는 컬렉션 링크 블록의 `bookmark_id`를 null로 변경
- 블록의 `url`, `title`, `description`은 블록 생성 시점의 스냅샷으로 보존
- 공개 컬렉션 페이지 무결성 유지

### Import 중복 처리 (Q3: B)
- 크롬 HTML Import 시 중복 URL도 모두 새로 추가 허용
- 동일 URL의 북마크가 여러 개 존재할 수 있음
- 결과 요약: `{ imported: number; failed: number }` 반환

---

## 4. Tag

### 속성

| 필드 | 타입 | 제약 | 설명 |
|------|------|------|------|
| id | String (CUID) | PK | 내부 식별자 |
| user_id | String | FK → User, NOT NULL | 소유자 |
| name | String | NOT NULL | 태그 이름 |
| created_at | DateTime | NOT NULL | 생성 시각 |

### 제약
- `(user_id, name)` UNIQUE — 사용자별 태그 이름 중복 불가
- 태그는 사용자별로 격리 (다른 사용자의 태그와 공유 없음)
- 소문자 정규화: 저장 시 `name.toLowerCase().trim()` 적용

---

## 5. BookmarkTag (관계 테이블)

| 필드 | 타입 | 제약 |
|------|------|------|
| bookmark_id | String | FK → Bookmark |
| tag_id | String | FK → Tag |

- `(bookmark_id, tag_id)` UNIQUE (복합 PK)
- 북마크 삭제 시 cascade 삭제

---

## 6. Group

### 속성

| 필드 | 타입 | 제약 | 설명 |
|------|------|------|------|
| id | String (CUID) | PK | 내부 식별자 |
| user_id | String | FK → User, NOT NULL | 소유자 |
| name | String | NOT NULL | 그룹 이름 |
| emoji | String? | nullable | 이모지 아이콘 |
| position | Int | NOT NULL | 대시보드 컬럼 순서 |
| created_at | DateTime | NOT NULL | 생성 시각 |
| updated_at | DateTime | NOT NULL | 수정 시각 |

### 삭제 동작
- 그룹 삭제 시 `BookmarkGroup` 레코드만 삭제
- 북마크 원본은 유지 (인박스로 자동 이동)
- 그룹 → 컬렉션 변환 시 (Q11: A): 원본 그룹 유지, 북마크도 그룹에 그대로 남음

---

## 7. BookmarkGroup (관계 테이블)

| 필드 | 타입 | 제약 | 설명 |
|------|------|------|------|
| bookmark_id | String | FK → Bookmark | |
| group_id | String | FK → Group | |
| position | Int | NOT NULL | 그룹 내 북마크 순서 |

- `(bookmark_id, group_id)` UNIQUE (복합 PK)
- 하나의 북마크가 여러 그룹에 동시 소속 가능 (다대다)

---

## 8. Collection

### 속성

| 필드 | 타입 | 제약 | 설명 |
|------|------|------|------|
| id | String (CUID) | PK | 내부 식별자 |
| user_id | String | FK → User, NOT NULL | 소유자 |
| name | String | NOT NULL | 컬렉션 이름 |
| emoji | String? | nullable | 이모지 아이콘 |
| description | String? | nullable | 설명 |
| slug | String | UNIQUE, NOT NULL | 공개 URL 식별자 |
| is_public | Boolean | DEFAULT false | 공개 여부 |
| template | Enum | NOT NULL | `guide` 또는 `profile` |
| view_count | Int | DEFAULT 0 | 조회수 |
| blocks | Json | DEFAULT [] | 블록 배열 (JSONB) |
| position | Int | NOT NULL | 사이드바 순서 |
| created_at | DateTime | NOT NULL | 생성 시각 |
| updated_at | DateTime | NOT NULL | 수정 시각 |

### 슬러그 생성 규칙 (Q5: C)
- 컬렉션 생성 시 커스텀 alphabet nanoid로 자동 생성 (소문자 + 숫자만, 예: `v1stgxr8ab`)
  - alphabet: `0123456789abcdefghijklmnopqrstuvwxyz` (대문자·특수문자 제외)
  - 길이: 10자
- 사용자가 커스텀 슬러그로 변경 가능
- 슬러그 유효성: 영문 소문자, 숫자, 하이픈만 허용 (`^[a-z0-9-]+$`)
- 슬러그 중복 처리 (Q18: C): 실시간 debounce 체크 + 저장 시 최종 검증

### 블록 저장 방식 (Q4: A)
- JSONB 배열로 저장 (`blocks` 컬럼)
- 블록 순서 변경: 배열 전체 교체 (단일 UPDATE)
- 통계는 `CollectionLinkClick` 별도 테이블로 관리

---

## 9. Block (JSONB 내 구조)

```typescript
type Block = LinkBlock | TextBlock | ImageBlock

interface BaseBlock {
  id: string          // nanoid(8) — JSONB 내 고유 식별자
  type: 'link' | 'text' | 'image'
  position: number    // 정렬 순서 (0부터 시작)
}

interface LinkBlock extends BaseBlock {
  type: 'link'
  content: {
    bookmark_id: string | null  // 연결된 북마크 ID (삭제 시 null)
    url: string                 // 스냅샷 URL (bookmark_id null 시에도 유지)
    title: string               // 스냅샷 제목
    description: string | null  // 스냅샷 설명
    thumbnail_url: string | null
    tags: string[]              // 스냅샷 태그 이름 배열
  }
}

interface TextBlock extends BaseBlock {
  type: 'text'
  content: {
    markdown: string  // 마크다운 텍스트
  }
}

interface ImageBlock extends BaseBlock {
  type: 'image'
  content: {
    image_url: string   // CloudFront URL 또는 외부 URL
    alt: string | null  // 대체 텍스트
    caption: string | null
  }
}
```

### 링크 블록 추가 방식 (Q6: C)
두 가지 경로 모두 지원:
1. **기존 북마크 연결**: `bookmark_id` 설정, 스냅샷 데이터 복사
2. **URL 직접 입력**: `bookmark_id = null`, MetadataService로 OG 태그 fetch 후 스냅샷 저장

---

## 10. CollectionLike

| 필드 | 타입 | 제약 | 설명 |
|------|------|------|------|
| id | String (CUID) | PK | |
| collection_id | String | FK → Collection | |
| fingerprint | String | NOT NULL | user_id 기반 고유 식별자 |
| created_at | DateTime | NOT NULL | |

- `(collection_id, fingerprint)` UNIQUE — 중복 좋아요 방지
- **좋아요 주체 (Q15: C)**: 로그인 사용자만 가능
  - 비로그인 사용자는 좋아요 버튼 클릭 시 로그인 페이지로 redirect
  - fingerprint = `SHA256(user_id)` — 동일 사용자 중복 방지, user_id 직접 노출 방지
  - 동일 사용자의 중복 좋아요 방지

---

## 11. CollectionLinkClick

| 필드 | 타입 | 제약 | 설명 |
|------|------|------|------|
| id | String (CUID) | PK | |
| collection_id | String | FK → Collection | |
| block_id | String | NOT NULL | JSONB 블록 UUID (앱 레벨 참조) |
| clicked_at | DateTime | NOT NULL | 클릭 시각 |

- DB FK 없음 (block_id는 JSONB 내 블록 id를 텍스트로 저장)
- 비로그인 사용자도 클릭 기록 가능 (공개 페이지)

---

## 12. 인덱스 전략

```sql
-- 사용자별 데이터 조회 (모든 테이블 공통)
CREATE INDEX idx_bookmark_user_id ON "Bookmark"(user_id);
CREATE INDEX idx_group_user_id ON "Group"(user_id);
CREATE INDEX idx_collection_user_id ON "Collection"(user_id);
CREATE INDEX idx_tag_user_id ON "Tag"(user_id);

-- 인박스 조회 (그룹 미소속 북마크)
CREATE INDEX idx_bookmark_group_group_id ON "BookmarkGroup"(group_id);

-- 컬렉션 공개 페이지 조회
CREATE UNIQUE INDEX idx_collection_slug ON "Collection"(slug);
CREATE INDEX idx_collection_public ON "Collection"(is_public) WHERE is_public = true;

-- 풀텍스트 검색 (GIN 인덱스)
-- 북마크: 제목 + URL + 메모 + 태그
CREATE INDEX idx_bookmark_fts ON "Bookmark" USING GIN(
  to_tsvector('simple',
    coalesce(title, '') || ' ' ||
    coalesce(url, '') || ' ' ||
    coalesce(memo, '')
  )
);
-- 컬렉션: 이름 + 설명 + 블록 텍스트 (generated column 활용)
CREATE INDEX idx_collection_fts ON "Collection" USING GIN(
  to_tsvector('simple',
    coalesce(name, '') || ' ' ||
    coalesce(description, '')
  )
);

-- 좋아요 중복 방지
CREATE UNIQUE INDEX idx_collection_like_unique ON "CollectionLike"(collection_id, fingerprint);

-- 통계 조회
CREATE INDEX idx_collection_link_click ON "CollectionLinkClick"(collection_id, block_id);
```
