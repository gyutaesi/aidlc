# Frontend Components — Unit 3: Chrome Extension

> **Unit**: Chrome Extension  
> **작성일**: 2026-05-20

---

## 1. 컴포넌트 계층 구조

```
App (popup/App.tsx)
├── LoginScreen (로그인 미상태)
│   └── LoginButton
└── MainLayout (로그인 상태)
    ├── Header
    │   └── SettingsMenu (로그아웃 포함)
    ├── TabBar ("저장" | "최근" | "추천")
    └── TabContent
        ├── SavePage (탭: 저장)
        │   ├── PageInfo (URL, 제목 표시/편집)
        │   ├── GroupSelect (드롭다운)
        │   ├── TagInput (쉼표 구분 입력)
        │   ├── MemoInput (textarea)
        │   └── SaveButton / AlreadySavedBanner
        ├── RecentList (탭: 최근)
        │   └── RecentItem[] (최대 5개)
        └── Recommend (탭: 추천)
            └── RecommendItem[] (최대 5개)
```

---

## 2. 컴포넌트 상세

### App (`popup/App.tsx`)

**역할**: 루트 컴포넌트. 인증 상태 확인 및 초기 데이터 로드 조율.

```typescript
interface AppState {
  authState: AuthState | null
  isLoading: boolean          // 초기 로드 중
  activeTab: 'save' | 'recent' | 'recommend'
  currentTabUrl: string
  currentTabTitle: string
  savedUrlCache: string[]     // 중복 감지 및 추천 필터링용
  groups: Group[]
}
```

**초기화 useEffect**:
1. `AuthManager.getAuthState()` 호출
2. 로그인 상태면 병렬로:
   - `chrome.tabs.query()` → currentTabUrl, currentTabTitle
   - `SavedUrlCache` 확인 또는 `GET /api/bookmarks/urls`
   - `GET /api/groups`

---

### LoginScreen

**역할**: 미로그인 상태 화면.

```typescript
interface LoginScreenProps {
  onLoginSuccess: (authState: AuthState) => void
}
```

**UI 구성**:
- moaring 로고/아이콘
- "moaring에 로그인하여 북마크를 저장하세요" 안내 문구
- "로그인" 버튼 → `AuthManager.login()` 호출

---

### Header

**역할**: 상단 헤더. 앱 이름 + 설정 메뉴.

```typescript
interface HeaderProps {
  email: string | null
  onLogout: () => void
}
```

**UI 구성**:
- 좌측: "moaring" 텍스트 로고
- 우측: 설정 아이콘(⚙️) → 클릭 시 드롭다운
  - 사용자 이메일 표시 (비활성)
  - "로그아웃" 버튼

---

### TabBar

**역할**: 탭 네비게이션.

```typescript
interface TabBarProps {
  activeTab: 'save' | 'recent' | 'recommend'
  onTabChange: (tab: 'save' | 'recent' | 'recommend') => void
}
```

**탭 순서**: 저장 → 최근 → 추천  
**UI**: 하단 보더 강조 방식의 탭 버튼 3개

---

### SavePage (`popup/SavePage.tsx`)

**역할**: 현재 페이지 저장 폼.

```typescript
interface SavePageProps {
  initialUrl: string
  initialTitle: string
  groups: Group[]
  savedUrls: string[]           // 중복 감지용
  onSaveSuccess: () => void     // 저장 성공 시 App에서 window.close() 호출
  onNavigateToSave: (url: string, title: string) => void  // 추천에서 전환 시
}

interface SavePageState {
  url: string
  title: string
  memo: string
  tagInput: string              // 쉼표 구분 원본 문자열
  selectedGroupId: string | null
  isSaving: boolean
  isAlreadySaved: boolean
  error: string | null
}
```

**UI 구성**:

1. **PageInfo 섹션**
   - URL: 읽기 전용 텍스트 (truncate)
   - 제목: 편집 가능한 input (chrome.tabs에서 자동 주입)

2. **AlreadySavedBanner** (isAlreadySaved === true일 때)
   - "이미 저장된 페이지입니다" 배너
   - "웹앱에서 보기 →" 링크 (moaring 웹앱 인박스로 이동)
   - 저장 폼 숨김

