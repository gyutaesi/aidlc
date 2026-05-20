import { useState } from 'react'
import { AuthManager } from '../../auth-manager'
import { useAppStore } from '../../store/useAppStore'

export function Header() {
  const authState = useAppStore((s) => s.authState)
  const setAuthState = useAppStore((s) => s.setAuthState)
  const [menuOpen, setMenuOpen] = useState(false)

  const handleLogout = async () => {
    await AuthManager.logout()
    setAuthState(null)
    setMenuOpen(false)
  }

  return (
    <header
      className="flex items-center justify-between px-4 py-3 border-b border-gray-200"
      data-testid="header"
    >
      <div className="text-base font-bold text-moaring-primary">moaring</div>

      <div className="relative">
        <button
          type="button"
          onClick={() => setMenuOpen((prev) => !prev)}
          className="p-1 hover:bg-gray-100 rounded transition-colors"
          aria-label="설정"
          data-testid="header-settings-button"
        >
          <SettingsIcon />
        </button>

        {menuOpen && (
          <>
            {/* 외부 클릭 감지 오버레이 */}
            <div
              className="fixed inset-0 z-10"
              onClick={() => setMenuOpen(false)}
            />
            <div
              className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-20"
              data-testid="header-settings-menu"
            >
              <div className="px-3 py-2 text-xs text-gray-500 border-b border-gray-100 truncate">
                {authState?.email ?? ''}
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 text-gray-700"
                data-testid="header-logout-button"
              >
                로그아웃
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  )
}

function SettingsIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}
