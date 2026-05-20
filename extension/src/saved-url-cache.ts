// SavedUrlCache — 저장된 URL 목록 캐시 (TTL 5분)
// chrome.storage.local 키: 'savedUrlCache'

import type { SavedUrlCacheEntry } from './types'

const STORAGE_KEY = 'savedUrlCache'
const DEFAULT_TTL_MS = 5 * 60 * 1000 // 5분

export const SavedUrlCache = {
  /**
   * 캐시 읽기 — 만료된 경우 null 반환
   */
  async get(): Promise<string[] | null> {
    const result = await chrome.storage.local.get(STORAGE_KEY)
    const entry = result[STORAGE_KEY] as SavedUrlCacheEntry | undefined

    if (!entry) return null

    const isExpired = Date.now() > entry.cachedAt + entry.ttl
    if (isExpired) return null

    return entry.urls
  },

  /**
   * 캐시 저장 (TTL 5분)
   */
  async set(urls: string[]): Promise<void> {
    const entry: SavedUrlCacheEntry = {
      urls,
      cachedAt: Date.now(),
      ttl: DEFAULT_TTL_MS,
    }
    await chrome.storage.local.set({ [STORAGE_KEY]: entry })
  },

  /**
   * 캐시 즉시 삭제 (북마크 저장 성공 시 호출)
   */
  async invalidate(): Promise<void> {
    await chrome.storage.local.remove(STORAGE_KEY)
  },
}