3. **GroupSelect**
   - `<select>` 드롭다운
   - 첫 번째 옵션: "인박스 (기본)" (value: "")
   - 이후 옵션: groups 배열 순서대로 `{emoji} {name}`

4. **TagInput**
   - placeholder: "태그 입력 (쉼표로 구분)"
   - 입력값을 쉼표로 분리하여 태그 미리보기 표시

5. **MemoInput**
   - `<textarea>` rows=3
   - placeholder: "메모 (선택사항)"

6. **SaveButton**
   - "저장하기" 텍스트
   - isSaving 중: 로딩 스피너 + 비활성화
   - URL이 http/https 아닌 경우: 비활성화

---

### RecentList (`popup/RecentList.tsx`)

**역할**: 최근 저장 북마크 목록.

```typescript
interface RecentListProps {
  savedUrls: string[]   // 캐시 갱신 트리거용
}

interface RecentListState {
  items: RecentBookmark[]
  isLoading: boolean
  error: string | null
}
```

**데이터 로드**: 탭 활성화 시 `GET /api/bookmarks/recent?limit=5` 호출

**RecentItem UI**:
- 파비콘 (URL에서 추출: `https://www.google.com/s2/favicons?domain={domain}`)
- 제목 (1줄 truncate)
- URL (1줄 truncate, 회색)
- 저장 시각 (상대 시간: "3분 전", "2시간 전")
- 클릭 시 해당 URL을 새 탭으로 열기

---

### Recommend (`popup/Recommend.tsx`)

**역할**: 자주 방문하지만 저장 안 된 사이트 추천.

```typescript
interface RecommendProps {
  savedUrls: string[]   // 필터링용
}

interface RecommendState {
  items: RecommendedSite[]
  isLoading: boolean
  error: string | null
}
```

**데이터 로드**: 탭 활성화 시 `TopSitesRecommender.getUnregisteredSites(savedUrls)` 호출

**RecommendItem UI**:
- 파비콘
- 사이트 제목 (1줄 truncate)
- URL (1줄 truncate, 회색)
- "저장" 버튼 → 클릭 시 해당 url/title을 SavePage에 주입하고 "저장" 탭으로 전환

---

### Toast (공통 컴포넌트)

**역할**: 에러/성공 알림 표시.

```typescript
interface ToastProps {
  message: string
  type: 'error' | 'success' | 'info'
  duration?: number   // ms, 기본 3000
}
```

**동작**: 지정 시간 후 자동 사라짐. 팝업 하단에 고정 위치.

---

## 3. 팝업 레이아웃 스펙

| 항목 | 값 |
|------|-----|
| 너비 | 360px (고정) |
| 최대 높이 | 600px (내용에 따라 자동) |
| 배경 | 흰색 |
| 폰트 | 시스템 폰트 (TailwindCSS 기본) |
| 스타일 | TailwindCSS |

**body 스타일** (`popup.html`):
```css
body {
  width: 360px;
  max-height: 600px;
  overflow-y: auto;
  margin: 0;
}
```

---

## 4. 사용자 인터랙션 흐름 요약

```
[팝업 오픈]
    |
    ├── 미로그인 → LoginScreen → 로그인 버튼 → Cognito Hosted UI
    |
    └── 로그인 → MainLayout (기본: 저장 탭)
                    |
                    ├── 저장 탭
                    │   ├── 이미 저장됨 → AlreadySavedBanner → 웹앱 링크
                    │   └── 미저장 → 폼 입력 → 저장 → 팝업 닫힘
                    |
                    ├── 최근 탭
                    │   └── 항목 클릭 → 새 탭으로 URL 열기
                    |
                    └── 추천 탭
                        └── 항목 "저장" 클릭 → 저장 탭으로 전환 (URL/title 채워짐)
```

---

## 5. API 연동 포인트

| 컴포넌트 | API | 시점 |
|----------|-----|------|
| App | `GET /api/bookmarks/urls` | 초기화 시 (캐시 없거나 만료) |
| App | `GET /api/groups` | 초기화 시 |
| SavePage | `POST /api/bookmarks` | 저장 버튼 클릭 |
| RecentList | `GET /api/bookmarks/recent?limit=5` | 탭 활성화 시 |
| Recommend | `chrome.topSites.get()` | 탭 활성화 시 |
