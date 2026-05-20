import { useEffect, useState } from 'react'
import type { RecommendedSite } from '../types'
import { TopSitesRecommender } from '../top-sites'
import { useAppStore } from '../store/useAppStore'

const RECOMMEND_LIMIT = 5

interface RecommendProps {
  onSelectSite: (url: string, title: string) => void
}

function getFaviconUrl(url: string): string {
  try {
    const domain = new URL(url).hostname
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`
  } catch {
    return ''
  }
}

export function Recommend({ onSelectSite }: RecommendProps) {
  const savedUrls = useAppStore((s) => s.savedUrls)
  const [items, setItems] = useState<RecommendedSite[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setIsLoading(true)
      const data = await TopSitesRecommender.getRecommendations(
        savedUrls,
        RECOMMEND_LIMIT,
      )
      if (!cancelled) {
        setItems(data)
        setIsLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [savedUrls])

  if (isLoading) {
    return (
      <div
        className="px-4 py-6 text-center text-sm text-gray-500"
        data-testid="recommend-loading"
      >
        불러오는 중...
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div
        className="px-4 py-6 text-center text-sm text-gray-500"
        data-testid="recommend-empty"
      >
        추천할 사이트가 없습니다
      </div>
    )
  }

  return (
    <ul className="divide-y divide-gray-100" data-testid="recommend-list">
      {items.map((site) => (
        <li
          key={site.url}
          className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-gray-50 transition-colors"
        >
          <img
            src={getFaviconUrl(site.url)}
            alt=""
            width={16}
            height={16}
            className="flex-shrink-0"
            onError={(e) => {
              ;(e.target as HTMLImageElement).style.visibility = 'hidden'
            }}
          />
          <div className="flex-1 min-w-0">
            <div className="text-sm text-gray-900 truncate">{site.title}</div>
            <div className="text-xs text-gray-500 truncate">{site.url}</div>
          </div>
          <button
            type="button"
            onClick={() => onSelectSite(site.url, site.title)}
            className="flex-shrink-0 text-xs bg-moaring-primary hover:bg-moaring-primary-hover text-white font-medium px-2.5 py-1 rounded-md transition-colors"
            data-testid={`recommend-save-${encodeURIComponent(site.url)}`}
          >
            저장
          </button>
        </li>
      ))}
    </ul>
  )
}
