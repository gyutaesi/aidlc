import { type NextRequest, NextResponse } from 'next/server'
import { withErrorHandler } from '@/lib/api/with-error-handler'
import { getTokenFromRequest } from '@/lib/api/get-token'
import { authService } from '@/lib/services/auth.service'
import { searchService } from '@/lib/services/search.service'
import { UnauthorizedError, ValidationError } from '@/lib/errors'

// GET /api/search?q={query}
export const GET = withErrorHandler(async (req: NextRequest) => {
  const token = getTokenFromRequest(req)
  if (!token) throw new UnauthorizedError()
  const user = await authService.getUserFromToken(token)

  const query = req.nextUrl.searchParams.get('q') ?? ''
  if (!query.trim()) return NextResponse.json([])
  if (query.length > 100) throw new ValidationError('검색어는 100자 이하여야 합니다')

  const results = await searchService.search(user.id, query)
  return NextResponse.json(results)
})
