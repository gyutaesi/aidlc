# Domain Entities — Unit 3: Chrome Extension

> **Unit**: Chrome Extension  
> **작성일**: 2026-05-20

---

## 1. Extension 내부 도메인 엔티티

Extension은 서버 DB를 직접 소유하지 않으며, 아래 엔티티는 `chrome.storage.local`에 저장되거나 API 응답을 로컬에서 표현하는 형태입니다.

---

### AuthState

Extension의 인증 상태를 나타내는 로컬 엔티티.

```typescript
interface AuthState {
  isLoggedIn: boolean
  accessToken: string | null       // Cognito Access Token (JWT)
  refreshToken: string | null      // Cognito Refresh Token
  idToken: string | null           // Cognito ID Token (사용자 정보 포함)
  expiresAt: number | null         // Access Token 만료 시각 (Unix timestamp ms)
  userId: string | null            // Cognito sub (사용자 고유 ID)
  email: string | null
}
```

**저장 위치**: `chrome.storage.local` (`key: 'auth'`)  
**갱신 시점**: 로그인 성공, 토큰 자동 갱신, 로그아웃

---

### SavedUrlCache

추천 필터링 및 중복 저장 감지를 위한 URL 캐시 엔티티.

```typescript
interface SavedUrlCache {
  urls: string[]          // 저장된 북마크 URL 목록
  cachedAt: number        // 캐시 생성 시각 (Unix timestamp ms)
  ttl: number             // TTL (기본 5분 = 300_000ms)
}
```

**저장 위치**: `chrome.storage.local` (`key: 'savedUrlCache'`)  
**무효화 시점**: 북마크 저장 성공 시 즉시 무효화, TTL 만료 시

---

### BookmarkDraft

팝업 "저장" 탭에서 사용자가 입력 중인 임시 데이터.

```typescript
interface BookmarkDraft {
  url: string             // 현재 탭 URL (chrome.tabs에서 자동 주입)
  title: string           // 현재 탭 제목 (chrome.tabs에서 자동 주입, 수정 가능)
  memo: string            // 사용자 입력 메모 (선택)
  tags: string[]          // 사용자 입력 태그 (쉼표 구분 파싱)
  groupId: string | null  // 선택한 그룹 ID (null = 인박스)
}
```

**저장 위치**: React 컴포넌트 state (팝업 닫히면 초기화)

---

### RecentBookmark

"최근" 탭에 표시되는 최근 저장 북마크 (API 응답 표현).

```typescript
interface RecentBookmark {
  id: string
  url: string
  title: string
  thumbnailUrl: string | null
  savedAt: string         // ISO 8601
}
```

**출처**: `GET /api/bookmarks/recent` 응답  
**표시 개수**: 최대 5개

---

### RecommendedSite

"추천" 탭에 표시되는 미등록 자주 방문 사이트.

```typescript
interface RecommendedSite {
  url: string
  title: string
}
```

**출처**: `chrome.topSites.get()` 결과에서 `SavedUrlCache.urls`에 없는 항목 필터링  
**표시 개수**: 최대 5개

---

### Group

저장 시 그룹 선택 드롭다운에 사용되는 그룹 정보 (API 응답 표현).

```typescript
interface Group {
  id: string
  name: string
  emoji: string | null
}
```

**출처**: `GET /api/groups` 응답  
**캐시**: 팝업 세션 동안 메모리 캐시 (React state)

---

## 2. 엔티티 관계

```
AuthState (chrome.storage.local)
    |
    └── accessToken → API 호출 시 Authorization 헤더에 첨부
    └── refreshToken → 만료 시 자동 갱신

SavedUrlCache (chrome.storage.local)
    |
    ├── BookmarkDraft.url 비교 → 중복 저장 감지 (Q11)
    └── RecommendedSite 필터링 → 이미 저장된 URL 제외 (Q9)

BookmarkDraft (React state)
    |
    └── POST /api/bookmarks → 저장 성공 시 SavedUrlCache 무효화
```

---

## 3. chrome.storage.local 키 목록

| Key | 타입 | 설명 |
|-----|------|------|
| `auth` | `AuthState` | 인증 토큰 및 사용자 정보 |
| `savedUrlCache` | `SavedUrlCache` | 저장된 URL 캐시 (5분 TTL) |
