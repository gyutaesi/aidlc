import { useEffect, useState } from 'react'
import { AuthManager } from '../auth-manager'
import { apiClient } from '../api-client'
import { SavedUrlCache } from '../saved-url-cache'
import { useAppStore } from '../store/useAppStore'
import type { ActiveTab } from '../types'
import { getErrorMessage } from '../errors'
import { LoginScreen } from './components/LoginScreen'
import { Header } from './components/Header'
import { TabBar } from './components/TabBar'
import { Toast } from './components/Toast'
import { SavePage } from './SavePage'
import { RecentList } from './RecentList'
import { Recommend } from './Recommend'

function App() {
  const authState = useAppStore((s) => s.authState)
  const setAuthState = useAppStore((s) => s.setAuthState)
  const setSavedUrls = useAppStore((s) => s.setSavedUrls)
  const setGroups = useAppStore((s) => s.setGroups)
  const showToast = useAppStore((s) => s.showToast)

  const [isInitializing, setIsInitializing] = useState(true)
  const [activeTab, setActiveTab] = useState<ActiveTab>('save')
  const [currentTabUrl, setCurrentTabUrl] = useState('')
  const [currentTabTitle, setCurrentTabTitle] = useState('')

  // 초기화 — 인증 상태 확인 + 병렬 데이터 로드
  useEffect(() => {
    let cancelled = false

    const init = async () => {
      try {
        // 1. 인증 상태 확인
        const state = await AuthManager.getAuthState()
        if (cancelled) return

        if (!state) {
          setAuthState(null)
          setIsInitializing(false)
          return
        }
        setAuthState(state)

        // 2. 현재 탭 정보 조회 (chrome.tabs)
        const tabPromise = chrome.tabs
          .query({ active: true, currentWindow: true })
          .then((tabs) => {
            const tab = tabs[0]
            if (tab) {
              setCurrentTabUrl(tab.url ?? '')
              setCurrentTabTitle(tab.title ?? '')
            }
          })
          .catch(() => {
            // chrome.tabs 실패 — graceful: 빈 값 유지
          })

        // 3. 초기 API 데이터 병렬 로드 (Promise.allSettled)
        const cachedUrls = await SavedUrlCache.get()

        const [groupsResult, urlsResult] = await Promise.allSettled([
          apiClient.getGroups(),
          cachedUrls !== null
            ? Promise.resolve(cachedUrls)
            : apiClient
                .getSavedUrls()
                .then(async (urls) => {
                  await SavedUrlCache.set(urls)
                  return urls
                }),
        ])

        await tabPromise

        if (cancelled) return

        // groups
        if (groupsResult.status === 'fulfilled') {
          setGroups(groupsResult.value)
        } else {
          setGroups([])
          // eslint-disable-next-line no-console
          console.error('[App] getGroups failed:', groupsResult.reason)
        }

        // savedUrls
        if (urlsResult.status === 'fulfilled') {
          setSavedUrls(urlsResult.value)
        } else {
          setSavedUrls([])
          // eslint-disable-next-line no-console
          console.error('[App] getSavedUrls failed:', urlsResult.reason)
        }
      } catch (error) {
        if (!cancelled) {
          showToast(getErrorMessage(error), 'error')
        }
      } finally {
        if (!cancelled) {
          setIsInitializing(false)
        }
      }
    }

    init()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSelectRecommendedSite = (url: string, title: string) => {
    setCurrentTabUrl(url)
    setCurrentTabTitle(title)
    setActiveTab('save')
  }

  const handleSaveSuccess = () => {
    window.close()
  }

  // 초기화 중
  if (isInitializing) {
    return (
      <div
        className="flex items-center justify-center py-10 text-sm text-gray-500"
        data-testid="app-loading"
      >
        불러오는 중...
      </div>
    )
  }

  // 미로그인
  if (!authState) {
    return (
      <>
        <LoginScreen />
        <Toast />
      </>
    )
  }

  // 로그인 상태
  return (
    <>
      <Header />
      <TabBar activeTab={activeTab} onTabChange={setActiveTab} />

      <main data-testid={`tab-content-${activeTab}`}>
        {activeTab === 'save' && (
          <SavePage
            initialUrl={currentTabUrl}
            initialTitle={currentTabTitle}
            onSaveSuccess={handleSaveSuccess}
          />
        )}
        {activeTab === 'recent' && <RecentList />}
        {activeTab === 'recommend' && (
          <Recommend onSelectSite={handleSelectRecommendedSite} />
        )}
      </main>

      <Toast />
    </>
  )
}

export default App
