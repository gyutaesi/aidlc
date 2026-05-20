'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Copy, Check, X, Loader2 } from 'lucide-react'
import useSWR from 'swr'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { togglePublicAction, updateSlugAction } from '@/lib/actions/collection.actions'
import type { Collection } from '@prisma/client'

interface CollectionHeaderProps {
  collection: Collection
}

type SlugStatus = 'idle' | 'checking' | 'available' | 'taken'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export function CollectionHeader({ collection }: CollectionHeaderProps) {
  const t = useTranslations('collection')
  const [slug, setSlug] = useState(collection.slug)
  const [slugStatus, setSlugStatus] = useState<SlugStatus>('idle')
  const [debouncedSlug, setDebouncedSlug] = useState('')

  // 슬러그 debounce
  useEffect(() => {
    if (slug === collection.slug) {
      setSlugStatus('idle')
      return
    }
    setSlugStatus('checking')
    const timer = setTimeout(() => setDebouncedSlug(slug), 300)
    return () => clearTimeout(timer)
  }, [slug, collection.slug])

  // 슬러그 중복 체크
  const { data: slugCheck } = useSWR<{ available: boolean }>(
    debouncedSlug && debouncedSlug !== collection.slug
      ? `/api/collections/slug-check?slug=${encodeURIComponent(debouncedSlug)}&excludeId=${collection.id}`
      : null,
    fetcher
  )

  useEffect(() => {
    if (!slugCheck) return
    setSlugStatus(slugCheck.available ? 'available' : 'taken')
  }, [slugCheck])

  async function handleTogglePublic() {
    const result = await togglePublicAction(collection.id)
    if (!result.success) toast.error(result.error)
    else toast.success(collection.isPublic ? t('shareOff') : t('shareOn'))
  }

  async function handleSaveSlug() {
    if (slugStatus !== 'available') return
    const result = await updateSlugAction(collection.id, slug)
    if (!result.success) toast.error(result.error)
    else toast.success(t('updateSuccess'))
  }

  async function handleCopyLink() {
    const url = `${window.location.origin}/c/${collection.slug}`
    await navigator.clipboard.writeText(url)
    toast.success(t('linkCopied'))
  }

  const publicUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/c/${collection.slug}`

  return (
    <div className="space-y-4 border-b pb-4" data-testid="collection-header">
      {/* 공개/비공개 토글 */}
      <div className="flex items-center gap-3">
        <Button
          variant={collection.isPublic ? 'default' : 'outline'}
          size="sm"
          onClick={handleTogglePublic}
          data-testid="collection-share-toggle"
        >
          {collection.isPublic ? t('shareOn') : t('shareOff')}
        </Button>

        {collection.isPublic && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopyLink}
            data-testid="collection-copy-link"
          >
            <Copy className="mr-2 h-4 w-4" />
            {t('copyLink')}
          </Button>
        )}
      </div>

      {/* 슬러그 편집 */}
      {collection.isPublic && (
        <div className="space-y-1">
          <label className="text-sm font-medium">{t('slugLabel')}</label>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-sm">/c/</span>
            <div className="relative flex-1">
              <Input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder={t('slugPlaceholder')}
                className="pr-8"
                data-testid="collection-slug-input"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2">
                {slugStatus === 'checking' && (
                  <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
                )}
                {slugStatus === 'available' && <Check className="h-4 w-4 text-green-500" />}
                {slugStatus === 'taken' && <X className="text-destructive h-4 w-4" />}
              </div>
            </div>
            <Button
              size="sm"
              onClick={handleSaveSlug}
              disabled={slugStatus !== 'available'}
              data-testid="collection-slug-save"
            >
              저장
            </Button>
          </div>

          {slugStatus === 'available' && (
            <p className="text-xs text-green-600" data-testid="slug-available-msg">
              {t('slugAvailable')}
            </p>
          )}
          {slugStatus === 'taken' && (
            <p className="text-destructive text-xs" data-testid="slug-taken-msg">
              {t('slugTaken')}
            </p>
          )}

          <p className="text-muted-foreground text-xs">{publicUrl}</p>
        </div>
      )}
    </div>
  )
}
