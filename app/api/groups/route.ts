import { type NextRequest, NextResponse } from 'next/server'
import { withErrorHandler } from '@/lib/api/with-error-handler'
import { getTokenFromRequest } from '@/lib/api/get-token'
import { authService } from '@/lib/services/auth.service'
import { groupService } from '@/lib/services/group.service'
import { UnauthorizedError } from '@/lib/errors'

// GET /api/groups — 그룹 목록 (Chrome Extension 팝업용)
export const GET = withErrorHandler(async (req: NextRequest) => {
  const token = getTokenFromRequest(req)
  if (!token) throw new UnauthorizedError()
  const user = await authService.getUserFromToken(token)

  const groups = await groupService.getAll(user.id)

  // Extension에서 필요한 필드만 반환 (id, name, emoji)
  return NextResponse.json(groups.map((g) => ({ id: g.id, name: g.name, emoji: g.emoji })))
})
