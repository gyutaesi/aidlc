import { prisma } from '@/lib/prisma'
import { NotFoundError, ConflictError } from '@/lib/errors'
import { metadataService } from './metadata.service'
import type { Collection } from '@prisma/client'
import type {
  CreateCollectionInput,
  UpdateCollectionInput,
  AddBlockInput,
} from '@/lib/schemas/collection.schema'

export interface Block {
  id: string
  type: 'link' | 'text' | 'image'
  position: number
  content: Record<string, unknown>
}

export interface PublicCollection extends Collection {
  ownerEmail: string
}

export class CollectionService {
  /**
   * 컬렉션 생성
   */
  async create(userId: string, input: CreateCollectionInput): Promise<Collection> {
    const slug = await this.generateUniqueSlug()

    const maxPosition = await prisma.collection.aggregate({
      where: { userId },
      _max: { position: true },
    })

    return prisma.collection.create({
      data: {
        userId,
        name: input.name,
        emoji: input.emoji ?? null,
        description: input.description ?? null,
        template: input.template,
        slug,
        blocks: [],
        position: (maxPosition._max.position ?? -1) + 1,
      },
    })
  }

  /**
   * 컬렉션 수정
   */
  async update(
    userId: string,
    collectionId: string,
    input: UpdateCollectionInput
  ): Promise<Collection> {
    await this.getById(userId, collectionId)

    return prisma.collection.update({
      where: { id: collectionId },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.emoji !== undefined && { emoji: input.emoji }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.template !== undefined && { template: input.template }),
      },
    })
  }

  /**
   * 컬렉션 삭제
   */
  async delete(userId: string, collectionId: string): Promise<void> {
    await this.getById(userId, collectionId)
    await prisma.collection.delete({ where: { id: collectionId } })
  }

  /**
   * 블록 추가 (두 경로: 기존 북마크 연결 또는 URL 직접 입력)
   */
  async addBlock(userId: string, collectionId: string, blockInput: AddBlockInput): Promise<Collection> {
    const collection = await this.getById(userId, collectionId)
    const blocks = collection.blocks as Block[]

    const { customAlphabet } = await import('nanoid')
    const blockNanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 8)

    let content: Record<string, unknown> = blockInput.content as Record<string, unknown>

    // 링크 블록 + URL 직접 입력 시 OG 메타데이터 fetch
    if (blockInput.type === 'link' && !('bookmarkId' in blockInput.content)) {
      const metadata = await metadataService.fetchMetadata(blockInput.content.url)
      content = {
        bookmarkId: null,
        url: blockInput.content.url,
        title: blockInput.content.title || metadata?.title || new URL(blockInput.content.url).hostname,
        description: blockInput.content.description ?? metadata?.description ?? null,
        thumbnailUrl: metadata?.thumbnailUrl ?? null,
        tags: [],
      }
    }

    const newBlock: Block = {
      id: blockNanoid(),
      type: blockInput.type,
      position: blocks.length,
      content,
    }

    return prisma.collection.update({
      where: { id: collectionId },
      data: { blocks: [...blocks, newBlock] },
    })
  }

  /**
   * 블록 수정
   */
  async updateBlock(
    userId: string,
    collectionId: string,
    blockId: string,
    content: Record<string, unknown>
  ): Promise<Collection> {
    const collection = await this.getById(userId, collectionId)
    const blocks = collection.blocks as Block[]

    const blockIndex = blocks.findIndex((b) => b.id === blockId)
    if (blockIndex === -1) throw new NotFoundError('Block')

    const updatedBlocks = blocks.map((b) =>
      b.id === blockId ? { ...b, content } : b
    )

    return prisma.collection.update({
      where: { id: collectionId },
      data: { blocks: updatedBlocks },
    })
  }

  /**
   * 블록 삭제
   */
  async deleteBlock(
    userId: string,
    collectionId: string,
    blockId: string
  ): Promise<Collection> {
    const collection = await this.getById(userId, collectionId)
    const blocks = collection.blocks as Block[]

    const filtered = blocks.filter((b) => b.id !== blockId)
    if (filtered.length === blocks.length) throw new NotFoundError('Block')

    // position 재할당
    const reindexed = filtered.map((b, i) => ({ ...b, position: i }))

    return prisma.collection.update({
      where: { id: collectionId },
      data: { blocks: reindexed },
    })
  }

  /**
   * 블록 순서 변경
   */
  async reorderBlocks(
    userId: string,
    collectionId: string,
    orderedBlockIds: string[]
  ): Promise<Collection> {
    const collection = await this.getById(userId, collectionId)
    const blocks = collection.blocks as Block[]

    const reordered = orderedBlockIds.map((id, index) => {
      const block = blocks.find((b) => b.id === id)
      if (!block) throw new NotFoundError('Block')
      return { ...block, position: index }
    })

    return prisma.collection.update({
      where: { id: collectionId },
      data: { blocks: reordered },
    })
  }

  /**
   * 공유 ON/OFF 토글
   */
  async togglePublic(userId: string, collectionId: string): Promise<Collection> {
    const collection = await this.getById(userId, collectionId)

    return prisma.collection.update({
      where: { id: collectionId },
      data: { isPublic: !collection.isPublic },
    })
  }

  /**
   * 슬러그 변경 (중복 체크 포함)
   */
  async updateSlug(userId: string, collectionId: string, slug: string): Promise<Collection> {
    await this.getById(userId, collectionId)

    const isAvailable = await this.isSlugAvailable(slug, collectionId)
    if (!isAvailable) throw new ConflictError('Slug is already taken')

    return prisma.collection.update({
      where: { id: collectionId },
      data: { slug },
    })
  }

  /**
   * 슬러그 중복 여부 확인
   */
  async isSlugAvailable(slug: string, excludeCollectionId?: string): Promise<boolean> {
    const existing = await prisma.collection.findUnique({ where: { slug } })
    if (!existing) return true
    if (excludeCollectionId && existing.id === excludeCollectionId) return true
    return false
  }

  /**
   * 공개 컬렉션 조회 (비로그인 접근 가능)
   */
  async getPublicBySlug(slug: string): Promise<PublicCollection | null> {
    const collection = await prisma.collection.findFirst({
      where: { slug, isPublic: true },
      include: { user: { select: { email: true } } },
    })

    if (!collection) return null

    return {
      ...collection,
      ownerEmail: collection.user.email,
    }
  }

  /**
   * 컬렉션 단건 조회 (편집 페이지용)
   */
  async getById(userId: string, collectionId: string): Promise<Collection> {
    const collection = await prisma.collection.findFirst({
      where: { id: collectionId, userId },
    })
    if (!collection) throw new NotFoundError('Collection')
    return collection
  }

  /**
   * 컬렉션 목록 조회
   */
  async getAll(userId: string): Promise<Collection[]> {
    return prisma.collection.findMany({
      where: { userId },
      orderBy: { position: 'asc' },
    })
  }

  /**
   * 컬렉션 순서 변경
   */
  async reorderCollections(userId: string, orderedCollectionIds: string[]): Promise<void> {
    await prisma.$transaction(
      orderedCollectionIds.map((collectionId, index) =>
        prisma.collection.update({
          where: { id: collectionId, userId },
          data: { position: index },
        })
      )
    )
  }

  private async generateUniqueSlug(): Promise<string> {
    const { customAlphabet } = await import('nanoid')
    const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 10)

    let slug = nanoid()
    while (!(await this.isSlugAvailable(slug))) {
      slug = nanoid()
    }
    return slug
  }
}

export const collectionService = new CollectionService()
