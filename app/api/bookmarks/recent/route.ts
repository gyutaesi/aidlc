import { type NextRequest, NextResponse } from 'next/server'
import { withErrorHandler } from '@/lib/api/with-error-handler'
import { getTokenFromRequest } from '@/lib/api/get-token'
import { authService } from '@/lib/services/auth.service'
import { bookmarkService } from '@/lib/services/bookmark.service'
import { UnauthorizedError } from '@/lib/errors'

// GET /api/bookmarks/recent — 최근 저장 목록 (Extension 팝업용)
export const GET = withErrorHandler(async (req: NextRequest) => {
  const token = getTokenFromRequest(req)
  if (!token) throw new UnauthorizedError()
  const user = await authService.getUserFromToken(token)

  const limit = Number(req.nextUrl.searchParams.get('limit') ?? '10')
  const bookmarks = await bookmarkService.getRecent(user.id, Math.min(limit, 50))

  return NextResponse.json(bookmarks)
})
