import { type NextRequest, NextResponse } from 'next/server'
import { withErrorHandler } from '@/lib/api/with-error-handler'
import { getTokenFromRequest } from '@/lib/api/get-token'
import { authService } from '@/lib/services/auth.service'
import { collectionService } from '@/lib/services/collection.service'
import { UnauthorizedError } from '@/lib/errors'

// GET /api/collections/slug-check?slug={slug}&excludeId={id}
export const GET = withErrorHandler(async (req: NextRequest) => {
  const token = getTokenFromRequest(req)
  if (!token) throw new UnauthorizedError()
  await authService.getUserFromToken(token) // 인증 확인

  const slug = req.nextUrl.searchParams.get('slug') ?? ''
  const excludeId = req.nextUrl.searchParams.get('excludeId') ?? undefined

  if (!slug.trim()) return NextResponse.json({ available: false })

  const available = await collectionService.isSlugAvailable(slug, excludeId)
  return NextResponse.json({ available })
})
