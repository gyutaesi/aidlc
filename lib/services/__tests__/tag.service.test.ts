import { TagService } from '../tag.service'
import { prisma } from '@/lib/prisma'
import { mockDeep, mockReset } from 'jest-mock-extended'

jest.mock('@/lib/prisma', () => ({ prisma: mockDeep<typeof prisma>() }))

const mockPrisma = prisma as jest.Mocked<typeof prisma>

const mockTag = {
  id: 'tag-1',
  userId: 'user-1',
  name: 'javascript',
  createdAt: new Date(),
}

describe('TagService', () => {
  let tagService: TagService

  beforeEach(() => {
    mockReset(mockPrisma)
    tagService = new TagService()
  })

  describe('getOrCreate', () => {
    it('태그를 소문자로 정규화하여 upsert한다', async () => {
      mockPrisma.tag.upsert.mockResolvedValue(mockTag)

      await tagService.getOrCreate('user-1', 'JavaScript')

      expect(mockPrisma.tag.upsert).toHaveBeenCalledWith({
        where: { userId_name: { userId: 'user-1', name: 'javascript' } },
        create: { userId: 'user-1', name: 'javascript' },
        update: {},
      })
    })

    it('앞뒤 공백을 제거한다', async () => {
      mockPrisma.tag.upsert.mockResolvedValue(mockTag)

      await tagService.getOrCreate('user-1', '  react  ')

      expect(mockPrisma.tag.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId_name: { userId: 'user-1', name: 'react' } },
        })
      )
    })
  })

  describe('autocomplete', () => {
    it('prefix로 시작하는 태그를 반환한다', async () => {
      mockPrisma.tag.findMany.mockResolvedValue([mockTag])

      const result = await tagService.autocomplete('user-1', 'java')

      expect(result).toHaveLength(1)
      expect(mockPrisma.tag.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', name: { startsWith: 'java' } },
        orderBy: { name: 'asc' },
        take: 10,
      })
    })
  })

  describe('setBookmarkTags', () => {
    it('기존 태그를 교체한다', async () => {
      mockPrisma.tag.upsert.mockResolvedValue(mockTag)
      mockPrisma.$transaction.mockResolvedValue([null, null] as never)

      await tagService.setBookmarkTags('user-1', 'bm-1', ['javascript'])

      expect(mockPrisma.$transaction).toHaveBeenCalled()
    })
  })
})
