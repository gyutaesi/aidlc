import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./i18n.ts')

const nextConfig: NextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.cloudfront.net' },
      // 네이버
      { protocol: 'https', hostname: '*.pstatic.net' },
      { protocol: 'http', hostname: '*.pstatic.net' },
      // 카카오
      { protocol: 'https', hostname: '*.kakaocdn.net' },
      // 유튜브
      { protocol: 'https', hostname: '*.ytimg.com' },
      { protocol: 'https', hostname: 'i.ytimg.com' },
      // 깃허브
      { protocol: 'https', hostname: '*.githubusercontent.com' },
      { protocol: 'https', hostname: 'github.com' },
      // 구글
      { protocol: 'https', hostname: 'www.google.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      // 오픈그래프 썸네일 일반 호스트들
      { protocol: 'https', hostname: '**' },
      { protocol: 'http', hostname: '**' },
    ],
  },
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000'],
    },
  },
  // Chrome Extension CORS 허용
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
        ],
      },
    ]
  },
}

export default withNextIntl(nextConfig)
