import { getTranslations } from 'next-intl/server'
import { cookies } from 'next/headers'
import { authService } from '@/lib/services/auth.service'
import { bookmarkService } from '@/lib/services/bookmark.service'
import { InboxClient } from './inbox-client'

export const dynamic = 'force-dynamic'

export default async function InboxPage() {
  const t = await getTranslations('inbox')
  const cookieStore = await cookies()
  const token = cookieStore.get('access_token')?.value

  if (!token) return null

  const user = await authService.getUserFromToken(token)
  const result = await bookmarkService.getInbox(user.id, {
    sort: 'newest',
    filter: 'all',
    page: 1,
    limit: 20,
  })

  return (
    <div className="p-6" data-testid="inbox-page">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <span className="text-sm text-muted-foreground">{result.total}개</span>
      </div>
      <InboxClient initialData={result} />
    </div>
  )
}
