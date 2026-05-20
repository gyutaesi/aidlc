import { createHash } from 'crypto'
import { prisma } from '@/lib/prisma'

export interface CollectionStats {
  viewCount: number
  likeCount: number
  linkClicks: Record<string, number>
}

export class CollectionStatsService {
  /**
   * 조회수 atomic increment
   */
  async incrementViewCount(collectionId: string): Promise<void> {
    await prisma.collection.update({
      where: { id: collectionId },
      data: { viewCount: { increment: 1 } },
    })
  }

  /**
   * 링크 블록 클릭 기록
   */
  async recordLinkClick(collectionId: string, blockId: string): Promise<void> {
    await prisma.collectionLinkClick.create({
      data: { collectionId, blockId },
    })
  }

  /**
   * 좋아요 토글 (로그인 사용자, user_id 기반 fingerprint)
   */
  async toggleLike(
    collectionId: string,
    userId: string
  ): Promise<{ liked: boolean; likeCount: number }> {
    // user_id 기반 fingerprint (SHA256)
    const fingerprint = createHash('sha256').update(userId).digest('hex')

    const existing = await prisma.collectionLike.findUnique({
      where: {
        collection_id_fingerprint: { collectionId, fingerprint },
      },
    })

    if (existing) {
      await prisma.collectionLike.delete({ where: { id: existing.id } })
    } else {
      await prisma.collectionLike.create({
        data: { collectionId, fingerprint },
      })
    }

    const likeCount = await prisma.collectionLike.count({
      where: { collectionId },
    })

    return { liked: !existing, likeCount }
  }

  /**
   * 사용자의 좋아요 여부 확인
   */
  async hasLiked(collectionId: string, userId: string): Promise<boolean> {
    const fingerprint = createHash('sha256').update(userId).digest('hex')
    const existing = await prisma.collectionLike.findUnique({
      where: { collection_id_fingerprint: { collectionId, fingerprint } },
    })
    return !!existing
  }

  /**
   * 컬렉션 통계 조회
   */
  async getStats(collectionId: string): Promise<CollectionStats> {
    const [collection, likeCount, clicks] = await Promise.all([
      prisma.collection.findUnique({
        where: { id: collectionId },
        select: { viewCount: true },
      }),
      prisma.collectionLike.count({ where: { collectionId } }),
      prisma.collectionLinkClick.groupBy({
        by: ['blockId'],
        where: { collectionId },
        _count: { blockId: true },
      }),
    ])

    const linkClicks: Record<string, number> = {}
    for (const click of clicks) {
      linkClicks[click.blockId] = click._count.blockId
    }

    return {
      viewCount: collection?.viewCount ?? 0,
      likeCount,
      linkClicks,
    }
  }
}

export const collectionStatsService = new CollectionStatsService()
