'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { useLocale } from 'next-intl'
import { z } from 'zod'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { convertToCollectionAction } from '@/lib/actions/group.actions'
import type { GroupWithBookmarks } from '@/lib/services/group.service'

interface ConvertToCollectionModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  group: GroupWithBookmarks | null
}

const FormSchema = z.object({
  name: z.string().min(1, '컬렉션 이름을 입력해 주세요').max(100),
  emoji: z.string().optional(),
})
type FormData = z.infer<typeof FormSchema>

export function ConvertToCollectionModal({
  open,
  onOpenChange,
  group,
}: ConvertToCollectionModalProps) {
  const router = useRouter()
  const locale = useLocale()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(FormSchema),
    defaultValues: { name: group?.name ?? '' },
  })

  function toggleBookmark(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  function handleSelectAll() {
    if (!group) return
    if (selectedIds.size === group.bookmarks.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(group.bookmarks.map((b) => b.id)))
    }
  }

  async function onSubmit(data: FormData) {
    if (!group) return
    if (selectedIds.size === 0) {
      toast.error('최소 1개의 북마크를 선택해 주세요')
      return
    }

    const result = await convertToCollectionAction(group.id, {
      bookmarkIds: Array.from(selectedIds),
      collection: { name: data.name, emoji: data.emoji ?? null, template: 'guide' },
    })

    if (result.success && result.collectionId) {
      toast.success('컬렉션으로 변환됐습니다')
      reset()
      setSelectedIds(new Set())
      onOpenChange(false)
      router.push(`/${locale}/collections/${result.collectionId}`)
    } else {
      toast.error(result.error ?? '변환에 실패했습니다')
    }
  }

  if (!group) return null

  const allSelected = selectedIds.size === group.bookmarks.length && group.bookmarks.length > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>컬렉션으로 변환</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="flex gap-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">이모지</label>
              <Input {...register('emoji')} placeholder="📚" className="w-16 text-center" />
            </div>
            <div className="flex-1 space-y-1">
              <label className="text-sm font-medium">컬렉션 이름 *</label>
              <Input {...register('name')} placeholder="컬렉션 이름" />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">포함할 북마크</label>
              {group.bookmarks.length > 0 && (
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-xs text-primary hover:underline"
                >
                  {allSelected ? '전체 해제' : '전체 선택'}
                </button>
              )}
            </div>

            {group.bookmarks.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                그룹에 북마크가 없습니다
              </p>
            ) : (
              <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border p-2">
                {group.bookmarks.map((b) => (
                  <label
                    key={b.id}
                    className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-accent"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(b.id)}
                      onChange={() => toggleBookmark(b.id)}
                      className="h-3.5 w-3.5"
                    />
                    <span className="truncate text-sm">{b.title}</span>
                  </label>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">{selectedIds.size}개 선택됨</p>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              취소
            </Button>
            <Button type="submit" disabled={isSubmitting || selectedIds.size === 0}>
              {isSubmitting ? '변환 중...' : '변환하기'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
