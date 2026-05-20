'use client'

import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { useLocale } from 'next-intl'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { CreateCollectionSchema, type CreateCollectionInput } from '@/lib/schemas/collection.schema'
import { createCollectionAction } from '@/lib/actions/collection.actions'

interface CollectionCreateModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CollectionCreateModal({ open, onOpenChange }: CollectionCreateModalProps) {
  const router = useRouter()
  const locale = useLocale()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateCollectionInput>({
    resolver: zodResolver(CreateCollectionSchema),
    defaultValues: { template: 'guide' },
  })

  async function onSubmit(data: CreateCollectionInput) {
    const result = await createCollectionAction(data)
    if (result.success && result.collectionId) {
      toast.success('컬렉션이 생성됐습니다')
      reset()
      onOpenChange(false)
      router.push(`/${locale}/collections/${result.collectionId}`)
    } else {
      toast.error(result.error ?? '생성에 실패했습니다')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="collection-create-modal">
        <DialogHeader>
          <DialogTitle>컬렉션 만들기</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="flex gap-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">이모지</label>
              <Input
                {...register('emoji')}
                placeholder="📚"
                className="w-16 text-center"
                data-testid="collection-emoji-input"
              />
            </div>
            <div className="flex-1 space-y-1">
              <label className="text-sm font-medium">이름 *</label>
              <Input
                {...register('name')}
                placeholder="컬렉션 이름"
                data-testid="collection-name-input"
              />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">설명</label>
            <Textarea
              {...register('description')}
              placeholder="이 컬렉션에 대해 설명해주세요"
              rows={2}
              data-testid="collection-description-input"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">템플릿</label>
            <div className="flex gap-2">
              <label className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm">
                <input type="radio" value="guide" {...register('template')} defaultChecked />
                가이드형
              </label>
              <label className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm">
                <input type="radio" value="profile" {...register('template')} />
                프로필형
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              취소
            </Button>
            <Button type="submit" disabled={isSubmitting} data-testid="collection-create-submit">
              {isSubmitting ? '생성 중...' : '만들기'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
