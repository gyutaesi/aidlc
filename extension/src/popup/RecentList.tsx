import { useEffect, useState } from 'react'
import { apiClient } from '../api-client'
import type { RecentBookmark } from '../types'
import { useAppStore } from '../store/useAppStore'
import { getErrorMessage } from '../errors'

const RECENT_LIMIT = 5

const relativeTimeFormatter = new Intl.RelativeTimeFormat('ko', {
  numeric: 'auto',
})

function formatRelativeTime(isoDate: string): string {
  const diffMs = new Date(isoDate).getTime() - Date.now()
  const diffSec = Math.round(diffMs / 1000)
  const diffMin = Math.round(diffSec / 60)
  const diffHour = Math.round(diffMin / 60)
  const diffDay = Math.round(diffHour / 24)

  if (Math.abs(diffSec) < 60) return relativeTimeFormatter.format(diffSec, 'second')
  if (Math.abs(diffMin) < 60) return relativeTimeFormatter.format(diffMin, 'minute')
  if (Math.abs(diffHour) < 24) return relativeTimeFormatter.format(diffHour, 'hour')
  return relativeTimeFormatter.format(diffDay, 'day')
}

function getFaviconUrl(url: string): string {
  try {
    const domain = new URL(url).hostname
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`
  } catch {
    return ''
  }
}

export function RecentList() {
  const showToast = useAppStore((s) => s.showToast)
  const [items, setItems] = useState<RecentBookmark[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setIsLoading(true)
      try {
        const data = await apiClient.getRecentBookmarks(RECENT_LIMIT)
        if (!cancelled) setItems(data)
      } catch (error) {
        if (!cancelled) showToast(getErrorMessage(error), 'error')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleClick = (url: string) => {
    chrome.tabs.create({ url })
  }

  if (isLoading) {
    return (
      <div className="px-4 py-6 text-center text-sm text-gray-500" data-testid="recent-list-loading">
        불러오는 중...
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="px-4 py-6 text-center text-sm text-gray-500" data-testid="recent-list-empty">
        최근 저장된 북마크가 없습니다
      </div>
    )
  }

  return (
    <ul className="divide-y divide-gray-100" data-testid="recent-list">
      {items.map((item) => (
        <li key={item.id}>
          <button
            type="button"
            onClick={() => handleClick(item.url)}
            className="w-full text-left px-4 py-2.5 hover:bg-gray-50 transition-colors flex gap-2.5 items-start"
            data-testid={`recent-list-item-${item.id}`}
          >
            <img
              src={getFaviconUrl(item.url)}
              alt=""
              width={16}
              height={16}
              className="mt-0.5 flex-shrink-0"
              onError={(e) => {
                ;(e.target as HTMLImageElement).style.visibility = 'hidden'
              }}
            />
            <div className="flex-1 min-w-0">
              <div className="text-sm text-gray-900 truncate">{item.title}</div>
              <div className="text-xs text-gray-500 truncate">{item.url}</div>
              <div className="text-xs text-gray-400 mt-0.5">
                {formatRelativeTime(item.savedAt)}
              </div>
            </div>
          </button>
        </li>
      ))}
    </ul>
  )
}
