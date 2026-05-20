'use client'

import { useState } from 'react'
import { Plus, MoreHorizontal, Pencil, Trash2, ArrowRight } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { DragDropList } from '@/components/ui/drag-drop-list'
import { GroupBookmarkItem } from './group-bookmark-item'
import { deleteBookmarkAction, markAsReadAction } from '@/lib/actions/bookmark.actions'
import { reorderBookmarksAction } from '@/lib/actions/group.actions'
import type { GroupWithBookmarks } from '@/lib/services/group.service'

interface GroupColumnProps {
  group: GroupWithBookmarks
  onAddBookmark: (groupId: string) => void
  onEdit: (group: GroupWithBookmarks) => void
  onDelete: (groupId: string) => void
  onConvertToCollection: (groupId: string) => void
}

export function GroupColumn({
  group,
  onAddBookmark,
  onEdit,
  onDelete,
  onConvertToCollection,
}: GroupColumnProps) {
  const t = useTranslations('group')
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  async function handleReorder(orderedIds: string[]) {
    const result = await reorderBookmarksAction(group.id, orderedIds)
    if (!result.success) toast.error(result.error)
  }

  async function handleDeleteBookmark(bookmarkId: string) {
    const result = await deleteBookmarkAction(bookmarkId)
    if (!result.success) toast.error(result.error)
  }

  async function handleOpenUrl(url: string, bookmarkId: string) {
    window.open(url, '_blank', 'noopener,noreferrer')
    await markAsReadAction(bookmarkId)
  }

  return (
    <div
      className="flex h-full w-[280px] flex-shrink-0 flex-col rounded-lg border bg-card"
      data-testid={`group-column-${group.id}`}
    >
      {/* 헤더 */}
      <div className="flex items-center justify-between border-b px-3 py-2">
        <div className="flex items-center gap-2">
          {group.emoji && <span aria-hidden="true">{group.emoji}</span>}
          <h3 className="text-sm font-medium" data-testid={`group-name-${group.id}`}>
            {group.name}
          </h3>
          <span className="text-xs text-muted-foreground">({group.bookmarks.length})</span>
        </div>

        <div className="relative">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            data-testid={`group-menu-${group.id}`}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>

          {isMenuOpen && (
            <div className="absolute right-0 z-50 mt-1 min-w-[160px] rounded-md border bg-popover p-1 shadow-md">
              <button
                className="flex w-full items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                onClick={() => { onEdit(group); setIsMenuOpen(false) }}
                data-testid={`group-edit-${group.id}`}
              >
                <Pencil className="mr-2 h-4 w-4" />
                {t('edit')}
              </button>
              <button
                className="flex w-full items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                onClick={() => { onConvertToCollection(group.id); setIsMenuOpen(false) }}
                data-testid={`group-convert-${group.id}`}
              >
                <ArrowRight className="mr-2 h-4 w-4" />
                {t('convertToCollection')}
              </button>
              <div className="my-1 h-px bg-muted" />
              <button
                className="flex w-full items-center rounded-sm px-2 py-1.5 text-sm text-destructive hover:bg-accent"
                onClick={() => { onDelete(group.id); setIsMenuOpen(false) }}
                data-testid={`group-delete-${group.id}`}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {t('delete')}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 북마크 목록 */}
      <div className="flex-1 overflow-y-auto p-2">
        {group.bookmarks.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground" data-testid={`group-empty-${group.id}`}>
            {t('empty')}
          </p>
        ) : (
          <DragDropList
            items={group.bookmarks}
            onReorder={handleReorder}
            renderItem={(bookmark) => (
              <GroupBookmarkItem
                bookmark={bookmark}
                onOpenUrl={handleOpenUrl}
                onDelete={handleDeleteBookmark}
                onMoveToInbox={(id) => handleDeleteBookmark(id)}
              />
            )}
          />
        )}
      </div>

      {/* 하단 링크 추가 버튼 */}
      <div className="border-t p-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-muted-foreground"
          onClick={() => onAddBookmark(group.id)}
          data-testid={`group-add-link-${group.id}`}
        >
          <Plus className="mr-2 h-4 w-4" />
          {t('addLink')}
        </Button>
      </div>
    </div>
  )
}
