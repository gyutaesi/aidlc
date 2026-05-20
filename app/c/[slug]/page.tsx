import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { collectionService } from '@/lib/services/collection.service'
import { collectionStatsService } from '@/lib/services/collection-stats.service'
import { PublicBlockRenderer } from '@/components/features/collection/public-block-renderer'
import { PublicLikeButton } from './like-button'
import type { Block } from '@/lib/services/collection.service'

export const revalidate = 60

interface PublicCollectionPageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: PublicCollectionPageProps): Promise<Metadata> {
  const { slug } = await params
  const collection = await collectionService.getPublicBySlug(slug)

  if (!collection) return { title: 'Not Found' }

  return {
    title: collection.name,
    description: collection.description ?? undefined,
    openGraph: {
      title: collection.name,
      description: collection.description ?? undefined,
      type: 'website',
    },
  }
}

export default async function PublicCollectionPage({ params }: PublicCollectionPageProps) {
  const { slug } = await params
  const collection = await collectionService.getPublicBySlug(slug)

  if (!collection) notFound()

  // 조회수 증가 (비동기, 응답 대기 없음)
  collectionStatsService.incrementViewCount(collection.id).catch(() => {})

  const stats = await collectionStatsService.getStats(collection.id)

  return (
    <div className="mx-auto max-w-3xl px-4 py-8" data-testid="public-collection-page">
      {/* 헤더 */}
      <header className="mb-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              {collection.emoji && <span className="text-3xl">{collection.emoji}</span>}
              <h1 className="text-3xl font-bold">{collection.name}</h1>
            </div>
            {collection.description && (
              <p className="text-muted-foreground mt-2">{collection.description}</p>
            )}
          </div>
        </div>

        {/* 통계 + 좋아요 */}
        <div className="text-muted-foreground mt-4 flex items-center gap-4 text-sm">
          <span data-testid="collection-view-count">{stats.viewCount} 조회</span>
          <span data-testid="collection-like-count">{stats.likeCount} 좋아요</span>
          <PublicLikeButton collectionId={collection.id} likeCount={stats.likeCount} />
        </div>
      </header>

      {/* 블록 렌더링 */}
      <PublicBlockRenderer
        blocks={collection.blocks as unknown as Block[]}
        collectionId={collection.id}
        template={collection.template as 'guide' | 'profile'}
      />
    </div>
  )
}
