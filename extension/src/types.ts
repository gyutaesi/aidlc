// 공통 도메인 타입 정의

export interface AuthState {
  accessToken: string
  refreshToken: string
  idToken: string
  expiresAt: number // Unix timestamp ms
  userId: string
  email: string
}

export interface Group {
  id: string
  name: string
  emoji: string | null
}

export interface BookmarkDraft {
  url: string
  title: string
  memo: string
  tags: string[]
  groupId: string | null
}

export interface RecentBookmark {
  id: string
  url: string
  title: string
  thumbnailUrl: string | null
  savedAt: string // ISO 8601
}

export interface RecommendedSite {
  url: string
  title: string
}

export type ToastType = 'error' | 'success' | 'info'

export interface Toast {
  message: string
  type: ToastType
}

export interface SavedUrlCacheEntry {
  urls: string[]
  cachedAt: number
  ttl: number
}

export type ActiveTab = 'save' | 'recent' | 'recommend'

// 저장 요청 페이로드 (api-client에서 사용)
export interface CreateBookmarkInput {
  url: string
  title: string
  memo?: string
  tagNames?: string[]
  groupId?: string
}
