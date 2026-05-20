# Unit 2 (Application) — Frontend Components

> **작성일**: 2026-05-20  
> **단계**: Construction Phase — Functional Design

---

## 1. 컴포넌트 계층 구조

```
app/
├── (auth)/
│   ├── login/page.tsx              → LoginPage
│   ├── signup/page.tsx             → SignupPage
│   └── verify/page.tsx             → VerifyPage
│
├── (dashboard)/                    → DashboardLayout (공통 레이아웃)
│   ├── inbox/page.tsx              → InboxPage
│   ├── groups/page.tsx             → GroupDashboardPage
│   ├── collections/page.tsx        → CollectionsListPage
│   ├── collections/[id]/page.tsx   → CollectionEditorPage
│   ├── search/page.tsx             → SearchPage
│   ├── import/page.tsx             → ImportPage
│   └── settings/page.tsx          → SettingsPage
│
└── c/[slug]/page.tsx               → PublicCollectionPage (공개, 인증 불필요)

components/
├── ui/                             → 재사용 기본 컴포넌트
│   ├── Button, Input, Modal
│   ├── Toast, Dropdown, Badge
│   ├── DragDropList, TagInput
│   └── MarkdownRenderer
│
└── features/                       → 도메인별 복합 컴포넌트
    ├── bookmark/
    ├── group/
    ├── collection/
    └── search/
```

---

## 2. 레이아웃 컴포넌트

### DashboardLayout

- **타입**: Server Component (공통 레이아웃)
- **역할**: 사이드바 네비게이션 + 상단 헤더 + 메인 콘텐츠 영역
- **포함 요소**:
  - 사이드바: 인박스, 그룹 목록, 컬렉션 목록, 설정 링크
  - 헤더: 글로벌 "+" 버튼 (북마크 저장), Cmd+K 검색 트리거, 사용자 메뉴
- **반응형**: 모바일에서 사이드바 → 하단 탭 바로 전환

---

## 3. 인증 페이지

### LoginPage

- **타입**: Server Component + Client Form
- **상태**: 이메일, 비밀번호, 로딩, 에러 메시지
- **폼 유효성**: 이메일 형식, 비밀번호 최소 8자
- **API 연동**: Server Action `signIn()`
- **성공 시**: `/inbox` redirect

### SignupPage

- **타입**: Server Component + Client Form
- **상태**: 이메일, 비밀번호, 비밀번호 확인, 로딩, 에러
- **폼 유효성**: 이메일 형식, 비밀번호 일치 여부
- **API 연동**: Server Action `signUp()`
- **성공 시**: `/verify` redirect (이메일 인증 안내)

### VerifyPage

- **타입**: Client Component
- **상태**: 인증 코드 6자리, 로딩, 에러
- **API 연동**: Server Action `confirmSignUp()` → `syncCognitoUser()`
- **성공 시**: `/login` redirect

---

## 4. 인박스 페이지

### InboxPage

- **타입**: Server Component (초기 데이터 fetch) + Client 인터랙션
- **레이아웃 (Q12: A)**: 카드 그리드 (썸네일 이미지 포함)
  - 데스크탑: 3열 그리드
  - 태블릿: 2열 그리드
  - 모바일: 1열 (전체 너비 카드)
- **상단 컨트롤**:
  - 정렬 드롭다운: 최신순 / 오래된순
  - 필터 탭: 전체 / 읽지 않음 / 읽음
  - 북마크 수 표시

#### BookmarkCard (인박스용)

- **타입**: Client Component
- **Props**:
  ```typescript
  interface BookmarkCardProps {
    bookmark: Bookmark & { tags: Tag[] }
    onMarkAsRead: (id: string) => void
    onMoveToGroup: (id: string) => void
    onMoveToCollection: (id: string) => void
    onDelete: (id: string) => void
  }
  ```
- **표시 요소**: 썸네일 이미지, 제목, URL 도메인, 메모 미리보기, 태그 배지, 저장 날짜
- **읽음 상태**: 미읽음 카드에 파란 점 표시
- **URL 클릭**: 외부 링크 열기 + 자동 읽음 처리 (Q1: C)
- **액션 메뉴** (카드 우상단 "..." 버튼):
  - 읽음 처리 / 읽지 않음 처리
  - 그룹으로 이동 (그룹 선택 드롭다운)
  - 컬렉션으로 이동 (컬렉션 선택 드롭다운)
  - 삭제

