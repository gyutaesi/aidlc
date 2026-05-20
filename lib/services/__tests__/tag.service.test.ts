import { TagService } from '../tag.service'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    tag: {
      upsert: jest.fn(),
      findMany: jest.fn(),
    },
    bookmarkTag: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}))

import { prisma } from '@/lib/prisma'

const mockTag = {
  id: 'tag-1',
  userId: 'user-1',
  name: 'javascript',
  createdAt: new Date(),
}

describe('TagService', () => {
  let tagService: TagService

  beforeEach(() => {
    jest.clearAllMocks()
    tagService = new TagService()
  })

  describe('getOrCreate', () => {
    it('태그를 소문자로 정규화하여 upsert한다', async () => {
      ;(prisma.tag.upsert as jest.Mock).mockResolvedValue(mockTag)

      await tagService.getOrCreate('user-1', 'JavaScript')

      expect(prisma.tag.upsert).toHaveBeenCalledWith({
        where: { userId_name: { userId: 'user-1', name: 'javascript' } },
        create: { userId: 'user-1', name: 'javascript' },
        update: {},
      })
    })

    it('앞뒤 공백을 제거한다', async () => {
      ;(prisma.tag.upsert as jest.Mock).mockResolvedValue(mockTag)

      await tagService.getOrCreate('user-1', '  react  ')

      expect(prisma.tag.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId_name: { userId: 'user-1', name: 'react' } },
        })
      )
    })
  })

  describe('autocomplete', () => {
    it('prefix로 시작하는 태그를 반환한다', async () => {
      ;(prisma.tag.findMany as jest.Mock).mockResolvedValue([mockTag])

      const result = await tagService.autocomplete('user-1', 'java')

      expect(result).toHaveLength(1)
      expect(prisma.tag.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', name: { startsWith: 'java' } },
        orderBy: { name: 'asc' },
        take: 10,
      })
    })
  })

  describe('setBookmarkTags', () => {
    it('기존 태그를 교체한다', async () => {
      ;(prisma.tag.upsert as jest.Mock).mockResolvedValue(mockTag)
      ;(prisma.$transaction as jest.Mock).mockResolvedValue([null, null])

      await tagService.setBookmarkTags('user-1', 'bm-1', ['javascript'])

      expect(prisma.$transaction).toHaveBeenCalled()
    })
  })
})
