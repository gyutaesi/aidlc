import { type NextRequest, NextResponse } from 'next/server'
import { withErrorHandler } from '@/lib/api/with-error-handler'
import { getTokenFromRequest } from '@/lib/api/get-token'
import { authService } from '@/lib/services/auth.service'
import { tagService } from '@/lib/services/tag.service'
import { UnauthorizedError } from '@/lib/errors'

// GET /api/tags?prefix={prefix} — 태그 자동완성
export const GET = withErrorHandler(async (req: NextRequest) => {
  const token = getTokenFromRequest(req)
  if (!token) throw new UnauthorizedError()
  const user = await authService.getUserFromToken(token)

  const prefix = req.nextUrl.searchParams.get('prefix') ?? ''
  if (!prefix.trim()) return NextResponse.json([])

  const tags = await tagService.autocomplete(user.id, prefix)
  return NextResponse.json(tags)
})
