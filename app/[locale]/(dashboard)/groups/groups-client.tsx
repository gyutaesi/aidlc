'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { GroupColumn } from '@/components/features/group/group-column'
import { GroupFormModal } from '@/components/features/group/group-form-modal'
import { ConvertToCollectionModal } from '@/components/features/group/convert-to-collection-modal'
import { BookmarkSaveModal } from '@/components/features/bookmark/bookmark-save-modal'
import { deleteGroupAction } from '@/lib/actions/group.actions'
import { moveToGroupAction, removeFromGroupAction } from '@/lib/actions/bookmark.actions'
import type { GroupWithBookmarks } from '@/lib/services/group.service'

interface GroupDashboardClientProps {
  initialGroups: GroupWithBookmarks[]
}

export function GroupDashboardClient({ initialGroups }: GroupDashboardClientProps) {
  const t = useTranslations('group')
  const router = useRouter()
  const [groups, setGroups] = useState(initialGroups)

  // 모달 상태
  const [saveModalOpen, setSaveModalOpen] = useState(false)
  const [selectedGroupId, setSelectedGroupId] = useState<string | undefined>()
  const [groupFormOpen, setGroupFormOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<GroupWithBookmarks | null>(null)
  const [convertTarget, setConvertTarget] = useState<GroupWithBookmarks | null>(null)

  function handleAddBookmark(groupId: string) {
    setSelectedGroupId(groupId)
    setSaveModalOpen(true)
  }

  function handleCreateGroup() {
    setEditTarget(null)
    setGroupFormOpen(true)
  }

  function handleEditGroup(group: GroupWithBookmarks) {
    setEditTarget(group)
    setGroupFormOpen(true)
  }

  async function handleDeleteGroup(groupId: string) {
    const result = await deleteGroupAction(groupId)
    if (result.success) {
      setGroups((prev) => prev.filter((g) => g.id !== groupId))
      toast.success(t('deleteSuccess'))
    } else {
      toast.error(result.error)
    }
  }

  function handleConvertToCollection(group: GroupWithBookmarks) {
    setConvertTarget(group)
  }

  async function handleMoveBookmarkToGroup(
    bookmarkId: string,
    targetGroupId: string,
    _sourceGroupId: string
  ) {
    const result = await moveToGroupAction(bookmarkId, targetGroupId)
    if (result.success) {
      toast.success('다른 그룹으로 이동됐습니다')
      router.refresh()
    } else {
      toast.error(result.error ?? '이동에 실패했습니다')
    }
  }

  async function handleMoveBookmarkToInbox(bookmarkId: string, groupId: string) {
    const result = await removeFromGroupAction(bookmarkId, groupId)
    if (result.success) {
      setGroups((prev) =>
        prev.map((g) =>
          g.id === groupId ? { ...g, bookmarks: g.bookmarks.filter((b) => b.id !== bookmarkId) } : g
        )
      )
      toast.success('인박스로 이동됐습니다')
    } else {
      toast.error(result.error ?? '이동에 실패했습니다')
    }
  }

  return (
    <>
      {/* 데스크탑: 가로 스크롤 컬럼 */}
      <div className="hidden flex-1 gap-4 overflow-x-auto p-6 md:flex" data-testid="groups-desktop">
        {groups.map((group) => (
          <GroupColumn
            key={group.id}
            group={group}
            allGroups={groups}
            onAddBookmark={handleAddBookmark}
            onEdit={handleEditGroup}
            onDelete={handleDeleteGroup}
            onConvertToCollection={handleConvertToCollection}
            onMoveBookmarkToGroup={handleMoveBookmarkToGroup}
            onMoveBookmarkToInbox={handleMoveBookmarkToInbox}
          />
        ))}

        <Button
          variant="outline"
          className="h-auto w-[280px] flex-shrink-0 flex-col gap-2 py-8"
          onClick={handleCreateGroup}
          data-testid="create-group-button"
        >
          <Plus className="h-6 w-6" />
          {t('create')}
        </Button>
      </div>

      {/* 모바일: 세로 스택 */}
      <div className="flex-1 space-y-2 overflow-y-auto p-4 md:hidden" data-testid="groups-mobile">
        {groups.map((group) => (
          <details
            key={group.id}
            className="rounded-lg border"
            data-testid={`group-accordion-${group.id}`}
          >
            <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 font-medium">
              {group.emoji && <span>{group.emoji}</span>}
              {group.name}
              <span className="ml-auto text-sm text-muted-foreground">
                ({group.bookmarks.length})
              </span>
            </summary>
            <div className="border-t p-2">
              {group.bookmarks.map((b) => (
                <div key={b.id} className="px-2 py-1 text-sm">
                  {b.title}
                </div>
              ))}
            </div>
          </details>
        ))}
        <Button variant="outline" className="w-full" onClick={handleCreateGroup}>
          <Plus className="mr-2 h-4 w-4" />
          {t('create')}
        </Button>
      </div>

      {/* 모달들 */}
      <BookmarkSaveModal
        open={saveModalOpen}
        onOpenChange={setSaveModalOpen}
        defaultGroupId={selectedGroupId}
      />
      <GroupFormModal
        open={groupFormOpen}
        onOpenChange={setGroupFormOpen}
        editTarget={editTarget}
        onSuccess={() => router.refresh()}
      />
      <ConvertToCollectionModal
        open={convertTarget !== null}
        onOpenChange={(open) => {
          if (!open) setConvertTarget(null)
        }}
        group={convertTarget}
      />
    </>
  )
}
