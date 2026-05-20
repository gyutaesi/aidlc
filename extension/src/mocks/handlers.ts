// Mock API Client — VITE_USE_MOCK=true일 때 사용
// 실제 네트워크 호출 없이 IApiClient 인터페이스 구현

import type { IApiClient } from '../api-client'
import type { CreateBookmarkInput, RecentBookmark } from '../types'
import { mockGroups } from './data/groups.mock'
import { mockRecentBookmarks } from './data/bookmarks.mock'
import { mockSavedUrls } from './data/urls.mock'

const NETWORK_DELAY_MS = 300 // 실제 네트워크 지연 시뮬레이션

const delay = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms))

// 메모리 내 상태 (팝업 세션 동안 유지)
const recentBookmarks: RecentBookmark[] = [...mockRecentBookmarks]
const savedUrls: Set<string> = new Set(mockSavedUrls)

export const mockApiClient: IApiClient = {
  async postBookmark(input: CreateBookmarkInput) {
    await delay(NETWORK_DELAY_MS)

    // 새 북마크를 최근 목록 맨 앞에 추가
    const newBookmark: RecentBookmark = {
      id: `mock-${Date.now()}`,
      url: input.url,
      title: input.title,
      thumbnailUrl: null,
      savedAt: new Date().toISOString(),
    }
    recentBookmarks.unshift(newBookmark)
    savedUrls.add(input.url)

    // eslint-disable-next-line no-console
    console.log('[Mock] postBookmark:', input)
  },

  async getRecentBookmarks(limit) {
    await delay(NETWORK_DELAY_MS)
    return recentBookmarks.slice(0, limit)
  },

  async getSavedUrls() {
    await delay(NETWORK_DELAY_MS)
    return Array.from(savedUrls)
  },

  async getGroups() {
    await delay(NETWORK_DELAY_MS)
    return [...mockGroups]
  },
}
