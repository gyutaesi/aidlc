import { notFound } from 'next/navigation'
import { cookies } from 'next/headers'
import { authService } from '@/lib/services/auth.service'
import { collectionService } from '@/lib/services/collection.service'
import { CollectionHeader } from '@/components/features/collection/collection-header'
import { BlockList } from '@/components/features/collection/block-list'
import type { Block } from '@/lib/services/collection.service'

export const dynamic = 'force-dynamic'

interface CollectionEditorPageProps {
  params: Promise<{ id: string }>
}

export default async function CollectionEditorPage({ params }: CollectionEditorPageProps) {
  const { id } = await params
  const cookieStore = await cookies()
  const token = cookieStore.get('access_token')?.value

  if (!token) return null

  const user = await authService.getUserFromToken(token)
  const collection = await collectionService.getById(user.id, id)

  if (!collection) notFound()

  return (
    <div className="mx-auto max-w-3xl p-6" data-testid="collection-editor-page">
      <div className="mb-6">
        <div className="flex items-center gap-2">
          {collection.emoji && <span className="text-2xl">{collection.emoji}</span>}
          <h1 className="text-2xl font-bold">{collection.name}</h1>
        </div>
        {collection.description && (
          <p className="text-muted-foreground mt-1">{collection.description}</p>
        )}
      </div>

      <CollectionHeader collection={collection} />

      <div className="mt-6">
        <BlockList collectionId={collection.id} blocks={collection.blocks as unknown as Block[]} />
      </div>
    </div>
  )
}