#### BookmarkSaveModal

- **타입**: Client Component (글로벌 "+" 버튼 클릭 시 열림)
- **상태**: url, title, description, memo, tagNames[], groupId, 로딩, 메타데이터 fetch 상태
- **URL 입력 흐름**:
  1. URL 붙여넣기 → 자동으로 OG 메타데이터 fetch 시작
  2. 로딩 스피너 표시
  3. 성공: 제목/설명/썸네일 자동 채움
  4. 실패: 토스트 메시지 표시 (Q17: B) + 수동 입력 필드 활성화
- **태그 입력**: TagInput 컴포넌트 (자동완성 포함)
- **그룹 선택**: 드롭다운 (선택 안 하면 인박스)
- **API 연동**: Server Action `createBookmark()`

---

## 5. 그룹 대시보드 페이지

### GroupDashboardPage

- **타입**: Server Component (초기 데이터) + Client 드래그앤드롭
- **레이아웃 (데스크탑)**: Toby 스타일 가로 컬럼 (각 그룹 = 1 컬럼)
  - 컬럼 너비: 280px 고정
  - 가로 스크롤 가능
- **레이아웃 (모바일, Q16: B)**: 세로 스택 (accordion)
  - 각 그룹 컬럼이 위아래로 쌓임
  - 그룹 헤더 클릭으로 접기/펼치기

#### GroupColumn

- **타입**: Client Component
- **Props**:
  ```typescript
  interface GroupColumnProps {
    group: Group & { bookmarks: Bookmark[] }
    onAddBookmark: (groupId: string) => void
    onReorder: (groupId: string, orderedIds: string[]) => void
    onEdit: (group: Group) => void
    onDelete: (groupId: string) => void
    onConvertToCollection: (groupId: string) => void
  }
  ```
- **헤더**: 이모지 + 그룹 이름 + 북마크 수 + 편집/삭제 메뉴
- **북마크 목록**: 드래그앤드롭 정렬 (dnd-kit 사용)
- **하단**: "링크 추가" 버튼 (Q13: D) → BookmarkSaveModal 열기 (groupId 사전 선택)
- **컬렉션 변환**: 북마크 체크박스 선택 → "컬렉션으로 변환" 버튼

#### GroupBookmarkItem (그룹 내 북마크 아이템)

- **타입**: Client Component
- **표시**: 파비콘, 제목, URL 도메인
- **드래그 핸들**: 좌측 아이콘
- **URL 클릭**: 외부 링크 열기 + 자동 읽음 처리
- **액션**: 인박스로 이동, 다른 그룹으로 이동, 삭제

---

## 6. 컬렉션 목록 페이지

### CollectionsListPage

- **타입**: Server Component (초기 데이터 fetch)
- **레이아웃**: 카드 그리드 (컬렉션 이름, 이모지, 설명, 블록 수, 공개 여부 표시)
- **상단 컨트롤**: "새 컬렉션 만들기" 버튼
- **컬렉션 카드 클릭**: 편집 페이지(`/collections/[id]`)로 이동
- **공개 링크 복사**: 카드 내 공유 아이콘 클릭 시 `/c/{slug}` URL 클립보드 복사
- **드래그앤드롭**: 컬렉션 순서 변경 (DragDropList 사용)

---

## 7. 컬렉션 편집 페이지

### CollectionEditorPage

- **타입**: Server Component (초기 데이터) + Client 편집
- **레이아웃**: 좌측 편집 영역 + 우측 미리보기 (데스크탑 2열)
- **헤더**: 컬렉션 이름, 이모지, 공개/비공개 토글, 슬러그 편집, 공유 링크 복사

#### CollectionHeader

- **타입**: Client Component
- **상태**: name, emoji, isPublic, slug, slugStatus('idle'|'checking'|'available'|'taken')
- **슬러그 편집**:
  - 입력 중 debounce 300ms → `GET /api/collections/slug-check` 호출
  - 사용 가능: 초록 체크 표시
  - 중복: 빨간 X + "이미 사용 중인 슬러그입니다" 메시지
  - 저장 버튼: slug 상태가 'taken'이면 비활성화

