'use client'

import Image from 'next/image'
import { MoreHorizontal, ExternalLink, Check, RotateCcw, FolderOpen, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { BookmarkWithTags } from '@/lib/services/bookmark.service'

interface BookmarkCardProps {
  bookmark: BookmarkWithTags
  onMarkAsRead: (id: string) => void
  onMarkAsUnread: (id: string) => void
  onMoveToGroup: (id: string) => void
  onMoveToCollection: (id: string) => void
  onDelete: (id: string) => void
}

export function BookmarkCard({
  bookmark,
  onMarkAsRead,
  onMarkAsUnread,
  onMoveToGroup,
  onMoveToCollection,
  onDelete,
}: BookmarkCardProps) {
  const t = useTranslations('inbox')
  const domain = (() => {
    try { return new URL(bookmark.url).hostname } catch { return bookmark.url }
  })()

  function handleLinkClick() {
    // 자동 읽음 처리 (fire-and-forget)
    if (!bookmark.isRead) {
      onMarkAsRead(bookmark.id)
    }
    window.open(bookmark.url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div
      className="group relative rounded-lg border bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
      data-testid={`bookmark-card-${bookmark.id}`}
    >
      {/* 미읽음 표시 */}
      {!bookmark.isRead && (
        <span
          className="absolute right-3 top-3 h-2 w-2 rounded-full bg-blue-500"
          aria-label="읽지 않음"
          data-testid={`bookmark-unread-dot-${bookmark.id}`}
        />
      )}

      {/* 썸네일 */}
      {bookmark.thumbnailUrl && (
        <div className="mb-3 overflow-hidden rounded-md">
          <Image
            src={bookmark.thumbnailUrl}
            alt={bookmark.title}
            width={400}
            height={200}
            className="h-32 w-full object-cover"
            data-testid={`bookmark-thumbnail-${bookmark.id}`}
          />
        </div>
      )}

      {/* 제목 */}
      <button
        onClick={handleLinkClick}
        className="mb-1 line-clamp-2 text-left text-sm font-medium hover:underline"
        data-testid={`bookmark-title-${bookmark.id}`}
      >
        {bookmark.title}
        <ExternalLink className="ml-1 inline h-3 w-3 text-muted-foreground" />
      </button>

      {/* 도메인 */}
      <p className="mb-2 text-xs text-muted-foreground" data-testid={`bookmark-domain-${bookmark.id}`}>
        {domain}
      </p>

      {/* 메모 미리보기 */}
      {bookmark.memo && (
        <p className="mb-2 line-clamp-2 text-xs text-muted-foreground" data-testid={`bookmark-memo-${bookmark.id}`}>
          {bookmark.memo}
        </p>
      )}

      {/* 태그 */}
      {bookmark.tags.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1" data-testid={`bookmark-tags-${bookmark.id}`}>
          {bookmark.tags.map((tag) => (
            <Badge key={tag.id} variant="secondary" className="text-xs">
              {tag.name}
            </Badge>
          ))}
        </div>
      )}

      {/* 저장 날짜 */}
      <p className="text-xs text-muted-foreground">
        {new Date(bookmark.createdAt).toLocaleDateString('ko-KR')}
      </p>

      {/* 액션 메뉴 */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-2 top-2 h-7 w-7 opacity-0 group-hover:opacity-100"
            data-testid={`bookmark-menu-${bookmark.id}`}
          >
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">메뉴</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {bookmark.isRead ? (
            <DropdownMenuItem
              onClick={() => onMarkAsUnread(bookmark.id)}
              data-testid={`bookmark-mark-unread-${bookmark.id}`}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              {t('markAsUnread')}
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              onClick={() => onMarkAsRead(bookmark.id)}
              data-testid={`bookmark-mark-read-${bookmark.id}`}
            >
              <Check className="mr-2 h-4 w-4" />
              {t('markAsRead')}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            onClick={() => onMoveToGroup(bookmark.id)}
            data-testid={`bookmark-move-group-${bookmark.id}`}
          >
            <FolderOpen className="mr-2 h-4 w-4" />
            {t('moveToGroup')}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => onDelete(bookmark.id)}
            className="text-destructive"
            data-testid={`bookmark-delete-${bookmark.id}`}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {t('deleteBookmark')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

// DropdownMenu 컴포넌트 (shadcn/ui 스타일)
function DropdownMenu({ children }: { children: React.ReactNode }) {
  return <div className="relative">{children}</div>
}

function DropdownMenuTrigger({ asChild, children }: { asChild?: boolean; children: React.ReactNode }) {
  return <>{children}</>
}

function DropdownMenuContent({ align, children }: { align?: string; children: React.ReactNode }) {
  return (
    <div className="absolute right-0 z-50 mt-1 min-w-[160px] rounded-md border bg-popover p-1 shadow-md">
      {children}
    </div>
  )
}

function DropdownMenuItem({
  onClick,
  className,
  children,
  'data-testid': testId,
}: {
  onClick?: () => void
  className?: string
  children: React.ReactNode
  'data-testid'?: string
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent ${className ?? ''}`}
      data-testid={testId}
    >
      {children}
    </button>
  )
}

function DropdownMenuSeparator() {
  return <div className="my-1 h-px bg-muted" />
}
