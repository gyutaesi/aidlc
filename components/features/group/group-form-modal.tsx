'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CreateGroupSchema, type CreateGroupInput } from '@/lib/schemas/group.schema'
import { createGroupAction, updateGroupAction } from '@/lib/actions/group.actions'
import type { GroupWithBookmarks } from '@/lib/services/group.service'

interface GroupFormModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editTarget?: GroupWithBookmarks | null
  onSuccess: () => void
}

export function GroupFormModal({ open, onOpenChange, editTarget, onSuccess }: GroupFormModalProps) {
  const isEdit = !!editTarget

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateGroupInput>({
    resolver: zodResolver(CreateGroupSchema),
  })

  useEffect(() => {
    if (open) {
      reset({ name: editTarget?.name ?? '', emoji: editTarget?.emoji ?? '' })
    }
  }, [open, editTarget, reset])

  async function onSubmit(data: CreateGroupInput) {
    let result
    if (isEdit && editTarget) {
      const formData = new FormData()
      if (data.name) formData.set('name', data.name)
      if (data.emoji) formData.set('emoji', data.emoji)
      result = await updateGroupAction(editTarget.id, formData)
    } else {
      const formData = new FormData()
      formData.set('name', data.name)
      if (data.emoji) formData.set('emoji', data.emoji)
      result = await createGroupAction(formData)
    }

    if (result.success) {
      toast.success(isEdit ? '그룹이 수정됐습니다' : '그룹이 생성됐습니다')
      onOpenChange(false)
      onSuccess()
    } else {
      toast.error(result.error ?? '실패했습니다')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? '그룹 편집' : '그룹 만들기'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="flex gap-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">이모지</label>
              <Input {...register('emoji')} placeholder="📁" className="w-16 text-center" />
            </div>
            <div className="flex-1 space-y-1">
              <label className="text-sm font-medium">이름 *</label>
              <Input {...register('name')} placeholder="그룹 이름" />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              취소
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? '저장 중...' : isEdit ? '저장' : '만들기'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
