import { type NextRequest, NextResponse } from 'next/server'
import { withErrorHandler } from '@/lib/api/with-error-handler'
import { getTokenFromRequest } from '@/lib/api/get-token'
import { authService } from '@/lib/services/auth.service'
import { bookmarkService } from '@/lib/services/bookmark.service'
import { UnauthorizedError } from '@/lib/errors'

// GET /api/bookmarks/urls — 저장된 URL 목록 (Extension 추천 필터링용, 경량)
export const GET = withErrorHandler(async (req: NextRequest) => {
  const token = getTokenFromRequest(req)
  if (!token) throw new UnauthorizedError()
  const user = await authService.getUserFromToken(token)

  const urls = await bookmarkService.getUrls(user.id)
  return NextResponse.json({ urls })
})
