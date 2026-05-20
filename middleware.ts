import createMiddleware from 'next-intl/middleware'
import { type NextRequest, NextResponse } from 'next/server'
import { jwtVerify, createRemoteJWKSet } from 'jose'
import { routing } from './lib/i18n/routing'

const intlMiddleware = createMiddleware(routing)

const IS_LOCAL_DEV = process.env.LOCAL_DEV_BYPASS_AUTH === 'true'

// JWKS 캐싱 — 프로덕션에서만 초기화
const JWKS = IS_LOCAL_DEV
  ? null
  : createRemoteJWKSet(
      new URL(
        `https://cognito-idp.${process.env.COGNITO_REGION ?? 'us-east-1'}.amazonaws.com/${process.env.COGNITO_USER_POOL_ID}/.well-known/jwks.json`
      )
    )

const PUBLIC_PATHS = ['/c/', '/api/health']
const AUTH_PATHS = ['/login', '/signup', '/verify']

async function verifyToken(token: string): Promise<boolean> {
  // 로컬 개발 모드: local-dev- 접두사 토큰 허용
  if (IS_LOCAL_DEV && token.startsWith('local-dev-')) {
    return true
  }
  if (!JWKS) return false
  try {
    await jwtVerify(token, JWKS, {
      issuer: `https://cognito-idp.${process.env.COGNITO_REGION ?? 'us-east-1'}.amazonaws.com/${process.env.COGNITO_USER_POOL_ID}`,
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
    const refreshToken = request.cookies.get('refresh_token')?.value
    if (!refreshToken) {
      const loginUrl = new URL(`/${routing.defaultLocale}/login`, request.url)
      return NextResponse.redirect(loginUrl)
    }

    const loginUrl = new URL(`/${routing.defaultLocale}/login`, request.url)
    loginUrl.searchParams.set('refresh', '1')
    return NextResponse.redirect(loginUrl)
  }

  return intlMiddleware(request)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
