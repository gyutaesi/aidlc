import { type NextRequest, NextResponse } from 'next/server'
import { withErrorHandler } from '@/lib/api/with-error-handler'
import { metadataService } from '@/lib/services/metadata.service'

export const GET = withErrorHandler(async (req: NextRequest) => {
  const url = req.nextUrl.searchParams.get('url')
  if (!url) {
    return NextResponse.json({ error: 'url parameter required' }, { status: 400 })
  }

  const metadata = await metadataService.fetchMetadata(url)
  if (!metadata) {
    return NextResponse.json({ title: null, description: null }, { status: 200 })
  }

  return NextResponse.json(metadata)
})
