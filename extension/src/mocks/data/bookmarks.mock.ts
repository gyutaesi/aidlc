import type { RecentBookmark } from '../../types'

export const mockRecentBookmarks: RecentBookmark[] = [
  {
    id: 'b1',
    url: 'https://nextjs.org/docs',
    title: 'Next.js Documentation',
    thumbnailUrl: null,
    savedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5분 전
  },
  {
    id: 'b2',
    url: 'https://react.dev/learn',
    title: 'React 공식 문서',
    thumbnailUrl: null,
    savedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30분 전
  },
  {
    id: 'b3',
    url: 'https://www.typescriptlang.org/docs/',
    title: 'TypeScript Handbook',
    thumbnailUrl: null,
    savedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2시간 전
  },
  {
    id: 'b4',
    url: 'https://tailwindcss.com/docs',
    title: 'Tailwind CSS - Rapidly build modern websites',
    thumbnailUrl: null,
    savedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1일 전
  },
  {
    id: 'b5',
    url: 'https://vitejs.dev/guide/',
    title: 'Vite Guide',
    thumbnailUrl: null,
    savedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3일 전
  },
]
