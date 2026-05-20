import { getTranslations } from 'next-intl/server'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { authService } from '@/lib/services/auth.service'
import { collectionService } from '@/lib/services/collection.service'
import { Button } from '@/components/ui/button'
import { Plus, Globe, Lock } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function CollectionsPage() {
  const t = await getTranslations('collection')
  const cookieStore = await cookies()
  const token = cookieStore.get('access_token')?.value

  if (!token) return null

  const user = await authService.getUserFromToken(token)
  const collections = await collectionService.getAll(user.id)

  return (
    <div className="p-6" data-testid="collections-page">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <Button data-testid="create-collection-button">
          <Plus className="mr-2 h-4 w-4" />
          {t('create')}
        </Button>
      </div>

      {collections.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground" data-testid="collections-empty">
          <p>{t('empty')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="collections-grid">
          {collections.map((collection) => (
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
                {collection.isPublic && <span>{collection.viewCount} {t('views')}</span>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
