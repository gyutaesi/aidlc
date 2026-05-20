import { type NextRequest, NextResponse } from 'next/server'
import { AppError } from '@/lib/errors'
import { logger } from '@/lib/logger'

// Next.js 15 Route Handler 타입
export type RouteContext = { params: Promise<Record<string, string>> }
export type RouteHandler = (req: NextRequest, ctx: RouteContext) => Promise<NextResponse>

export function withErrorHandler(handler: RouteHandler): RouteHandler {
  return async (req: NextRequest, ctx: RouteContext) => {
    try {
      return await handler(req, ctx)
    } catch (error) {
      if (!(error instanceof AppError) || error.statusCode >= 500) {
        logger.error('Unhandled error in route handler', {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
          path: req.nextUrl.pathname,
          method: req.method,
        })
      }

      if (error instanceof AppError) {
        return NextResponse.json({ error: error.message }, { status: error.statusCode })
      }

      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
  }
}
