import { load } from 'cheerio'
import { prisma } from '@/lib/prisma'
import { metadataService } from './metadata.service'
import { tagService } from './tag.service'
import { NotFoundError } from '@/lib/errors'
import { logger } from '@/lib/logger'
import type { Bookmark, Tag } from '@prisma/client'
import type {
  CreateBookmarkInput,
  UpdateBookmarkInput,
  InboxQueryInput,
} from '@/lib/schemas/bookmark.schema'

export interface BookmarkWithTags extends Bookmark {
  tags: Tag[]
}

export interface PaginatedResult<T> {
  data: T[]
  total: number
  page: number
  totalPages: number
  hasNext: boolean
}

export interface ImportResult {
  imported: number
  failed: number
}

export class BookmarkService {
  /**
   * 북마크 생성 (OG 메타데이터 자동 fetch)
   */
  async create(userId: string, input: CreateBookmarkInput): Promise<BookmarkWithTags> {
    // OG 메타데이터 fetch (실패해도 계속 진행)
    const metadata = await metadataService.fetchMetadata(input.url)

    const title = input.title ?? metadata?.title ?? new URL(input.url).hostname
    const description = input.description ?? metadata?.description ?? null
    const thumbnailUrl = input.thumbnailUrl ?? metadata?.thumbnailUrl ?? null

    const bookmark = await prisma.bookmark.create({
      data: {
        userId,
        url: input.url,
        title,
        description,
        thumbnailUrl,
        memo: input.memo ?? null,
      },
    })

    // 태그 연결
    const tagNames = input.tagNames ?? []
    if (tagNames.length > 0) {
      await tagService.setBookmarkTags(userId, bookmark.id, tagNames)
    }

    // 그룹 연결 (선택사항)
    if (input.groupId) {
      const maxPosition = await prisma.bookmarkGroup.aggregate({
        where: { groupId: input.groupId },
        _max: { position: true },
      })
      await prisma.bookmarkGroup.create({
        data: {
          bookmarkId: bookmark.id,
          groupId: input.groupId,
          position: (maxPosition._max.position ?? -1) + 1,
        },
      })
    }

    const tags = await tagService.getByBookmark(userId, bookmark.id)
    return { ...bookmark, tags }
  }

  /**
   * 북마크 수정
   */
  async update(
    userId: string,
    bookmarkId: string,
    input: UpdateBookmarkInput
  ): Promise<BookmarkWithTags> {
    await this.getById(userId, bookmarkId)

    const bookmark = await prisma.bookmark.update({
      where: { id: bookmarkId },
      data: {
        ...(input.title !== undefined && { title: input.title }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.thumbnailUrl !== undefined && { thumbnailUrl: input.thumbnailUrl }),
        ...(input.memo !== undefined && { memo: input.memo }),
      },
    })

    if (input.tagNames !== undefined) {
      await tagService.setBookmarkTags(userId, bookmarkId, input.tagNames)
    }

    const tags = await tagService.getByBookmark(userId, bookmarkId)
    return { ...bookmark, tags }
  }

  /**
   * 북마크 삭제 (컬렉션 링크 블록의 bookmark_id를 null로 변경)
   */
  async delete(userId: string, bookmarkId: string): Promise<void> {
    await this.getById(userId, bookmarkId)

    // 컬렉션 블록의 bookmark_id 참조 해제 (JSONB 업데이트)
    const collections = await prisma.collection.findMany({
      where: { userId },
      select: { id: true, blocks: true },
    })

    for (const collection of collections) {
      const blocks = collection.blocks as unknown as Array<Record<string, unknown>>
      const hasRef = blocks.some(
        (b) =>
          b.type === 'link' && (b.content as Record<string, unknown>)?.bookmarkId === bookmarkId
      )

      if (hasRef) {
        const updatedBlocks = blocks.map((b) => {
          if (
            b.type === 'link' &&
            (b.content as Record<string, unknown>)?.bookmarkId === bookmarkId
          ) {
            return {
              ...b,
              content: { ...(b.content as Record<string, unknown>), bookmarkId: null },
            }
          }
          return b
        })
        await prisma.collection.update({
          where: { id: collection.id },
          data: { blocks: updatedBlocks as unknown as never },
        })
      }
    }

    await prisma.bookmark.delete({ where: { id: bookmarkId } })
  }

