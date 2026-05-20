import { type NextRequest, NextResponse } from 'next/server'
import { withErrorHandler } from '@/lib/api/with-error-handler'
import { getTokenFromRequest } from '@/lib/api/get-token'
import { authService } from '@/lib/services/auth.service'
import { storageService } from '@/lib/services/storage.service'
import { UnauthorizedError, ValidationError } from '@/lib/errors'

// POST /api/upload/presigned
export const POST = withErrorHandler(async (req: NextRequest) => {
  const token = getTokenFromRequest(req)
  if (!token) throw new UnauthorizedError()
  const user = await authService.getUserFromToken(token)

  const body = await req.json()
  const { type, filename } = body

  if (!type || !['collection-image', 'thumbnail'].includes(type)) {
    throw new ValidationError('type은 collection-image 또는 thumbnail이어야 합니다')
  }
  if (!filename || typeof filename !== 'string') {
    throw new ValidationError('filename이 필요합니다')
  }

  const result = await storageService.getUploadUrl(user.id, type, filename)
  return NextResponse.json(result)
})
