import { CollectionService } from '../collection.service'
import { NotFoundError, ConflictError } from '@/lib/errors'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    collection: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      aggregate: jest.fn(),
    },
  },
}))

jest.mock('../metadata.service', () => ({
  metadataService: { fetchMetadata: jest.fn().mockResolvedValue(null) },
}))

jest.mock('nanoid', () => ({
  customAlphabet: () => () => 'testslug12',
}))

import { prisma } from '@/lib/prisma'

const mockCollection = {
  id: 'col-1',
  userId: 'user-1',
  name: 'Test Collection',
  emoji: null,
  description: null,
  slug: 'testslug12',
  isPublic: false,
  template: 'guide',
  viewCount: 0,
  blocks: [],
  position: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
}

describe('CollectionService', () => {
  let collectionService: CollectionService

  beforeEach(() => {
    jest.clearAllMocks()
    collectionService = new CollectionService()
  })

  describe('create', () => {
    it('컬렉션을 생성한다', async () => {
      ;(prisma.collection.findUnique as jest.Mock).mockResolvedValue(null)
      ;(prisma.collection.aggregate as jest.Mock).mockResolvedValue({ _max: { position: null } })
      ;(prisma.collection.create as jest.Mock).mockResolvedValue(mockCollection)

      const result = await collectionService.create('user-1', {
        name: 'Test Collection',
        template: 'guide',
      })

      expect(result.name).toBe('Test Collection')
      expect(result.isPublic).toBe(false)
    })
  })

  describe('togglePublic', () => {
    it('공개 상태를 토글한다', async () => {
      ;(prisma.collection.findFirst as jest.Mock).mockResolvedValue(mockCollection)
      ;(prisma.collection.update as jest.Mock).mockResolvedValue({
        ...mockCollection,
        isPublic: true,
      })

      const result = await collectionService.togglePublic('user-1', 'col-1')
      expect(result.isPublic).toBe(true)
    })
  })

  describe('updateSlug', () => {
    it('슬러그를 변경한다', async () => {
      ;(prisma.collection.findFirst as jest.Mock).mockResolvedValue(mockCollection)
      ;(prisma.collection.findUnique as jest.Mock).mockResolvedValue(null)
      ;(prisma.collection.update as jest.Mock).mockResolvedValue({
        ...mockCollection,
        slug: 'new-slug',
      })

      const result = await collectionService.updateSlug('user-1', 'col-1', 'new-slug')
      expect(result.slug).toBe('new-slug')
    })

    it('중복 슬러그 시 ConflictError를 던진다', async () => {
      ;(prisma.collection.findFirst as jest.Mock).mockResolvedValue(mockCollection)
      ;(prisma.collection.findUnique as jest.Mock).mockResolvedValue({
        ...mockCollection,
        id: 'col-2',
      })

      await expect(collectionService.updateSlug('user-1', 'col-1', 'taken-slug')).rejects.toThrow(
        ConflictError
      )
    })
  })

  describe('reorderBlocks', () => {
    it('블록 순서를 변경한다', async () => {
      const blocks = [
        { id: 'block-a', type: 'text', position: 0, content: { markdown: 'A' } },
        { id: 'block-b', type: 'text', position: 1, content: { markdown: 'B' } },
      ]
      ;(prisma.collection.findFirst as jest.Mock).mockResolvedValue({
        ...mockCollection,
        blocks,
      })
      ;(prisma.collection.update as jest.Mock).mockResolvedValue({
        ...mockCollection,
        blocks: [
          { id: 'block-b', type: 'text', position: 0, content: { markdown: 'B' } },
          { id: 'block-a', type: 'text', position: 1, content: { markdown: 'A' } },
        ],
      })

      const result = await collectionService.reorderBlocks('user-1', 'col-1', [
        'block-b',
        'block-a',
      ])
      const resultBlocks = result.blocks as Array<{ id: string; position: number }>
      expect(resultBlocks[0].id).toBe('block-b')
      expect(resultBlocks[0].position).toBe(0)
    })

    it('존재하지 않는 블록 ID 시 NotFoundError를 던진다', async () => {
      ;(prisma.collection.findFirst as jest.Mock).mockResolvedValue({
        ...mockCollection,
        blocks: [{ id: 'block-a', type: 'text', position: 0, content: {} }],
      })

      await expect(
        collectionService.reorderBlocks('user-1', 'col-1', ['non-existent'])
      ).rejects.toThrow(NotFoundError)
    })
  })
})
