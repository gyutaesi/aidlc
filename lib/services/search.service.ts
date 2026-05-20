import { prisma } from '@/lib/prisma'

export interface SearchResult {
  type: 'bookmark' | 'collection'
  id: string
  title: string
  url: string | null
  snippet: string | null
  createdAt: Date
}

export class SearchService {
  async search(userId: string, query: string, limit = 20): Promise<SearchResult[]> {
    if (!query.trim()) return []

    const [bookmarks, collections] = await Promise.all([
      prisma.bookmark.findMany({
        where: {
          userId,
          OR: [
            { title: { contains: query.trim(), mode: 'insensitive' } },
            { url: { contains: query.trim(), mode: 'insensitive' } },
            { memo: { contains: query.trim(), mode: 'insensitive' } },
            {
              bookmarkTags: {
                some: { tag: { name: { contains: query.trim(), mode: 'insensitive' } } },
              },
            },
          ],
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: { id: true, title: true, url: true, createdAt: true },
      }),
      prisma.collection.findMany({
        where: {
          userId,
          OR: [
            { name: { contains: query.trim(), mode: 'insensitive' } },
            { description: { contains: query.trim(), mode: 'insensitive' } },
          ],
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: { id: true, name: true, createdAt: true },
      }),
    ])

    const results: SearchResult[] = [
      ...bookmarks.map((b) => ({
        type: 'bookmark' as const,
        id: b.id,
        title: b.title,
        url: b.url,
        snippet: null,
        createdAt: b.createdAt,
      })),
      ...collections.map((c) => ({
        type: 'collection' as const,
        id: c.id,
        title: c.name,
        url: null,
        snippet: null,
        createdAt: c.createdAt,
      })),
    ]

    return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, limit)
  }
}

export const searchService = new SearchService()
