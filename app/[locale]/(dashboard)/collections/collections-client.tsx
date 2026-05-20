'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import Link from 'next/link'
import { Plus, Globe, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { createCollectionAction } from '@/lib/actions/collection.actions'
import type { Collection } from '@prisma/client'

interface CollectionsClientProps {
  initialCollections: Collection[]
}

export function CollectionsClient({ initialCollections }: CollectionsClientProps) {
  const t = useTranslations('collection')
  const router = useRouter()
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  async function handleCreate() {
    if (!name.trim()) return
    setIsCreating(true)
    const result = await createCollectionAction({
      name: name.trim(),
      emoji: emoji.trim() || null,
      template: 'guide',
    })
    if (result.success) {
      toast.success('컬렉션이 생성되었습니다')
      setCreateModalOpen(false)
      setName('')
      setEmoji('')
      if (result.collectionId) {
        router.push(`/ko/collections/${result.collectionId}`)
      } else {
        router.refresh()
      }
    } else {
      toast.error(result.error)
    }
    setIsCreating(false)
  }

  return (
    <div className="p-6" data-testid="collections-page">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <Button onClick={() => setCreateModalOpen(true)} data-testid="create-collection-button">
          <Plus className="mr-2 h-4 w-4" />
          {t('create')}
        </Button>
      </div>

      {initialCollections.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground" data-testid="collections-empty">
          <p>{t('empty')}</p>
        </div>
      ) : (
        <div
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
          data-testid="collections-grid"
        >
          {initialCollections.map((collection) => (
            <Link
              key={collection.id}
              href={`/ko/collections/${collection.id}`}
              className="block rounded-lg border p-4 transition-shadow hover:shadow-md"
              data-testid={`collection-card-${collection.id}`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    {collection.emoji && <span>{collection.emoji}</span>}
                    <h3 className="font-medium">{collection.name}</h3>
                  </div>
                  {collection.description && (
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {collection.description}
                    </p>
                  )}
                </div>
                {collection.isPublic ? (
                  <Globe className="h-4 w-4 text-green-500" />
                ) : (
                  <Lock className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
              <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                <span>{(collection.blocks as unknown[]).length}개 블록</span>
                {collection.isPublic && (
                  <span>
                    {collection.viewCount} {t('views')}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}

      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('create')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">이름</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="컬렉션 이름"
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                data-testid="create-collection-name-input"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">이모지 (선택)</label>
              <Input
                value={emoji}
                onChange={(e) => setEmoji(e.target.value)}
                placeholder="📚"
                data-testid="create-collection-emoji-input"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCreateModalOpen(false)}>
                취소
              </Button>
              <Button onClick={handleCreate} disabled={isCreating || !name.trim()}>
                {isCreating ? '생성 중...' : t('create')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
