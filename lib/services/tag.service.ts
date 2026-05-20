import { prisma } from '@/lib/prisma'
import type { Tag } from '@prisma/client'

export class TagService {
  /**
   * 태그 이름으로 조회 또는 생성 (upsert)
   */
  async getOrCreate(userId: string, name: string): Promise<Tag> {
    const normalized = name.toLowerCase().trim()
    return prisma.tag.upsert({
      where: { userId_name: { userId, name: normalized } },
      create: { userId, name: normalized },
      update: {},
    })
  }

  /**
   * 여러 태그 이름을 한 번에 getOrCreate
   */
  async getOrCreateMany(userId: string, names: string[]): Promise<Tag[]> {
    return Promise.all(names.map((name) => this.getOrCreate(userId, name)))
  }

  /**
   * 태그 자동완성 (prefix로 시작하는 태그 목록)
   */
  async autocomplete(userId: string, prefix: string, limit = 10): Promise<Tag[]> {
    return prisma.tag.findMany({
      where: {
        userId,
        name: { startsWith: prefix.toLowerCase().trim() },
      },
      orderBy: { name: 'asc' },
      take: limit,
    })
  }

  /**
   * 북마크에 연결된 태그 목록 조회
   */
  async getByBookmark(userId: string, bookmarkId: string): Promise<Tag[]> {
    const bookmarkTags = await prisma.bookmarkTag.findMany({
      where: { bookmarkId, bookmark: { userId } },
      include: { tag: true },
    })
    return bookmarkTags.map((bt) => bt.tag)
  }

  /**
   * 북마크의 태그 일괄 업데이트 (기존 태그 교체)
   */
  async setBookmarkTags(userId: string, bookmarkId: string, tagNames: string[]): Promise<void> {
    const tags = await this.getOrCreateMany(userId, tagNames)

    await prisma.$transaction([
      prisma.bookmarkTag.deleteMany({ where: { bookmarkId } }),
      prisma.bookmarkTag.createMany({
        data: tags.map((tag) => ({ bookmarkId, tagId: tag.id })),
        skipDuplicates: true,
      }),
    ])
  }
}

export const tagService = new TagService()
