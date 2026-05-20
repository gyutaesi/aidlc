import type { ActiveTab } from '../../types'

interface TabBarProps {
  activeTab: ActiveTab
  onTabChange: (tab: ActiveTab) => void
}

const TABS: { key: ActiveTab; label: string }[] = [
  { key: 'save', label: '저장' },
  { key: 'recent', label: '최근' },
  { key: 'recommend', label: '추천' },
]

export function TabBar({ activeTab, onTabChange }: TabBarProps) {
  return (
    <nav
      className="flex border-b border-gray-200"
      role="tablist"
      data-testid="tab-bar"
    >
      {TABS.map((tab) => {
        const isActive = activeTab === tab.key
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onTabChange(tab.key)}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
              isActive
                ? 'text-moaring-primary border-b-2 border-moaring-primary'
                : 'text-gray-600 hover:text-gray-900'
            }`}
            data-testid={`tab-bar-${tab.key}`}
          >
            {tab.label}
          </button>
        )
      })}
    </nav>
  )
}
