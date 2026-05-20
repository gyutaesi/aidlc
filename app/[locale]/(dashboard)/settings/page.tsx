import { getTranslations } from 'next-intl/server'
import { cookies } from 'next/headers'
import { authService } from '@/lib/services/auth.service'
import { SettingsClient } from './settings-client'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const t = await getTranslations('settings')
  const cookieStore = await cookies()
  const token = cookieStore.get('access_token')?.value

  if (!token) return null

  const user = await authService.getUserFromToken(token)

  return (
    <div className="mx-auto max-w-lg p-6" data-testid="settings-page">
      <h1 className="mb-6 text-2xl font-bold">{t('title')}</h1>
      <SettingsClient userEmail={user.email} />
    </div>
  )
}
