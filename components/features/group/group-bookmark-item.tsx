'use client'

import { ExternalLink, Trash2, MoveRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { BookmarkWithTags } from '@/lib/services/bookmark.service'

interface GroupBookmarkItemProps {
  bookmark: BookmarkWithTags
  onOpenUrl: (url: string, id: string) => void
  onDelete: (id: string) => void
  onMoveToInbox: (id: string) => void
}

export function GroupBookmarkItem({
  bookmark,
  onOpenUrl,
  onDelete,
  onMoveToInbox,
}: GroupBookmarkItemProps) {
  const domain = (() => {
    try { return new URL(bookmark.url).hostname } catch { return bookmark.url }
  })()

  return (
    <div
      className="group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent"
      data-testid={`group-bookmark-item-${bookmark.id}`}
    >
      {/* 파비콘 */}
      <img
        src={`https://www.google.com/s2/favicons?domain=${domain}&sz=16`}
        alt=""
        className="h-4 w-4 flex-shrink-0"
        aria-hidden="true"
      />

      {/* 제목 */}
      <button
        onClick={() => onOpenUrl(bookmark.url, bookmark.id)}
        className="flex-1 truncate text-left text-sm hover:underline"
        data-testid={`group-bookmark-title-${bookmark.id}`}
      >
        {bookmark.title}
      </button>

      {/* 액션 버튼 (hover 시 표시) */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => window.open(bookmark.url, '_blank', 'noopener,noreferrer')}
          title="새 탭에서 열기"
          data-testid={`group-bookmark-open-${bookmark.id}`}
        >
          <ExternalLink className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => onMoveToInbox(bookmark.id)}
          title="인박스로 이동"
          data-testid={`group-bookmark-to-inbox-${bookmark.id}`}
        >
          <MoveRight className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-destructive hover:text-destructive"
          onClick={() => onDelete(bookmark.id)}
          title="삭제"
          data-testid={`group-bookmark-delete-${bookmark.id}`}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  )
}
