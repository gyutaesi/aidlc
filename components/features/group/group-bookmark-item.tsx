'use client'

import { useState } from 'react'
import { ExternalLink, Trash2, MoveRight, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { BookmarkWithTags } from '@/lib/services/bookmark.service'
import type { GroupWithBookmarks } from '@/lib/services/group.service'

interface GroupBookmarkItemProps {
  bookmark: BookmarkWithTags
  currentGroupId: string
  allGroups: GroupWithBookmarks[]
  onOpenUrl: (url: string, id: string) => void
  onDelete: (id: string) => void
  onMoveToInbox: (id: string) => void
  onMoveToGroup: (bookmarkId: string, groupId: string) => void
}

export function GroupBookmarkItem({
  bookmark,
  currentGroupId,
  allGroups,
  onOpenUrl,
  onDelete,
  onMoveToInbox,
  onMoveToGroup,
}: GroupBookmarkItemProps) {
  const [moveMenuOpen, setMoveMenuOpen] = useState(false)

  const domain = (() => {
    try {
      return new URL(bookmark.url).hostname
    } catch {
      return bookmark.url
    }
  })()

  const otherGroups = allGroups.filter((g) => g.id !== currentGroupId)

  return (
    <div
      className="group relative flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent"
      data-testid={`group-bookmark-item-${bookmark.id}`}
    >
      {/* 파비콘 */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
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

        {/* 이동 메뉴 */}
        <div className="relative">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setMoveMenuOpen((v) => !v)}
            title="이동"
            data-testid={`group-bookmark-move-${bookmark.id}`}
          >
            <MoveRight className="h-3 w-3" />
          </Button>

          {moveMenuOpen && (
            <div className="absolute right-0 z-50 mt-1 min-w-[160px] rounded-md border bg-popover p-1 shadow-md">
              <p className="px-2 py-1 text-xs font-medium text-muted-foreground">이동할 곳</p>

              <button
                className="flex w-full items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                onClick={() => {
                  onMoveToInbox(bookmark.id)
                  setMoveMenuOpen(false)
                }}
                data-testid={`group-bookmark-to-inbox-${bookmark.id}`}
              >
                📥 인박스
              </button>

              {otherGroups.length > 0 && (
                <>
                  <div className="my-1 h-px bg-muted" />
                  {otherGroups.map((g) => (
                    <button
                      key={g.id}
                      className="flex w-full items-center gap-1 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                      onClick={() => {
                        onMoveToGroup(bookmark.id, g.id)
                        setMoveMenuOpen(false)
                      }}
                    >
                      <ChevronRight className="h-3 w-3 flex-shrink-0" />
                      {g.emoji && <span>{g.emoji}</span>}
                      <span className="truncate">{g.name}</span>
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
        </div>

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