  /**
   * 북마크를 그룹에 추가 (다대다 — 기존 그룹 소속 유지)
   */
  async moveToGroup(userId: string, bookmarkId: string, groupId: string): Promise<void> {
    await this.getById(userId, bookmarkId)

    // 그룹 소유권 검증
    const group = await prisma.group.findFirst({ where: { id: groupId, userId } })
    if (!group) throw new NotFoundError('Group')

    // 이미 해당 그룹에 소속인지 확인
    const existing = await prisma.bookmarkGroup.findUnique({
      where: { bookmarkId_groupId: { bookmarkId, groupId } },
    })
    if (existing) return // 이미 소속 — 중복 추가 방지

    const maxPosition = await prisma.bookmarkGroup.aggregate({
      where: { groupId },
      _max: { position: true },
    })

    await prisma.bookmarkGroup.create({
      data: {
        bookmarkId,
        groupId,
        position: (maxPosition._max.position ?? -1) + 1,
      },
    })
  }

  /**
   * 북마크를 특정 그룹에서 제거 (인박스로 이동)
   */
  async removeFromGroup(userId: string, bookmarkId: string, groupId: string): Promise<void> {
    await this.getById(userId, bookmarkId)
    await prisma.bookmarkGroup.deleteMany({
      where: { bookmarkId, groupId },
    })
  }

  /**
   * 인박스 목록 조회 (어떤 그룹에도 미소속인 북마크)
   */
  async getInbox(
    userId: string,
    options: InboxQueryInput
  ): Promise<PaginatedResult<BookmarkWithTags>> {
    const { sort, filter, page, limit } = options

    const where = {
      userId,
      bookmarkGroups: { none: {} },
      ...(filter === 'read' && { isRead: true }),
      ...(filter === 'unread' && { isRead: false }),
    }

    const [bookmarks, total] = await prisma.$transaction([
      prisma.bookmark.findMany({
        where,
        orderBy: { createdAt: sort === 'newest' ? 'desc' : 'asc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { bookmarkTags: { include: { tag: true } } },
      }),
      prisma.bookmark.count({ where }),
    ])

    const data = bookmarks.map((b) => ({
      ...b,
      tags: b.bookmarkTags.map((bt) => bt.tag),
    }))

    return {
      data,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
    }
  }

  /**
   * 그룹별 북마크 목록 조회
   */
  async getByGroup(userId: string, groupId: string): Promise<BookmarkWithTags[]> {
    const group = await prisma.group.findFirst({ where: { id: groupId, userId } })
    if (!group) throw new NotFoundError('Group')

    const bookmarkGroups = await prisma.bookmarkGroup.findMany({
      where: { groupId },
      orderBy: { position: 'asc' },
      include: {
        bookmark: {
          include: { bookmarkTags: { include: { tag: true } } },
        },
      },
    })

    return bookmarkGroups.map((bg) => ({
      ...bg.bookmark,
      tags: bg.bookmark.bookmarkTags.map((bt) => bt.tag),
    }))
  }

  /**
   * 최근 저장 북마크 목록 (Extension 팝업용)
   */
  async getRecent(userId: string, limit = 10): Promise<BookmarkWithTags[]> {
    const bookmarks = await prisma.bookmark.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { bookmarkTags: { include: { tag: true } } },
    })

