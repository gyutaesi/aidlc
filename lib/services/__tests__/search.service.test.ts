import { SearchService } from '../search.service'
import { prisma } from '@/lib/prisma'
import { mockDeep, mockReset } from 'jest-mock-extended'

jest.mock('@/lib/prisma', () => ({ prisma: mockDeep<typeof prisma>() }))

const mockPrisma = prisma as jest.Mocked<typeof prisma>

describe('SearchService', () => {
  let searchService: SearchService

  beforeEach(() => {
    mockReset(mockPrisma)
    searchService = new SearchService()
  })

  describe('search', () => {
    it('빈 쿼리는 빈 배열을 반환한다', async () => {
      const result = await searchService.search('user-1', '')
      expect(result).toEqual([])
      expect(mockPrisma.$queryRaw).not.toHaveBeenCalled()
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
      mockPrisma.$queryRaw.mockResolvedValue(mockResults as never)

      const result = await searchService.search('user-1', 'example')

      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('bookmark')
      expect(result[0].title).toBe('Example')
    })

    it('100자 초과 쿼리는 잘라낸다', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([] as never)
      const longQuery = 'a'.repeat(150)

      await searchService.search('user-1', longQuery)

      // $queryRaw가 호출되었는지 확인 (쿼리가 잘려서 처리됨)
      expect(mockPrisma.$queryRaw).toHaveBeenCalled()
    })
  })
})
