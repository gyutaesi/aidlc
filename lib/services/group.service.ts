import { prisma } from '@/lib/prisma'
import { NotFoundError } from '@/lib/errors'
import type { Group } from '@prisma/client'
import type { CreateGroupInput, UpdateGroupInput, ConvertToCollectionInput } from '@/lib/schemas/group.schema'
import type { BookmarkWithTags } from './bookmark.service'

export interface GroupWithBookmarks extends Group {
  bookmarks: BookmarkWithTags[]
}

export class GroupService {
  /**
   * 그룹 생성
   */
  async create(userId: string, input: CreateGroupInput): Promise<Group> {
    const maxPosition = await prisma.group.aggregate({
      where: { userId },
      _max: { position: true },
    })

    return prisma.group.create({
      data: {
        userId,
        name: input.name,
        emoji: input.emoji ?? null,
        position: (maxPosition._max.position ?? -1) + 1,
      },
    })
  }

  /**
   * 그룹 수정
   */
  async update(userId: string, groupId: string, input: UpdateGroupInput): Promise<Group> {
    await this.getById(userId, groupId)

    return prisma.group.update({
      where: { id: groupId },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.emoji !== undefined && { emoji: input.emoji }),
      },
    })
  }

  /**
   * 그룹 삭제 (BookmarkGroup 레코드만 삭제, 북마크 원본 유지)
   */
  async delete(userId: string, groupId: string): Promise<void> {
    await this.getById(userId, groupId)
    await prisma.group.delete({ where: { id: groupId } })
    // BookmarkGroup은 cascade로 자동 삭제
  }

  /**
   * 전체 그룹 목록 조회 (북마크 포함)
   */
  async getAll(userId: string): Promise<GroupWithBookmarks[]> {
    const groups = await prisma.group.findMany({
      where: { userId },
      orderBy: { position: 'asc' },
      include: {
        bookmarkGroups: {
          orderBy: { position: 'asc' },
          include: {
            bookmark: {
              include: { bookmarkTags: { include: { tag: true } } },
            },
          },
        },
      },
    })

    return groups.map((g) => ({
      ...g,
      bookmarks: g.bookmarkGroups.map((bg) => ({
        ...bg.bookmark,
        tags: bg.bookmark.bookmarkTags.map((bt) => bt.tag),
      })),
    }))
  }

  /**
   * 그룹 내 북마크 순서 변경
   */
  async reorderBookmarks(
    userId: string,
    groupId: string,
    orderedBookmarkIds: string[]
  ): Promise<void> {
    await this.getById(userId, groupId)

    await prisma.$transaction(
      orderedBookmarkIds.map((bookmarkId, index) =>
        prisma.bookmarkGroup.update({
          where: { bookmarkId_groupId: { bookmarkId, groupId } },
          data: { position: index },
        })
      )
    )
  }

  /**
   * 그룹 컬럼 순서 변경
   */
  async reorderGroups(userId: string, orderedGroupIds: string[]): Promise<void> {
    await prisma.$transaction(
      orderedGroupIds.map((groupId, index) =>
        prisma.group.update({
          where: { id: groupId, userId },
          data: { position: index },
        })
      )
    )
  }

  /**
   * 그룹 → 컬렉션 변환 (원본 그룹 유지, 북마크 복사)
   */
  async convertToCollection(
    userId: string,
    groupId: string,
    input: ConvertToCollectionInput
  ): Promise<{ id: string }> {
    await this.getById(userId, groupId)

    // 선택된 북마크 조회 (소유권 검증 포함)
    const bookmarks = await prisma.bookmark.findMany({
      where: { id: { in: input.bookmarkIds }, userId },
      include: { bookmarkTags: { include: { tag: true } } },
    })

    if (bookmarks.length === 0) throw new NotFoundError('Bookmarks')

    const { customAlphabet } = await import('nanoid')
    const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 10)
    const blockNanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 8)

    // 슬러그 생성 (충돌 시 재생성)
    let slug = nanoid()
    while (await prisma.collection.findUnique({ where: { slug } })) {
      slug = nanoid()
    }

    const maxPosition = await prisma.collection.aggregate({
      where: { userId },
      _max: { position: true },
    })

    // 링크 블록 생성
    const blocks = bookmarks.map((b, index) => ({
      id: blockNanoid(),
      type: 'link' as const,
      position: index,
      content: {
        bookmarkId: b.id,
        url: b.url,
        title: b.title,
        description: b.description ?? null,
        thumbnailUrl: b.thumbnailUrl ?? null,
        tags: b.bookmarkTags.map((bt) => bt.tag.name),
      },
    }))

    const collection = await prisma.collection.create({
      data: {
        userId,
        name: input.collection.name,
        emoji: input.collection.emoji ?? null,
        description: input.collection.description ?? null,
        template: input.collection.template,
        slug,
        blocks,
        position: (maxPosition._max.position ?? -1) + 1,
      },
    })

    return { id: collection.id }
  }

  /**
   * 단건 조회 (소유권 검증)
   */
  async getById(userId: string, groupId: string): Promise<Group> {
    const group = await prisma.group.findFirst({ where: { id: groupId, userId } })
    if (!group) throw new NotFoundError('Group')
    return group
  }
}

export const groupService = new GroupService()
