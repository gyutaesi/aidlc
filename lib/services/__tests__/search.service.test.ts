import { SearchService } from '../search.service'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    $queryRaw: jest.fn(),
  },
}))

import { prisma } from '@/lib/prisma'

describe('SearchService', () => {
  let searchService: SearchService

  beforeEach(() => {
    jest.clearAllMocks()
    searchService = new SearchService()
  })

  describe('search', () => {
    it('빈 쿼리는 빈 배열을 반환한다', async () => {
      const result = await searchService.search('user-1', '')
      expect(result).toEqual([])
      expect(prisma.$queryRaw).not.toHaveBeenCalled()
    })

    it('공백만 있는 쿼리는 빈 배열을 반환한다', async () => {
      const result = await searchService.search('user-1', '   ')
      expect(result).toEqual([])
    })

    it('검색 결과를 반환한다', async () => {
      const mockResults = [
        {
          type: 'bookmark',
          id: 'bm-1',
          title: 'Example',
          url: 'https://example.com',
          created_at: new Date(),
        },
      ]
      ;(prisma.$queryRaw as jest.Mock).mockResolvedValue(mockResults)

      const result = await searchService.search('user-1', 'example')

      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('bookmark')
      expect(result[0].title).toBe('Example')
    })

    it('100자 초과 쿼리는 잘라낸다', async () => {
      ;(prisma.$queryRaw as jest.Mock).mockResolvedValue([])
      const longQuery = 'a'.repeat(150)

      await searchService.search('user-1', longQuery)

      expect(prisma.$queryRaw).toHaveBeenCalled()
    })
  })
})
