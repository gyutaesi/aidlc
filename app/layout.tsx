import type { Metadata } from 'next'
import { ToastProvider } from '@/components/ui/toast-provider'
import './globals.css'

export const metadata: Metadata = {
  title: 'moaring',
  description: '링크를 저장하고, 컬렉션으로 만들어 공유하세요',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        {children}
        <ToastProvider />
      </body>
    </html>
  )
}
