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
        className="hidden w-56 flex-shrink-0 flex-col border-r md:flex"
        style={{
          background: '#EDEDE9',
          borderRight: '1px solid #D6CCC2',
        }}
        data-testid="sidebar"
      >
        <div
          className="flex h-14 items-center border-b px-4"
          style={{ borderBottom: '1px solid #D6CCC2' }}
        >
          <Link href={`/${locale}/inbox`} className="gradient-text text-lg font-bold">
            moaring
          </Link>
        </div>

        <nav className="flex-1 space-y-1 p-2">
          {navItems.map(({ href, icon: Icon, label }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-300',
                'hover:translate-x-1 hover:bg-[#D6CCC2]/40',
                pathname.startsWith(href) ? 'font-semibold text-[#3d2e24]' : 'text-[#6b5b50]'
              )}
              style={
                pathname.startsWith(href)
                  ? {
                      background: 'linear-gradient(135deg, #D5BDAF, #E3D5CA)',
                      boxShadow: '0 2px 8px rgba(213, 189, 175, 0.4)',
                    }
                  : undefined
              }
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
        <header
          className="flex h-14 items-center justify-between border-b px-4"
          style={{
            background: 'rgba(255, 255, 255, 0.6)',
            backdropFilter: 'blur(10px)',
            borderBottom: '1px solid #D6CCC2',
          }}
          data-testid="header"
        >
          <div className="md:hidden">
            <Link href={`/${locale}/inbox`} className="gradient-text text-lg font-bold">
              moaring
            </Link>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSearchModalOpen(true)}
              title="검색 (Cmd+K)"
              data-testid="header-search-button"
              className="transition-all hover:bg-[#D6CCC2]/50"
            >
              <Search className="h-4 w-4" />
            </Button>

            <Button
              size="sm"
              onClick={() => setSaveModalOpen(true)}
              data-testid="header-save-button"
              className="glow-button font-semibold"
            >
              <Plus className="mr-2 h-4 w-4" />
              {t('newBookmark')}
            </Button>
          </div>
        </header>

        {/* 콘텐츠 */}
        <main className="custom-scrollbar flex-1 overflow-auto" data-testid="main-content">
          {children}
        </main>

        {/* 모바일 하단 탭 바 */}
        <nav
          className="flex border-t md:hidden"
          style={{
            background: 'rgba(255, 255, 255, 0.7)',
            backdropFilter: 'blur(10px)',
            borderTop: '1px solid #D6CCC2',
          }}
          data-testid="mobile-nav"
        >
          {navItems.map(({ href, icon: Icon, label }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex flex-1 flex-col items-center gap-1 py-2 text-xs transition-all hover:bg-[#D6CCC2]/40',
                pathname.startsWith(href) ? 'font-semibold text-[#8b6b5a]' : 'text-[#6b5b50]'
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
