import { type NextRequest, NextResponse } from 'next/server'
import { withErrorHandler } from '@/lib/api/with-error-handler'
import { getTokenFromRequest } from '@/lib/api/get-token'
import { authService } from '@/lib/services/auth.service'
import { bookmarkService } from '@/lib/services/bookmark.service'
import { UnauthorizedError, ValidationError } from '@/lib/errors'

// GET /api/export?format=json|html
export const GET = withErrorHandler(async (req: NextRequest) => {
  const token = getTokenFromRequest(req)
  if (!token) throw new UnauthorizedError()
  const user = await authService.getUserFromToken(token)

  const format = req.nextUrl.searchParams.get('format') ?? 'json'

  if (format === 'json') {
    const data = await bookmarkService.exportToJson(user.id)
    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="moaring-export-${Date.now()}.json"`,
      },
    })
  }

  if (format === 'html') {
    const html = await bookmarkService.exportToHtml(user.id)
    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `attachment; filename="moaring-bookmarks-${Date.now()}.html"`,
      },
    })
  }

  throw new ValidationError('format은 json 또는 html이어야 합니다')
})
