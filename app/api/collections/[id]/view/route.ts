import { type NextRequest, NextResponse } from 'next/server'
import { withErrorHandler } from '@/lib/api/with-error-handler'
import { collectionStatsService } from '@/lib/services/collection-stats.service'

// POST /api/collections/[id]/view — 조회수 증가 (비로그인 가능)
export const POST = withErrorHandler(async (_req: NextRequest, ctx) => {
  const collectionId = ctx.params.id
  await collectionStatsService.incrementViewCount(collectionId)
  return NextResponse.json({ ok: true })
})
