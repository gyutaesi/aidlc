'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { TagInput } from '@/components/ui/tag-input'
import { CreateBookmarkSchema, type CreateBookmarkInput } from '@/lib/schemas/bookmark.schema'
import { createBookmarkAction } from '@/lib/actions/bookmark.actions'

interface BookmarkSaveModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultGroupId?: string
}

export function BookmarkSaveModal({ open, onOpenChange, defaultGroupId }: BookmarkSaveModalProps) {
  const t = useTranslations('bookmark')
  const [isFetchingMeta, setIsFetchingMeta] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateBookmarkInput>({
    resolver: zodResolver(CreateBookmarkSchema),
    defaultValues: { tagNames: [], groupId: defaultGroupId ?? null },
  })

  const url = watch('url')

  // URL 입력 시 OG 메타데이터 자동 fetch
  useEffect(() => {
    if (!url || !url.startsWith('http')) return

    const timer = setTimeout(async () => {
      setIsFetchingMeta(true)
      try {
        const res = await fetch(`/api/bookmarks/metadata?url=${encodeURIComponent(url)}`)
        if (res.ok) {
          const meta = await res.json()
          if (meta.title) setValue('title', meta.title)
          if (meta.description) setValue('description', meta.description)
        } else {
          toast.info(t('fetchFailed'))
        }
      } catch {
        toast.info(t('fetchFailed'))
      } finally {
        setIsFetchingMeta(false)
      }
    }, 800)

    return () => clearTimeout(timer)
  }, [url, setValue, t])

  async function onSubmit(data: CreateBookmarkInput) {
    const formData = new FormData()
    formData.set('url', data.url)
    if (data.title) formData.set('title', data.title)
    if (data.description) formData.set('description', data.description)
    if (data.memo) formData.set('memo', data.memo)
    data.tagNames?.forEach((tag) => formData.append('tagNames', tag))
    if (data.groupId) formData.set('groupId', data.groupId)

    const result = await createBookmarkAction(formData)
    if (result.success) {
      toast.success(t('saveSuccess'))
      reset()
      onOpenChange(false)
    } else {
      toast.error(result.error ?? t('saveSuccess'))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="bookmark-save-modal">
        <DialogHeader>
          <DialogTitle>{t('save')}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" data-testid="bookmark-save-form">
          <div className="space-y-1">
            <label className="text-sm font-medium">{t('urlLabel')}</label>
            <Input
              {...register('url')}
              placeholder={t('urlPlaceholder')}
              data-testid="bookmark-url-input"
            />
            {errors.url && <p className="text-xs text-destructive">{errors.url.message}</p>}
          </div>

          {isFetchingMeta && (
            <p className="text-xs text-muted-foreground" data-testid="bookmark-fetching-meta">
              {t('fetchingMetadata')}
            </p>
          )}

          <div className="space-y-1">
            <label className="text-sm font-medium">{t('titleLabel')}</label>
            <Input
              {...register('title')}
              placeholder={t('titleLabel')}
              data-testid="bookmark-title-input"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">{t('memoLabel')}</label>
            <Textarea
              {...register('memo')}
              placeholder={t('memoPlaceholder')}
              rows={2}
              data-testid="bookmark-memo-input"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">{t('tagsLabel')}</label>
            <TagInput
              value={watch('tagNames') ?? []}
              onChange={(tags) => setValue('tagNames', tags)}
              placeholder={t('tagsPlaceholder')}
              data-testid="bookmark-tags-input"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              data-testid="bookmark-save-cancel"
            >
              {useTranslations('common')('cancel')}
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              data-testid="bookmark-save-submit"
            >
              {isSubmitting ? useTranslations('common')('loading') : t('save')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