#### BlockList

- **타입**: Client Component
- **상태**: blocks[], dragState
- **드래그앤드롭**: dnd-kit으로 블록 순서 변경
- **각 블록 렌더링**: 블록 타입에 따라 LinkBlockItem / TextBlockItem / ImageBlockItem

#### AddBlockButton (Q14: A)

- **타입**: Client Component
- **동작**: 클릭 → 타입 선택 드롭다운 (링크 / 텍스트 / 이미지)
- **타입 선택 후**: 해당 타입의 입력 폼 모달 열기

#### LinkBlockForm

- **타입**: Client Component
- **두 가지 입력 경로 (Q6: C)**:
  - 탭 1 "기존 북마크": 북마크 검색/선택 → 자동으로 스냅샷 채움
  - 탭 2 "URL 직접 입력": URL 입력 → OG 메타데이터 fetch → 스냅샷 채움
- **Props**: `onSubmit: (block: AddBlockInput) => void`

#### TextBlockForm

- **타입**: Client Component
- **입력**: 마크다운 텍스트 영역 (최대 5000자)
- **미리보기**: 실시간 마크다운 렌더링 (MarkdownRenderer 컴포넌트)

#### ImageBlockForm

- **타입**: Client Component
- **두 가지 입력**:
  - 파일 업로드: S3 Pre-signed URL → 직접 업로드 → CloudFront URL
  - URL 직접 입력: 외부 이미지 URL
- **미리보기**: 업로드/입력 후 이미지 미리보기

---

## 8. 공개 컬렉션 페이지

### PublicCollectionPage (`/c/[slug]`)

- **타입**: Server Component (SSR, 비로그인 접근 가능)
- **데이터 fetch**: `CollectionService.getPublicBySlug(slug)` + 조회수 increment
- **404 처리**: 슬러그 없거나 `is_public = false`이면 Next.js `notFound()`

#### PublicCollectionHeader

- **표시**: 컬렉션 이름, 이모지, 설명, 소유자 정보, 조회수, 좋아요 수
- **좋아요 버튼 (Q15: C)**:
  - 로그인 사용자: 좋아요 토글 버튼 (좋아요 여부 표시)
  - 비로그인 사용자: 버튼 클릭 시 `/login?redirect=/c/{slug}` redirect

#### PublicBlockRenderer

- **타입**: Client Component (링크 클릭 이벤트 처리 필요)
- **템플릿별 렌더링**:
  - `guide` 템플릿: 번호 있는 순서 목록 스타일
  - `profile` 템플릿: 카드 그리드 스타일
- **링크 블록**: 클릭 시 클릭 통계 기록(`POST /api/collections/[id]/view`) + 외부 링크 열기
- **텍스트 블록**: MarkdownRenderer로 렌더링 (sanitize 적용)
- **이미지 블록**: Next.js Image 컴포넌트 (CloudFront CDN)

---

## 9. 검색 모달

### SearchModal (Cmd+K)

- **타입**: Client Component (전역 상태로 열기/닫기)
- **트리거**: `Cmd+K` (Mac) / `Ctrl+K` (Windows) 단축키
- **상태**: query, results[], isLoading, selectedIndex
- **검색 흐름**:
  1. 입력 debounce 200ms
  2. `GET /api/search?q={query}` 호출
  3. 결과 표시: 북마크 / 컬렉션 섹션 구분
- **키보드 네비게이션**: 위/아래 화살표로 결과 선택, Enter로 이동
- **결과 클릭**:
  - 북마크: 해당 URL 외부 링크 열기
  - 컬렉션: 컬렉션 편집 페이지로 이동

#### SearchResultItem

- **Props**: `result: SearchResult`
- **표시**: 타입 아이콘, 제목, URL/설명 미리보기, 검색어 하이라이트

---

## 10. Import 페이지

### ImportPage

- **타입**: Client Component
- **상태**: file, isUploading, result({ imported, failed }), error
- **UI 흐름**:
  1. 파일 드롭존 (크롬 북마크 HTML 파일)
  2. 파일 선택 후 "Import 시작" 버튼
  3. 로딩 스피너 (대용량 파일 처리 중)
  4. 완료: 결과 요약 토스트 ("N개 추가 완료, M개 실패")
