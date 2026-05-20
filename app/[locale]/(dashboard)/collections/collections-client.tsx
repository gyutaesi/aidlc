'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useLocale } from 'next-intl'
import { Globe, Lock, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CollectionCreateModal } from '@/components/features/collection/collection-create-modal'
import type { Collection } from '@prisma/client'

interface CollectionsClientProps {
  collections: Collection[]
}

export function CollectionsClient({ collections }: CollectionsClientProps) {
  const locale = useLocale()
  const [createOpen, setCreateOpen] = useState(false)

  return (
    <div className="p-6" data-testid="collections-page">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">컬렉션</h1>
        <Button onClick={() => setCreateOpen(true)} data-testid="create-collection-button">
          <Plus className="mr-2 h-4 w-4" />
          컬렉션 만들기
        </Button>
      </div>

      {collections.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground" data-testid="collections-empty">
          <p className="mb-4">아직 컬렉션이 없습니다</p>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />첫 컬렉션 만들기
          </Button>
        </div>
      ) : (
        <div
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
          data-testid="collections-grid"
        >
          {collections.map((collection) => (
            <Link
              key={collection.id}
              href={`/${locale}/collections/${collection.id}`}
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
                {collection.isPublic && <span>{collection.viewCount} 조회</span>}
              </div>
            </Link>
          ))}
        </div>
      )}

      <CollectionCreateModal open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  )
}
