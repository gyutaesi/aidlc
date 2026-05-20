import { BookmarkService } from '../bookmark.service'
import { NotFoundError } from '@/lib/errors'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    bookmark: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    bookmarkGroup: {
      aggregate: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
    },
    bookmarkTag: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    collection: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    $transaction: jest.fn(),
  },
}))

jest.mock('../metadata.service', () => ({
  metadataService: { fetchMetadata: jest.fn() },
}))

jest.mock('../tag.service', () => ({
  tagService: {
    setBookmarkTags: jest.fn(),
    getByBookmark: jest.fn().mockResolvedValue([]),
    getOrCreateMany: jest.fn().mockResolvedValue([]),
  },
}))

import { prisma } from '@/lib/prisma'
import { metadataService } from '../metadata.service'

const mockBookmark = {
  id: 'bm-1',
  userId: 'user-1',
  url: 'https://example.com',
  title: 'Example',
  description: null,
  thumbnailUrl: null,
  memo: null,
  isRead: false,
  createdAt: new Date(),
  updatedAt: new Date(),
}

describe('BookmarkService', () => {
  let bookmarkService: BookmarkService

  beforeEach(() => {
    jest.clearAllMocks()
    bookmarkService = new BookmarkService()
  })

  describe('create', () => {
    it('OG 메타데이터와 함께 북마크를 생성한다', async () => {
      ;(metadataService.fetchMetadata as jest.Mock).mockResolvedValue({
        title: 'Example Title',
        description: 'Example Description',
        thumbnailUrl: null,
        favicon: null,
      })
      ;(prisma.bookmark.create as jest.Mock).mockResolvedValue(mockBookmark)
      ;(prisma.bookmarkGroup.aggregate as jest.Mock).mockResolvedValue({
        _max: { position: null },
      })

      const result = await bookmarkService.create('user-1', {
        url: 'https://example.com',
        tagNames: [],
      })

      expect(result.url).toBe('https://example.com')
      expect(metadataService.fetchMetadata).toHaveBeenCalledWith('https://example.com')
    })

    it('OG fetch 실패 시에도 북마크를 생성한다', async () => {
      ;(metadataService.fetchMetadata as jest.Mock).mockResolvedValue(null)
      ;(prisma.bookmark.create as jest.Mock).mockResolvedValue(mockBookmark)
      ;(prisma.bookmarkGroup.aggregate as jest.Mock).mockResolvedValue({
        _max: { position: null },
      })

      const result = await bookmarkService.create('user-1', {
        url: 'https://example.com',
        title: '수동 입력 제목',
        tagNames: [],
      })

      expect(result).toBeDefined()
    })
  })

  describe('getInbox', () => {
    it('인박스 북마크 목록을 반환한다', async () => {
      ;(prisma.$transaction as jest.Mock).mockResolvedValue([
        [{ ...mockBookmark, bookmarkTags: [] }],
        1,
      ])

      const result = await bookmarkService.getInbox('user-1', {
        sort: 'newest',
        filter: 'all',
        page: 1,
        limit: 20,
      })

      expect(result.data).toHaveLength(1)
      expect(result.total).toBe(1)
      expect(result.hasNext).toBe(false)
    })
  })

  describe('delete', () => {
    it('존재하지 않는 북마크 삭제 시 NotFoundError를 던진다', async () => {
      ;(prisma.bookmark.findFirst as jest.Mock).mockResolvedValue(null)

      await expect(bookmarkService.delete('user-1', 'non-existent')).rejects.toThrow(NotFoundError)
    })
  })

  describe('markAsRead', () => {
    it('북마크를 읽음으로 표시한다', async () => {
      ;(prisma.bookmark.findFirst as jest.Mock).mockResolvedValue(mockBookmark)
      ;(prisma.bookmark.update as jest.Mock).mockResolvedValue({ ...mockBookmark, isRead: true })

      await bookmarkService.markAsRead('user-1', 'bm-1')

      expect(prisma.bookmark.update).toHaveBeenCalledWith({
        where: { id: 'bm-1' },
        data: { isRead: true },
      })
    })
  })

  describe('importFromHtml', () => {
    it('크롬 북마크 HTML을 파싱하여 가져온다', async () => {
      const html = `
        <DL>
          <DT><A HREF="https://example.com">Example</A>
          <DT><A HREF="https://test.com">Test</A>
          <DT><A HREF="not-a-url">Invalid</A>
        </DL>
      `
      ;(prisma.bookmark.create as jest.Mock).mockResolvedValue(mockBookmark)

      const result = await bookmarkService.importFromHtml('user-1', html)

      expect(result.imported).toBe(2)
      expect(result.failed).toBe(0)
    })
  })
})
