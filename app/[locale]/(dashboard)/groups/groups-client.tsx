'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { GroupColumn } from '@/components/features/group/group-column'
import { BookmarkSaveModal } from '@/components/features/bookmark/bookmark-save-modal'
import { deleteGroupAction } from '@/lib/actions/group.actions'
import type { GroupWithBookmarks } from '@/lib/services/group.service'

interface GroupDashboardClientProps {
  initialGroups: GroupWithBookmarks[]
}

export function GroupDashboardClient({ initialGroups }: GroupDashboardClientProps) {
  const t = useTranslations('group')
  const [groups, setGroups] = useState(initialGroups)
  const [saveModalOpen, setSaveModalOpen] = useState(false)
  const [selectedGroupId, setSelectedGroupId] = useState<string | undefined>()

  function handleAddBookmark(groupId: string) {
    setSelectedGroupId(groupId)
    setSaveModalOpen(true)
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

  return (
    <>
      {/* 데스크탑: 가로 스크롤 컬럼 */}
      <div
        className="hidden flex-1 gap-4 overflow-x-auto p-6 md:flex"
        data-testid="groups-desktop"
      >
        {groups.map((group) => (
          <GroupColumn
            key={group.id}
            group={group}
            onAddBookmark={handleAddBookmark}
            onEdit={(g) => toast.info('그룹 편집')}
            onDelete={handleDeleteGroup}
            onConvertToCollection={(id) => toast.info('컬렉션 변환')}
          />
        ))}

        <Button
          variant="outline"
          className="h-auto w-[280px] flex-shrink-0 flex-col gap-2 py-8"
          onClick={() => toast.info('그룹 생성')}
          data-testid="create-group-button"
        >
          <Plus className="h-6 w-6" />
          {t('create')}
        </Button>
      </div>

      {/* 모바일: 세로 스택 (accordion) */}
      <div className="flex-1 space-y-2 overflow-y-auto p-4 md:hidden" data-testid="groups-mobile">
        {groups.map((group) => (
          <details key={group.id} className="rounded-lg border" data-testid={`group-accordion-${group.id}`}>
            <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 font-medium">
              {group.emoji && <span>{group.emoji}</span>}
              {group.name}
              <span className="ml-auto text-sm text-muted-foreground">({group.bookmarks.length})</span>
            </summary>
            <div className="border-t p-2">
              {group.bookmarks.map((b) => (
                <div key={b.id} className="px-2 py-1 text-sm">{b.title}</div>
              ))}
            </div>
          </details>
        ))}
      </div>

      <BookmarkSaveModal
        open={saveModalOpen}
        onOpenChange={setSaveModalOpen}
        defaultGroupId={selectedGroupId}
      />
    </>
  )
}
