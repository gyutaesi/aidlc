import createMiddleware from 'next-intl/middleware'
import { type NextRequest, NextResponse } from 'next/server'
import { jwtVerify, createRemoteJWKSet } from 'jose'
import { routing } from './lib/i18n/routing'

const intlMiddleware = createMiddleware(routing)

// JWKS 캐싱 — 모듈 레벨에서 한 번만 초기화
const JWKS = createRemoteJWKSet(
  new URL(
    `https://cognito-idp.us-east-1.amazonaws.com/${process.env.COGNITO_USER_POOL_ID}/.well-known/jwks.json`
  )
)

const PUBLIC_PATHS = ['/c/', '/api/health']
const AUTH_PATHS = ['/login', '/signup', '/verify']

async function verifyToken(token: string): Promise<boolean> {
  try {
    await jwtVerify(token, JWKS, {
      issuer: `https://cognito-idp.us-east-1.amazonaws.com/${process.env.COGNITO_USER_POOL_ID}`,
    })
    return true
  } catch {
    return false
  }
}

function getTokenFromRequest(request: NextRequest): string | null {
  return (
    request.cookies.get('access_token')?.value ??
    request.headers.get('Authorization')?.replace('Bearer ', '') ??
    null
  )
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 공개 경로 — 인증/로케일 처리 없이 통과
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // API 경로 인증 처리
  if (pathname.startsWith('/api/')) {
    const token = getTokenFromRequest(request)
    if (!token || !(await verifyToken(token))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.next()
  }

  // 로케일 prefix 제거 후 경로 추출 (예: /ko/login → /login)
  const pathnameWithoutLocale = pathname.replace(/^\/(ko|en)/, '') || '/'

  // 인증 페이지는 로케일 처리만
  if (AUTH_PATHS.some((p) => pathnameWithoutLocale.startsWith(p))) {
    return intlMiddleware(request)
  }

  // 보호된 경로 — JWT 검증
  const token = getTokenFromRequest(request)

  if (!token) {
    const loginUrl = new URL(`/${routing.defaultLocale}/login`, request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  const isValid = await verifyToken(token)

  if (!isValid) {
    // Refresh Token으로 갱신 시도
    const refreshToken = request.cookies.get('refresh_token')?.value
    if (!refreshToken) {
      const loginUrl = new URL(`/${routing.defaultLocale}/login`, request.url)
      return NextResponse.redirect(loginUrl)
    }

    // Refresh Token 갱신은 Server Action에서 처리
    // Middleware에서는 만료된 토큰으로 로그인 페이지로 리다이렉트
    const loginUrl = new URL(`/${routing.defaultLocale}/login`, request.url)
    loginUrl.searchParams.set('refresh', '1')
    return NextResponse.redirect(loginUrl)
  }

  return intlMiddleware(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