    return bookmarks.map((b) => ({
      ...b,
      tags: b.bookmarkTags.map((bt) => bt.tag),
    }))
  }

  /**
   * 저장된 URL 목록 조회 (Extension 추천 필터링용)
   */
  async getUrls(userId: string): Promise<string[]> {
    const bookmarks = await prisma.bookmark.findMany({
      where: { userId },
      select: { url: true },
    })
    return bookmarks.map((b) => b.url)
  }

  /**
   * 읽음 처리
   */
  async markAsRead(userId: string, bookmarkId: string): Promise<void> {
    await this.getById(userId, bookmarkId)
    await prisma.bookmark.update({
      where: { id: bookmarkId },
      data: { isRead: true },
    })
  }

  /**
   * 읽지 않음 처리
   */
  async markAsUnread(userId: string, bookmarkId: string): Promise<void> {
    await this.getById(userId, bookmarkId)
    await prisma.bookmark.update({
      where: { id: bookmarkId },
      data: { isRead: false },
    })
  }

  /**
   * 크롬 북마크 HTML 파싱 → 인박스 일괄 추가 (중복 허용)
   */
  async importFromHtml(userId: string, htmlContent: string): Promise<ImportResult> {
    const $ = load(htmlContent)
    const links: Array<{ url: string; title: string }> = []

    $('a[href]').each((_, el) => {
      const href = $(el).attr('href') ?? ''
      const title = $(el).text().trim() || href
      if (href.startsWith('http://') || href.startsWith('https://')) {
        links.push({ url: href, title: title.slice(0, 200) })
      }
    })

    let imported = 0
    let failed = 0

    // 배치 처리 (50개씩)
    const BATCH_SIZE = 50
    for (let i = 0; i < links.length; i += BATCH_SIZE) {
      const batch = links.slice(i, i + BATCH_SIZE)
      const results = await Promise.allSettled(
        batch.map((link) =>
          prisma.bookmark.create({
            data: { userId, url: link.url, title: link.title },
          })
        )
      )

      for (const result of results) {
        if (result.status === 'fulfilled') {
          imported++
        } else {
          failed++
          logger.warn('Import bookmark failed', { error: result.reason })
        }
      }
    }

    return { imported, failed }
  }

  /**
   * JSON 내보내기
   */
  async exportToJson(userId: string): Promise<object> {
    const bookmarks = await prisma.bookmark.findMany({
      where: { userId },
      include: {
        bookmarkTags: { include: { tag: true } },
        bookmarkGroups: { include: { group: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return {
      exportedAt: new Date().toISOString(),
      bookmarks: bookmarks.map((b) => ({
        url: b.url,
        title: b.title,
        description: b.description,
        memo: b.memo,
        tags: b.bookmarkTags.map((bt) => bt.tag.name),
        groups: b.bookmarkGroups.map((bg) => bg.group.name),
        createdAt: b.createdAt,
      })),
    }
  }

  /**
   * Chrome HTML 내보내기
   */
  async exportToHtml(userId: string): Promise<string> {
    const groups = await prisma.group.findMany({
      where: { userId },
      include: {
        bookmarkGroups: {
          include: { bookmark: true },
          orderBy: { position: 'asc' },
        },
      },
      orderBy: { position: 'asc' },
    })

    const inboxBookmarks = await prisma.bookmark.findMany({
      where: { userId, bookmarkGroups: { none: {} } },
      orderBy: { createdAt: 'desc' },
    })

    let html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<!-- This is an automatically generated file.
     It will be read and overwritten.
     DO NOT EDIT! -->
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
`

    // 인박스
    if (inboxBookmarks.length > 0) {
      html += `    <DT><H3>인박스</H3>\n    <DL><p>\n`
      for (const b of inboxBookmarks) {
        const addDate = Math.floor(b.createdAt.getTime() / 1000)
        html += `        <DT><A HREF="${b.url}" ADD_DATE="${addDate}">${b.title}</A>\n`
      }
      html += `    </DL><p>\n`
    }

    // 그룹별
    for (const group of groups) {
      html += `    <DT><H3>${group.name}</H3>\n    <DL><p>\n`
      for (const bg of group.bookmarkGroups) {
        const addDate = Math.floor(bg.bookmark.createdAt.getTime() / 1000)
        html += `        <DT><A HREF="${bg.bookmark.url}" ADD_DATE="${addDate}">${bg.bookmark.title}</A>\n`
      }
      html += `    </DL><p>\n`
    }

    html += `</DL><p>\n`
    return html
  }

  /**
   * 단건 조회 (소유권 검증 포함)
   */
  async getById(userId: string, bookmarkId: string): Promise<Bookmark> {
    const bookmark = await prisma.bookmark.findFirst({
      where: { id: bookmarkId, userId },
    })
    if (!bookmark) throw new NotFoundError('Bookmark')
    return bookmark
  }
}

export const bookmarkService = new BookmarkService()
