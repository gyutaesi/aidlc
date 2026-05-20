import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

export interface SearchResult {
  type: 'bookmark' | 'collection'
  id: string
  title: string
  url: string | null
  snippet: string | null
  createdAt: Date
}

interface RawSearchResult {
  type: string
  id: string
  title: string
  url: string | null
  created_at: Date
}

export class SearchService {
  /**
   * 풀텍스트 검색 (북마크 + 컬렉션)
   * 검색 대상: 제목, URL, 메모, 태그, 컬렉션 이름, 설명, 블록 텍스트
   */
  async search(userId: string, query: string, limit = 20): Promise<SearchResult[]> {
    if (!query.trim()) return []

    const sanitizedQuery = query.trim().slice(0, 100)

    // ILIKE 와일드카드 이스케이프
    const escapedQuery = sanitizedQuery
      .replace(/%/g, '\\%')
      .replace(/_/g, '\\_')

    const results = await prisma.$queryRaw<RawSearchResult[]>`
      SELECT 'bookmark' as type, b.id, b.title, b.url,
             ts_rank(b.search_vector, plainto_tsquery('simple', ${sanitizedQuery})) as rank,
             b.created_at
      FROM "bookmarks" b
      WHERE b.user_id = ${userId}
        AND (
          b.search_vector @@ plainto_tsquery('simple', ${sanitizedQuery})
          OR EXISTS (
            SELECT 1 FROM "bookmark_tags" bt
            JOIN "tags" t ON t.id = bt.tag_id
            WHERE bt.bookmark_id = b.id
              AND t.name ILIKE ${`%${escapedQuery}%`} ESCAPE '\\'
          )
        )

      UNION ALL

      SELECT 'collection' as type, c.id, c.name as title, NULL as url,
             ts_rank(c.search_vector, plainto_tsquery('simple', ${sanitizedQuery})) as rank,
             c.created_at
      FROM "collections" c
      WHERE c.user_id = ${userId}
        AND c.search_vector @@ plainto_tsquery('simple', ${sanitizedQuery})

      ORDER BY rank DESC, created_at DESC
      LIMIT ${Prisma.raw(String(limit))}
    `

    return results.map((r) => ({
      type: r.type as 'bookmark' | 'collection',
      id: r.id,
      title: r.title,
      url: r.url,
      snippet: null,
      createdAt: r.created_at,
    }))
  }
}

export const searchService = new SearchService()
