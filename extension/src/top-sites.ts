// TopSitesRecommender — chrome.topSites + 저장된 URL 필터링

import type { RecommendedSite } from './types'

export const TopSitesRecommender = {
  /**
   * savedUrls에 없는 topSites 상위 N개 반환
   * chrome.topSites 실패 시 빈 배열 반환 (graceful degradation)
   */
  async getRecommendations(
    savedUrls: string[],
    limit: number,
  ): Promise<RecommendedSite[]> {
    try {
      const topSites = await chrome.topSites.get()
      const savedSet = new Set(savedUrls)

      return topSites
        .filter((site) => !savedSet.has(site.url))
        .slice(0, limit)
        .map((site) => ({ url: site.url, title: site.title }))
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[TopSitesRecommender] Failed to fetch top sites:', error)
      return []
    }
  },
}
