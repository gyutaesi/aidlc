import { type NextRequest, NextResponse } from 'next/server'
import { withErrorHandler } from '@/lib/api/with-error-handler'
import { getTokenFromRequest } from '@/lib/api/get-token'
import { authService } from '@/lib/services/auth.service'
import { bookmarkService } from '@/lib/services/bookmark.service'
import { CreateBookmarkSchema, InboxQuerySchema } from '@/lib/schemas/bookmark.schema'
import { UnauthorizedError } from '@/lib/errors'

// GET /api/bookmarks — 인박스 목록 (Extension 포함)
export const GET = withErrorHandler(async (req: NextRequest) => {
  const token = getTokenFromRequest(req)
  if (!token) throw new UnauthorizedError()
  const user = await authService.getUserFromToken(token)

  const { searchParams } = req.nextUrl
  const query = InboxQuerySchema.parse({
    sort: searchParams.get('sort') ?? 'newest',
    filter: searchParams.get('filter') ?? 'all',
    page: searchParams.get('page') ?? '1',
    limit: searchParams.get('limit') ?? '20',
  })

  const result = await bookmarkService.getInbox(user.id, query)
  return NextResponse.json(result)
})

// POST /api/bookmarks — 북마크 저장 (Extension 포함)
export const POST = withErrorHandler(async (req: NextRequest) => {
  const token = getTokenFromRequest(req)
  if (!token) throw new UnauthorizedError()
  const user = await authService.getUserFromToken(token)

  const body = await req.json()
  const input = CreateBookmarkSchema.parse(body)
  const bookmark = await bookmarkService.create(user.id, input)

  return NextResponse.json(bookmark, { status: 201 })
})
