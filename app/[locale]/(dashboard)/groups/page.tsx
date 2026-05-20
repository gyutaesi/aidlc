import { getTranslations } from 'next-intl/server'
import { cookies } from 'next/headers'
import { authService } from '@/lib/services/auth.service'
import { groupService } from '@/lib/services/group.service'
import { GroupDashboardClient } from './groups-client'

export const dynamic = 'force-dynamic'

export default async function GroupsPage() {
  const t = await getTranslations('group')
  const cookieStore = await cookies()
  const token = cookieStore.get('access_token')?.value

  if (!token) return null

  const user = await authService.getUserFromToken(token)
  const groups = await groupService.getAll(user.id)

  return (
    <div className="flex h-full flex-col" data-testid="groups-page">
      <div className="flex items-center justify-between border-b px-6 py-4">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
      </div>
      <GroupDashboardClient initialGroups={groups} />
    </div>
  )
}
