// AppStore — 전역 상태 관리 (Zustand)
// 컴포넌트 간 공유 상태와 토스트 알림 담당

import { create } from 'zustand'
import type { AuthState, Group, Toast, ToastType } from '../types'
import { SavedUrlCache } from '../saved-url-cache'

const TOAST_DURATION_MS = 3_000

interface AppStore {
  // 인증 상태
  authState: AuthState | null
  setAuthState: (state: AuthState | null) => void

  // URL 캐시 (추천 필터링 + 중복 감지)
  savedUrls: string[]
  setSavedUrls: (urls: string[]) => void
  invalidateSavedUrls: () => Promise<void>

  // 그룹 목록 (저장 탭 드롭다운)
  groups: Group[]
  setGroups: (groups: Group[]) => void

  // 토스트 알림 (3초 자동 소멸)
  toast: Toast | null
  showToast: (message: string, type: ToastType) => void
  clearToast: () => void
}

export const useAppStore = create<AppStore>((set, get) => ({
  // 인증
  authState: null,
  setAuthState: (state) => set({ authState: state }),

  // URL 캐시
  savedUrls: [],
  setSavedUrls: (urls) => set({ savedUrls: urls }),
  invalidateSavedUrls: async () => {
    set({ savedUrls: [] })
    await SavedUrlCache.invalidate()
  },

  // 그룹
  groups: [],
  setGroups: (groups) => set({ groups }),

  // 토스트
  toast: null,
  showToast: (message, type) => {
    set({ toast: { message, type } })
    setTimeout(() => {
      // 동일 메시지일 때만 소멸 (연속 토스트 방지)
      if (get().toast?.message === message) {
        set({ toast: null })
      }
    }, TOAST_DURATION_MS)
  },
  clearToast: () => set({ toast: null }),
}))
