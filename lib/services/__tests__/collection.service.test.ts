import { CollectionService } from '../collection.service'
import { prisma } from '@/lib/prisma'
import { NotFoundError, ConflictError } from '@/lib/errors'
import { mockDeep, mockReset } from 'jest-mock-extended'

jest.mock('@/lib/prisma', () => ({ prisma: mockDeep<typeof prisma>() }))
jest.mock('../metadata.service', () => ({
  metadataService: { fetchMetadata: jest.fn().mockResolvedValue(null) },
}))
jest.mock('nanoid', () => ({
  customAlphabet: () => () => 'testslug12',
}))

const mockPrisma = prisma as jest.Mocked<typeof prisma>

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
    mockReset(mockPrisma)
    collectionService = new CollectionService()
  })

  describe('create', () => {
    it('컬렉션을 생성한다', async () => {
      mockPrisma.collection.findUnique.mockResolvedValue(null) // 슬러그 중복 없음
      mockPrisma.collection.aggregate.mockResolvedValue({ _max: { position: null } } as never)
      mockPrisma.collection.create.mockResolvedValue(mockCollection)

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
      mockPrisma.collection.findFirst.mockResolvedValue(mockCollection)
      mockPrisma.collection.update.mockResolvedValue({ ...mockCollection, isPublic: true })

      const result = await collectionService.togglePublic('user-1', 'col-1')
      expect(result.isPublic).toBe(true)
    })
  })

  describe('updateSlug', () => {
    it('슬러그를 변경한다', async () => {
      mockPrisma.collection.findFirst.mockResolvedValue(mockCollection)
      mockPrisma.collection.findUnique.mockResolvedValue(null) // 슬러그 사용 가능
      mockPrisma.collection.update.mockResolvedValue({ ...mockCollection, slug: 'new-slug' })

      const result = await collectionService.updateSlug('user-1', 'col-1', 'new-slug')
      expect(result.slug).toBe('new-slug')
    })

    it('중복 슬러그 시 ConflictError를 던진다', async () => {
      mockPrisma.collection.findFirst.mockResolvedValue(mockCollection)
      // 다른 컬렉션이 같은 슬러그 사용 중
      mockPrisma.collection.findUnique.mockResolvedValue({ ...mockCollection, id: 'col-2' })

      await expect(
        collectionService.updateSlug('user-1', 'col-1', 'taken-slug')
      ).rejects.toThrow(ConflictError)
    })
  })

  describe('reorderBlocks', () => {
    it('블록 순서를 변경한다', async () => {
      const blocks = [
        { id: 'block-a', type: 'text', position: 0, content: { markdown: 'A' } },
        { id: 'block-b', type: 'text', position: 1, content: { markdown: 'B' } },
      ]
      mockPrisma.collection.findFirst.mockResolvedValue({ ...mockCollection, blocks })
      mockPrisma.collection.update.mockResolvedValue({
        ...mockCollection,
        blocks: [
          { id: 'block-b', type: 'text', position: 0, content: { markdown: 'B' } },
          { id: 'block-a', type: 'text', position: 1, content: { markdown: 'A' } },
        ],
      })

      const result = await collectionService.reorderBlocks('user-1', 'col-1', ['block-b', 'block-a'])
      const resultBlocks = result.blocks as Array<{ id: string; position: number }>
      expect(resultBlocks[0].id).toBe('block-b')
      expect(resultBlocks[0].position).toBe(0)
    })

    it('존재하지 않는 블록 ID 시 NotFoundError를 던진다', async () => {
      mockPrisma.collection.findFirst.mockResolvedValue({
        ...mockCollection,
        blocks: [{ id: 'block-a', type: 'text', position: 0, content: {} }],
      })

      await expect(
        collectionService.reorderBlocks('user-1', 'col-1', ['non-existent'])
      ).rejects.toThrow(NotFoundError)
    })
  })
})
