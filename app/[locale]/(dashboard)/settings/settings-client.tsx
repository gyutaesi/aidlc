'use client'

import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { signOutAction } from '@/lib/actions/auth.actions'

interface SettingsClientProps {
  userEmail: string
}

export function SettingsClient({ userEmail }: SettingsClientProps) {
  const t = useTranslations('settings')

  async function handleExport(format: 'json' | 'html') {
    window.location.href = `/api/export?format=${format}`
  }

  return (
    <div className="space-y-8">
      {/* 계정 정보 */}
      <section data-testid="settings-account">
        <h2 className="mb-4 text-lg font-semibold">{t('account')}</h2>
        <div className="rounded-lg border p-4">
          <p className="text-muted-foreground text-sm">{t('email')}</p>
          <p className="font-medium" data-testid="settings-email">
            {userEmail}
          </p>
        </div>
      </section>

      {/* 데이터 내보내기 */}
      <section data-testid="settings-export">
        <h2 className="mb-4 text-lg font-semibold">{t('export')}</h2>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => handleExport('json')}
            data-testid="export-json-button"
          >
            {t('exportJson')}
          </Button>
          <Button
            variant="outline"
            onClick={() => handleExport('html')}
            data-testid="export-html-button"
          >
            {t('exportHtml')}
          </Button>
        </div>
      </section>

      {/* 로그아웃 */}
      <section>
        <form action={signOutAction}>
          <Button type="submit" variant="destructive" data-testid="logout-button">
            {t('logout')}
          </Button>
        </form>
      </section>
    </div>
  )
}
