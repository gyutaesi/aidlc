'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { GroupColumn } from '@/components/features/group/group-column'
import { BookmarkSaveModal } from '@/components/features/bookmark/bookmark-save-modal'
import {
  createGroupAction,
  deleteGroupAction,
  updateGroupAction,
} from '@/lib/actions/group.actions'
import type { GroupWithBookmarks } from '@/lib/services/group.service'

interface GroupDashboardClientProps {
  initialGroups: GroupWithBookmarks[]
}

export function GroupDashboardClient({ initialGroups }: GroupDashboardClientProps) {
  const t = useTranslations('group')
  const [groups, setGroups] = useState(initialGroups)
  const [saveModalOpen, setSaveModalOpen] = useState(false)
  const [selectedGroupId, setSelectedGroupId] = useState<string | undefined>()
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingGroup, setEditingGroup] = useState<{
    id: string
    name: string
    emoji?: string
  } | null>(null)
  const [newGroupName, setNewGroupName] = useState('')
  const [newGroupEmoji, setNewGroupEmoji] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  function handleAddBookmark(groupId: string) {
    setSelectedGroupId(groupId)
    setSaveModalOpen(true)
  }

  async function handleCreateGroup() {
    if (!newGroupName.trim()) return
    setIsCreating(true)
    const formData = new FormData()
    formData.set('name', newGroupName.trim())
    if (newGroupEmoji.trim()) formData.set('emoji', newGroupEmoji.trim())

    const result = await createGroupAction(formData)
    if (result.success) {
      toast.success(t('createSuccess'))
      setCreateModalOpen(false)
      setNewGroupName('')
      setNewGroupEmoji('')
      window.location.reload()
    } else {
      toast.error(result.error)
    }
    setIsCreating(false)
  }

  function handleEditGroup(group: { id: string; name: string; emoji?: string | null }) {
    setEditingGroup({ id: group.id, name: group.name, emoji: group.emoji ?? '' })
    setEditModalOpen(true)
  }

  async function handleSaveEdit() {
    if (!editingGroup || !editingGroup.name.trim()) return
    setIsCreating(true)
    const formData = new FormData()
    formData.set('name', editingGroup.name.trim())
    if (editingGroup.emoji?.trim()) formData.set('emoji', editingGroup.emoji.trim())

    const result = await updateGroupAction(editingGroup.id, formData)
    if (result.success) {
      toast.success('그룹이 수정되었습니다')
      setEditModalOpen(false)
      setEditingGroup(null)
      window.location.reload()
    } else {
      toast.error(result.error)
    }
    setIsCreating(false)
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
      <div className="hidden flex-1 gap-4 overflow-x-auto p-6 md:flex" data-testid="groups-desktop">
        {groups.map((group) => (
          <GroupColumn
            key={group.id}
            group={group}
            onAddBookmark={handleAddBookmark}
            onEdit={handleEditGroup}
            onDelete={handleDeleteGroup}
            onConvertToCollection={(_id) => toast.info('컬렉션 변환 기능은 준비 중입니다')}
          />
        ))}

        <Button
          variant="outline"
          className="h-auto w-[280px] flex-shrink-0 flex-col gap-2 py-8"
          onClick={() => setCreateModalOpen(true)}
          data-testid="create-group-button"
        >
          <Plus className="h-6 w-6" />
          {t('create')}
        </Button>
      </div>

      {/* 모바일: 세로 스택 (accordion) */}
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

        <Button variant="outline" className="w-full py-4" onClick={() => setCreateModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {t('create')}
        </Button>
      </div>

      {/* 그룹 생성 모달 */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('create')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">{t('nameLabel')}</label>
              <Input
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder={t('namePlaceholder')}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateGroup()}
                data-testid="create-group-name-input"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">이모지 (선택)</label>
              <Input
                value={newGroupEmoji}
                onChange={(e) => setNewGroupEmoji(e.target.value)}
                placeholder="📁"
                data-testid="create-group-emoji-input"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCreateModalOpen(false)}>
                취소
              </Button>
              <Button onClick={handleCreateGroup} disabled={isCreating || !newGroupName.trim()}>
                {isCreating ? '생성 중...' : t('create')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 그룹 편집 모달 */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>그룹 편집</DialogTitle>
          </DialogHeader>
          {editingGroup && (
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">{t('nameLabel')}</label>
                <Input
                  value={editingGroup.name}
                  onChange={(e) => setEditingGroup({ ...editingGroup, name: e.target.value })}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">이모지 (선택)</label>
                <Input
                  value={editingGroup.emoji ?? ''}
                  onChange={(e) => setEditingGroup({ ...editingGroup, emoji: e.target.value })}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditModalOpen(false)}>
                  취소
                </Button>
                <Button onClick={handleSaveEdit} disabled={isCreating || !editingGroup.name.trim()}>
                  {isCreating ? '저장 중...' : '저장'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <BookmarkSaveModal
        open={saveModalOpen}
        onOpenChange={setSaveModalOpen}
        defaultGroupId={selectedGroupId}
      />
    </>
  )
}