- **API 연동**: Server Action `importBookmarks()`

---

## 11. 설정 페이지

### SettingsPage

- **타입**: Server Component + Client 폼
- **섹션**:
  - 계정 정보: 이메일 표시 (변경 불가, Cognito 관리)
  - 비밀번호 변경: Cognito ChangePassword API
  - 데이터 내보내기: JSON / Chrome HTML 다운로드 버튼
  - 로그아웃 버튼

---

## 12. 공통 UI 컴포넌트

### TagInput

- **타입**: Client Component
- **기능**: 태그 입력 + 자동완성 드롭다운
- **Props**:
  ```typescript
  interface TagInputProps {
    value: string[]
    onChange: (tags: string[]) => void
    userId: string
  }
  ```
- **자동완성**: 입력 중 debounce 200ms → `GET /api/tags?prefix={input}` 호출
- **태그 추가**: Enter 또는 쉼표로 추가
- **태그 삭제**: 배지의 X 버튼 또는 Backspace

### Toast

- **타입**: Client Component (전역 상태)
- **종류**: success, error, info, warning
- **자동 닫힘**: 3초 후

### MarkdownRenderer

- **타입**: Client Component
- **라이브러리**: `react-markdown` + `rehype-sanitize`
- **허용 태그**: p, h1~h6, ul, ol, li, a, strong, em, code, pre, blockquote
- **링크**: `target="_blank" rel="noopener noreferrer"` 자동 추가

### DragDropList

- **타입**: Client Component
- **라이브러리**: `@dnd-kit/core`, `@dnd-kit/sortable`
- **Props**:
  ```typescript
  interface DragDropListProps<T> {
    items: T[]
    onReorder: (orderedIds: string[]) => void
    renderItem: (item: T) => React.ReactNode
    getItemId: (item: T) => string
  }
  ```

---

## 13. 상태 관리 전략

### 서버 상태 (Server State)

- Next.js App Router의 Server Component에서 직접 fetch
- 변경 후 `revalidatePath()` 또는 `revalidateTag()`로 캐시 무효화
- Server Action에서 처리

### 클라이언트 상태 (Client State)

- 로컬 UI 상태: `useState` (모달 열기/닫기, 폼 입력값 등)
- 전역 UI 상태: `useContext` (Toast, SearchModal 열기/닫기)
- 서버 상태 캐싱: React Query 또는 SWR (API Route 호출 시)

### 드래그앤드롭 낙관적 업데이트

```
[사용자: 드래그앤드롭 완료]
        |
        v
[클라이언트: 즉시 UI 순서 변경 (낙관적 업데이트)]
        |
        v
[Server Action: reorderBookmarks() / reorderBlocks()]
  - 성공: 그대로 유지
  - 실패: 원래 순서로 롤백 + 에러 토스트
```

---

## 14. API 연동 매핑

| 컴포넌트                      | API / Server Action                | 메서드 |
| ----------------------------- | ---------------------------------- | ------ |
| BookmarkSaveModal             | Server Action: createBookmark      | POST   |
| BookmarkCard (읽음)           | Server Action: markAsRead          | PATCH  |
| BookmarkCard (이동)           | Server Action: moveToGroup         | PATCH  |
| GroupColumn (순서)            | Server Action: reorderBookmarks    | PATCH  |
| GroupColumn (변환)            | Server Action: convertToCollection | POST   |
| CollectionHeader (슬러그)     | GET /api/collections/slug-check    | GET    |
| CollectionHeader (저장)       | Server Action: updateCollection    | PATCH  |
| BlockList (순서)              | Server Action: reorderBlocks       | PATCH  |
| AddBlockButton                | Server Action: addBlock            | POST   |
| PublicCollectionPage (좋아요) | POST /api/collections/[id]/like    | POST   |
| PublicBlockRenderer (클릭)    | POST /api/collections/[id]/view    | POST   |
| SearchModal                   | GET /api/search                    | GET    |
| TagInput (자동완성)           | GET /api/tags                      | GET    |
| ImageBlockForm (업로드)       | POST /api/upload/presigned         | POST   |
| ImportPage                    | Server Action: importBookmarks     | POST   |
| SettingsPage (export)         | GET /api/export                    | GET    |
