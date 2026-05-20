'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import { Inbox, FolderOpen, BookOpen, Settings, Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BookmarkSaveModal } from '@/components/features/bookmark/bookmark-save-modal'
import { SearchModal } from '@/components/features/search/search-modal'
import { cn } from '@/lib/utils'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations('nav')
  const locale = useLocale()
  const pathname = usePathname()
  const [saveModalOpen, setSaveModalOpen] = useState(false)
  const [searchModalOpen, setSearchModalOpen] = useState(false)

  const navItems = [
    { href: `/${locale}/inbox`, icon: Inbox, label: t('inbox') },
    { href: `/${locale}/groups`, icon: FolderOpen, label: t('groups') },
    { href: `/${locale}/collections`, icon: BookOpen, label: t('collections') },
    { href: `/${locale}/settings`, icon: Settings, label: t('settings') },
  ]

  return (
    <div className="flex h-screen overflow-hidden">
      {/* 사이드바 (데스크탑) */}
      <aside
        className="hidden w-56 flex-shrink-0 flex-col border-r bg-card md:flex"
        data-testid="sidebar"
      >
        <div className="flex h-14 items-center border-b px-4">
          <Link href={`/${locale}/inbox`} className="text-lg font-bold">
            moaring
          </Link>
        </div>

        <nav className="flex-1 space-y-1 p-2">
          {navItems.map(({ href, icon: Icon, label }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent',
                pathname.startsWith(href) && 'bg-accent font-medium'
              )}
              data-testid={`nav-${label}`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>
      </aside>

      {/* 메인 영역 */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* 헤더 */}
        <header className="flex h-14 items-center justify-between border-b px-4" data-testid="header">
          <div className="md:hidden">
            <Link href={`/${locale}/inbox`} className="text-lg font-bold">
              moaring
            </Link>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSearchModalOpen(true)}
              title="검색 (Cmd+K)"
              data-testid="header-search-button"
            >
              <Search className="h-4 w-4" />
            </Button>

            <Button
              size="sm"
              onClick={() => setSaveModalOpen(true)}
              data-testid="header-save-button"
            >
              <Plus className="mr-2 h-4 w-4" />
              {t('newBookmark')}
            </Button>
          </div>
        </header>

        {/* 콘텐츠 */}
        <main className="flex-1 overflow-auto" data-testid="main-content">
          {children}
        </main>

        {/* 모바일 하단 탭 바 */}
        <nav className="flex border-t bg-card md:hidden" data-testid="mobile-nav">
          {navItems.map(({ href, icon: Icon, label }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex flex-1 flex-col items-center gap-1 py-2 text-xs transition-colors hover:bg-accent',
                pathname.startsWith(href) && 'text-primary'
              )}
              data-testid={`mobile-nav-${label}`}
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          ))}
        </nav>
      </div>

      {/* 모달 */}
      <BookmarkSaveModal open={saveModalOpen} onOpenChange={setSaveModalOpen} />
      <SearchModal open={searchModalOpen} onOpenChange={setSearchModalOpen} />
    </div>
  )
}
