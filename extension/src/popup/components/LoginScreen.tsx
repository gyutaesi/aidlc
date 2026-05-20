import { useState } from 'react'
import { AuthManager } from '../../auth-manager'
import { useAppStore } from '../../store/useAppStore'
import { getErrorMessage } from '../../errors'

export function LoginScreen() {
  const setAuthState = useAppStore((s) => s.setAuthState)
  const showToast = useAppStore((s) => s.showToast)
  const [isLoading, setIsLoading] = useState(false)

  const handleLogin = async () => {
    setIsLoading(true)
    try {
      const authState = await AuthManager.login()
      setAuthState(authState)
    } catch (error) {
      showToast(getErrorMessage(error), 'error')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div
      className="flex flex-col items-center justify-center px-6 py-10 gap-4"
      data-testid="login-screen"
    >
      <div className="text-2xl font-bold text-moaring-primary">moaring</div>
      <p className="text-sm text-gray-600 text-center">
        moaring에 로그인하여
        <br />
        북마크를 빠르게 저장하세요
      </p>
      <button
        type="button"
        onClick={handleLogin}
        disabled={isLoading}
        className="w-full bg-moaring-primary hover:bg-moaring-primary-hover text-white font-medium py-2 px-4 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        data-testid="login-screen-login-button"
      >
        {isLoading ? '로그인 중...' : '로그인'}
      </button>
    </div>
  )
}
