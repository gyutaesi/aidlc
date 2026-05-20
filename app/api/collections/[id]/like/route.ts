import { type NextRequest, NextResponse } from 'next/server'
import { withErrorHandler } from '@/lib/api/with-error-handler'
import { getTokenFromRequest } from '@/lib/api/get-token'
import { authService } from '@/lib/services/auth.service'
import { collectionStatsService } from '@/lib/services/collection-stats.service'
import { UnauthorizedError } from '@/lib/errors'

// POST /api/collections/[id]/like — 좋아요 토글 (로그인 사용자만)
export const POST = withErrorHandler(async (req: NextRequest, ctx) => {
  const token = getTokenFromRequest(req)
  if (!token) throw new UnauthorizedError('로그인이 필요합니다')
  const user = await authService.getUserFromToken(token)

  const { id: collectionId } = await ctx.params
  const result = await collectionStatsService.toggleLike(collectionId, user.id)

  return NextResponse.json(result)
})
