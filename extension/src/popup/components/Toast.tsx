import { useAppStore } from '../../store/useAppStore'

export function Toast() {
  const toast = useAppStore((s) => s.toast)

  if (!toast) return null

  const colorClass =
    toast.type === 'error'
      ? 'bg-red-500'
      : toast.type === 'success'
        ? 'bg-green-500'
        : 'bg-gray-700'

  return (
    <div
      role="alert"
      className={`fixed bottom-3 left-3 right-3 ${colorClass} text-white text-sm px-3 py-2 rounded-md shadow-lg z-50`}
      data-testid="toast"
    >
      {toast.message}
    </div>
  )
}
