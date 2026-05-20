'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { BookmarkCard } from '@/components/features/bookmark/bookmark-card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  deleteBookmarkAction,
  markAsReadAction,
  markAsUnreadAction,
  moveToGroupAction,
} from '@/lib/actions/bookmark.actions'
import type { PaginatedResult, BookmarkWithTags } from '@/lib/services/bookmark.service'
import type { GroupWithBookmarks } from '@/lib/services/group.service'

interface InboxClientProps {
  initialData: PaginatedResult<BookmarkWithTags>
  groups: GroupWithBookmarks[]
}

export function InboxClient({ initialData, groups }: InboxClientProps) {
  const t = useTranslations('inbox')
  const [bookmarks, setBookmarks] = useState(initialData.data)
  const [movingBookmarkId, setMovingBookmarkId] = useState<string | null>(null)

  async function handleMarkAsRead(id: string) {
    const result = await markAsReadAction(id)
    if (result.success) {
      setBookmarks((prev) => prev.map((b) => (b.id === id ? { ...b, isRead: true } : b)))
    } else {
      toast.error(result.error)
    }
  }

  async function handleMarkAsUnread(id: string) {
    const result = await markAsUnreadAction(id)
    if (result.success) {
      setBookmarks((prev) => prev.map((b) => (b.id === id ? { ...b, isRead: false } : b)))
    } else {
      toast.error(result.error)
    }
  }

  async function handleDelete(id: string) {
    const result = await deleteBookmarkAction(id)
    if (result.success) {
      setBookmarks((prev) => prev.filter((b) => b.id !== id))
      toast.success(t('deleteBookmark'))
    } else {
      toast.error(result.error)
    }
  }

  async function handleMoveToGroup(bookmarkId: string, groupId: string) {
    const result = await moveToGroupAction(bookmarkId, groupId)
    if (result.success) {
      setBookmarks((prev) => prev.filter((b) => b.id !== bookmarkId))
      const groupName = groups.find((g) => g.id === groupId)?.name ?? '그룹'
      toast.success(`"${groupName}"으로 이동됐습니다`)
      setMovingBookmarkId(null)
    } else {
      toast.error(result.error ?? '이동에 실패했습니다')
    }
  }

  if (bookmarks.length === 0) {
    return (
      <div className="py-16 text-center" data-testid="inbox-empty">
        <p className="text-muted-foreground">{t('empty')}</p>
        <p className="mt-1 text-sm text-muted-foreground">{t('emptyDescription')}</p>
      </div>
    )
  }

  return (
    <>
      <div
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
        data-testid="inbox-grid"
      >
        {bookmarks.map((bookmark) => (
          <BookmarkCard
            key={bookmark.id}
            bookmark={bookmark}
            onMarkAsRead={handleMarkAsRead}
            onMarkAsUnread={handleMarkAsUnread}
            onMoveToGroup={(id) => setMovingBookmarkId(id)}
            onDelete={handleDelete}
          />
        ))}
      </div>

      {/* 그룹 선택 모달 */}
      <Dialog
        open={movingBookmarkId !== null}
        onOpenChange={(open) => {
          if (!open) setMovingBookmarkId(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>그룹으로 이동</DialogTitle>
          </DialogHeader>

          {groups.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">생성된 그룹이 없습니다</p>
          ) : (
            <div className="space-y-1">
              {groups.map((group) => (
                <button
                  key={group.id}
                  className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm transition-colors hover:bg-accent"
                  onClick={() => movingBookmarkId && handleMoveToGroup(movingBookmarkId, group.id)}
                >
                  {group.emoji && <span className="text-base">{group.emoji}</span>}
                  <span className="flex-1 font-medium">{group.name}</span>
                  <span className="text-xs text-muted-foreground">{group.bookmarks.length}개</span>
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
