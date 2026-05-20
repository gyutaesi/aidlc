'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { BookmarkCard } from '@/components/features/bookmark/bookmark-card'
import {
  deleteBookmarkAction,
  markAsReadAction,
  markAsUnreadAction,
} from '@/lib/actions/bookmark.actions'
import type { PaginatedResult, BookmarkWithTags } from '@/lib/services/bookmark.service'

interface InboxClientProps {
  initialData: PaginatedResult<BookmarkWithTags>
}

export function InboxClient({ initialData }: InboxClientProps) {
  const t = useTranslations('inbox')
  const [bookmarks, setBookmarks] = useState(initialData.data)

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

  if (bookmarks.length === 0) {
    return (
      <div className="py-16 text-center" data-testid="inbox-empty">
        <p className="text-muted-foreground">{t('empty')}</p>
        <p className="text-muted-foreground mt-1 text-sm">{t('emptyDescription')}</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="inbox-grid">
      {bookmarks.map((bookmark) => (
        <BookmarkCard
          key={bookmark.id}
          bookmark={bookmark}
          onMarkAsRead={handleMarkAsRead}
          onMarkAsUnread={handleMarkAsUnread}
          onMoveToGroup={(_id) => toast.info('그룹 이동 기능')}
          onDelete={handleDelete}
        />
      ))}
    </div>
  )
}
