import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const USER_ID = 'cmpdphzhq00008fcd14uhd71s'

async function main() {
  // Get existing bookmarks
  const bookmarks = await prisma.bookmark.findMany({ where: { userId: USER_ID } })
  console.log(`Found ${bookmarks.length} existing bookmarks`)

  // Create Groups
  const groups = await Promise.all([
    prisma.group.create({
      data: {
        userId: USER_ID,
        name: '프론트엔드 개발',
        emoji: '⚛️',
        position: 0,
      },
    }),
    prisma.group.create({
      data: {
        userId: USER_ID,
        name: '백엔드 & 인프라',
        emoji: '🛠️',
        position: 1,
      },
    }),
    prisma.group.create({
      data: {
        userId: USER_ID,
        name: '디자인 참고',
        emoji: '🎨',
        position: 2,
      },
    }),
    prisma.group.create({
      data: {
        userId: USER_ID,
        name: '나중에 읽기',
        emoji: '📖',
        position: 3,
      },
    }),
  ])

  console.log(`Created ${groups.length} groups`)

  // Assign bookmarks to groups
  const frontendGroup = groups[0]
  const backendGroup = groups[1]

  // Find relevant bookmarks by title keywords
  const reactBookmark = bookmarks.find((b) => b.title.includes('React'))
  const nextBookmark = bookmarks.find((b) => b.title.includes('Next.js'))
  const tailwindBookmark = bookmarks.find((b) => b.title.includes('Tailwind'))
  const tsBookmark = bookmarks.find((b) => b.title.includes('TypeScript'))
  const prismaBookmark = bookmarks.find((b) => b.title.includes('Prisma'))
  const vercelBookmark = bookmarks.find((b) => b.title.includes('Vercel'))
  const githubBookmark = bookmarks.find((b) => b.title.includes('GitHub'))

  const frontendBookmarks = [reactBookmark, nextBookmark, tailwindBookmark, tsBookmark].filter(
    Boolean
  )
  const backendBookmarks = [prismaBookmark, vercelBookmark, githubBookmark].filter(Boolean)

  for (let i = 0; i < frontendBookmarks.length; i++) {
    await prisma.bookmarkGroup.create({
      data: {
        bookmarkId: frontendBookmarks[i]!.id,
        groupId: frontendGroup.id,
        position: i,
      },
    })
  }

  for (let i = 0; i < backendBookmarks.length; i++) {
    await prisma.bookmarkGroup.create({
      data: {
        bookmarkId: backendBookmarks[i]!.id,
        groupId: backendGroup.id,
        position: i,
      },
    })
  }

  console.log('Assigned bookmarks to groups')

  // Create Collections with blocks
  const collections = await Promise.all([
    prisma.collection.create({
      data: {
        userId: USER_ID,
        name: 'React 개발 가이드',
        emoji: '⚛️',
        description: 'React 생태계의 핵심 라이브러리와 패턴을 정리한 가이드',
        slug: 'react-dev-guide',
        isPublic: true,
        template: 'guide',
        viewCount: 42,
        position: 0,
        blocks: JSON.stringify([
          {
            id: 'blk_1',
            type: 'text',
            position: 0,
            content: {
              markdown:
                '## React 핵심 개념\n\nReact 19의 새로운 기능과 함께 프론트엔드 개발 생산성을 높여보세요.',
            },
          },
          {
            id: 'blk_2',
            type: 'link',
            position: 1,
            content: {
              url: 'https://react.dev',
              title: 'React 공식 문서',
              description: 'React의 공식 문서 - 컴포넌트 기반 UI 개발',
              tags: ['React', '공식문서'],
            },
          },
          {
            id: 'blk_3',
            type: 'link',
            position: 2,
            content: {
              url: 'https://nextjs.org/docs',
              title: 'Next.js 문서',
              description: 'App Router, Server Components, Server Actions 가이드',
              tags: ['Next.js', 'SSR'],
            },
          },
          {
            id: 'blk_4',
            type: 'text',
            position: 3,
            content: {
              markdown:
                '### 상태 관리\n\n- **Zustand** - 가볍고 직관적인 상태 관리\n- **TanStack Query** - 서버 상태 관리의 표준\n- **Jotai** - 원자적 상태 관리',
            },
          },
          {
            id: 'blk_5',
            type: 'link',
            position: 4,
            content: {
              url: 'https://tanstack.com/query',
              title: 'TanStack Query',
              description: '강력한 비동기 데이터 관리 라이브러리',
              tags: ['상태관리', 'API'],
            },
          },
        ]),
      },
    }),
    prisma.collection.create({
      data: {
        userId: USER_ID,
        name: '풀스택 개발 툴킷',
        emoji: '🧰',
        description: '2024년 풀스택 개발에 필요한 도구 모음',
        slug: 'fullstack-toolkit',
        isPublic: true,
        template: 'guide',
        viewCount: 28,
        position: 1,
        blocks: JSON.stringify([
          {
            id: 'blk_6',
            type: 'text',
            position: 0,
            content: {
              markdown:
                '## 풀스택 개발 도구\n\n프론트엔드부터 배포까지, 필수 도구를 한눈에 정리합니다.',
            },
          },
          {
            id: 'blk_7',
            type: 'link',
            position: 1,
            content: {
              url: 'https://www.typescriptlang.org',
              title: 'TypeScript',
              description: 'JavaScript의 타입 안전한 슈퍼셋',
              tags: ['TypeScript', '언어'],
            },
          },
          {
            id: 'blk_8',
            type: 'link',
            position: 2,
            content: {
              url: 'https://www.prisma.io',
              title: 'Prisma ORM',
              description: 'Node.js & TypeScript를 위한 차세대 ORM',
              tags: ['DB', 'ORM'],
            },
          },
          {
            id: 'blk_9',
            type: 'link',
            position: 3,
            content: {
              url: 'https://tailwindcss.com',
              title: 'Tailwind CSS',
              description: '유틸리티 퍼스트 CSS 프레임워크',
              tags: ['CSS', 'UI'],
            },
          },
          {
            id: 'blk_10',
            type: 'link',
            position: 4,
            content: {
              url: 'https://vercel.com',
              title: 'Vercel',
              description: '프론트엔드 배포 플랫폼',
              tags: ['배포', '호스팅'],
            },
          },
        ]),
      },
    }),
    prisma.collection.create({
      data: {
        userId: USER_ID,
        name: 'UI/UX 디자인 리소스',
        emoji: '🎨',
        description: '디자인 영감과 도구 모음',
        slug: 'ui-ux-resources',
        isPublic: false,
        template: 'guide',
        viewCount: 0,
        position: 2,
        blocks: JSON.stringify([
          {
            id: 'blk_11',
            type: 'text',
            position: 0,
            content: {
              markdown: '## 디자인 리소스\n\n좋은 UI/UX를 만들기 위한 참고 자료들입니다.',
            },
          },
          {
            id: 'blk_12',
            type: 'link',
            position: 1,
            content: {
              url: 'https://dribbble.com',
              title: 'Dribbble',
              description: '디자이너 커뮤니티 & 포트폴리오',
              tags: ['디자인', '영감'],
            },
          },
          {
            id: 'blk_13',
            type: 'link',
            position: 2,
            content: {
              url: 'https://ui.shadcn.com',
              title: 'shadcn/ui',
              description: 'Radix + Tailwind 기반 컴포넌트 라이브러리',
              tags: ['컴포넌트', 'UI'],
            },
          },
        ]),
      },
    }),
  ])

  console.log(`Created ${collections.length} collections`)

  // Add more bookmarks for richer screenshot
  const newBookmarks = await Promise.all([
    prisma.bookmark.create({
      data: {
        userId: USER_ID,
        url: 'https://ui.shadcn.com',
        title: 'shadcn/ui - Beautiful components built with Radix UI and Tailwind CSS',
        description: 'Accessible component library for React',
        thumbnailUrl: 'https://ui.shadcn.com/og.png',
        isRead: true,
      },
    }),
    prisma.bookmark.create({
      data: {
        userId: USER_ID,
        url: 'https://tanstack.com/query/latest',
        title: 'TanStack Query - Powerful data synchronization for web apps',
        description: 'Async state management for TS/JS, React, Vue, Solid',
        isRead: false,
      },
    }),
    prisma.bookmark.create({
      data: {
        userId: USER_ID,
        url: 'https://zustand-demo.pmnd.rs/',
        title: 'Zustand - Bear necessities for state management',
        description: 'Small, fast, scalable bearbones state management',
        isRead: false,
        memo: '프로젝트에 적용 검토 중',
      },
    }),
  ])

  // Add tags for new bookmarks
  const uiTag = await prisma.tag.create({ data: { userId: USER_ID, name: 'UI' } })
  const stateTag = await prisma.tag.create({ data: { userId: USER_ID, name: '상태관리' } })

  await prisma.bookmarkTag.create({ data: { bookmarkId: newBookmarks[0].id, tagId: uiTag.id } })
  await prisma.bookmarkTag.create({ data: { bookmarkId: newBookmarks[1].id, tagId: stateTag.id } })
  await prisma.bookmarkTag.create({ data: { bookmarkId: newBookmarks[2].id, tagId: stateTag.id } })

  // Assign new bookmarks to design group
  await prisma.bookmarkGroup.create({
    data: { bookmarkId: newBookmarks[0].id, groupId: groups[2].id, position: 0 },
  })

  console.log('Added additional bookmarks with tags')
  console.log('Done! Seed data created successfully.')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
