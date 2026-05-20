// AuthManager — Cognito 인증 전체 생명주기 관리
// PKCE 플로우 + chrome.storage.local 토큰 관리 + 선제적 갱신

import type { AuthState } from './types'
import { AuthError } from './errors'

const STORAGE_KEY = 'auth'
const PREEMPTIVE_REFRESH_THRESHOLD_MS = 60_000 // 만료 60초 전 선제적 갱신

// 환경변수에서 Cognito 설정 로드
const COGNITO_DOMAIN = import.meta.env.VITE_COGNITO_DOMAIN
const COGNITO_CLIENT_ID = import.meta.env.VITE_COGNITO_CLIENT_ID
const COGNITO_REGION = import.meta.env.VITE_COGNITO_REGION
const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

// ─────────────────────────────────────────────────────────
// Mock 로그인 (VITE_USE_MOCK=true일 때 사용)
// ─────────────────────────────────────────────────────────

const MOCK_AUTH_STATE: AuthState = {
  accessToken: 'mock-access-token',
  refreshToken: 'mock-refresh-token',
  idToken: 'mock-id-token',
  expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24시간 유효
  userId: 'mock-user-id',
  email: 'demo@moaring.com',
}

// ─────────────────────────────────────────────────────────
// PKCE 유틸리티
// ─────────────────────────────────────────────────────────

function base64UrlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function generateCodeVerifier(): string {
  // RFC 7636: 43-128자 길이의 랜덤 문자열
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return base64UrlEncode(array.buffer)
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(verifier)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return base64UrlEncode(hash)
}

// ─────────────────────────────────────────────────────────
// Cognito URL 빌더
// ─────────────────────────────────────────────────────────

function getRedirectUri(): string {
  return chrome.identity.getRedirectURL()
}

function buildCognitoAuthUrl(codeChallenge: string): string {
  const params = new URLSearchParams({
    client_id: COGNITO_CLIENT_ID,
    response_type: 'code',
    scope: 'openid email profile',
    redirect_uri: getRedirectUri(),
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  })
  return `https://${COGNITO_DOMAIN}.auth.${COGNITO_REGION}.amazoncognito.com/oauth2/authorize?${params.toString()}`
}

function getTokenEndpoint(): string {
  return `https://${COGNITO_DOMAIN}.auth.${COGNITO_REGION}.amazoncognito.com/oauth2/token`
}

// ─────────────────────────────────────────────────────────
// Token Endpoint 호출
// ─────────────────────────────────────────────────────────

interface CognitoTokenResponse {
  access_token: string
  refresh_token?: string
  id_token: string
  expires_in: number
  token_type: string
}

async function postTokenEndpoint(body: Record<string, string>): Promise<CognitoTokenResponse> {
  const response = await fetch(getTokenEndpoint(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body).toString(),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new AuthError(`Cognito token endpoint error: ${response.status} ${text}`)
  }

  return response.json()
}

// ─────────────────────────────────────────────────────────
// JWT 디코딩 (id_token에서 email/sub 추출용 — 검증은 서버가 함)
// ─────────────────────────────────────────────────────────

interface IdTokenClaims {
  sub: string
  email: string
  [key: string]: unknown
}

function decodeIdToken(idToken: string): IdTokenClaims {
  const [, payload] = idToken.split('.')
  const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
  return JSON.parse(decoded) as IdTokenClaims
}

// ─────────────────────────────────────────────────────────
// chrome.storage.local 헬퍼
// ─────────────────────────────────────────────────────────

async function readAuthState(): Promise<AuthState | null> {
  const result = await chrome.storage.local.get(STORAGE_KEY)
  return (result[STORAGE_KEY] as AuthState) || null
}

async function writeAuthState(state: AuthState): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: state })
}

async function clearAuthState(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEY)
}

// ─────────────────────────────────────────────────────────
// AuthManager 공개 API
// ─────────────────────────────────────────────────────────

export const AuthManager = {
  /**
   * Cognito Hosted UI를 통한 로그인 (PKCE 플로우)
   */
  async login(): Promise<AuthState> {
    // Mock 모드: Cognito 건너뛰고 즉시 가짜 토큰 반환
    if (USE_MOCK) {
      // eslint-disable-next-line no-console
      console.log('[AuthManager] Mock login (VITE_USE_MOCK=true)')
      await writeAuthState(MOCK_AUTH_STATE)
      return MOCK_AUTH_STATE
    }

    if (!COGNITO_DOMAIN || !COGNITO_CLIENT_ID) {
      throw new AuthError('Cognito 설정이 누락되었습니다')
    }

    // 1. PKCE 파라미터 생성
    const codeVerifier = generateCodeVerifier()
    const codeChallenge = await generateCodeChallenge(codeVerifier)

    // 2. Cognito Hosted UI 호출
    const authUrl = buildCognitoAuthUrl(codeChallenge)
    const redirectUrl = await chrome.identity.launchWebAuthFlow({
      url: authUrl,
      interactive: true,
    })

    if (!redirectUrl) {
      throw new AuthError('로그인이 취소되었습니다')
    }

    // 3. redirect URL에서 auth_code 추출
    const url = new URL(redirectUrl)
    const code = url.searchParams.get('code')
    if (!code) {
      throw new AuthError('Authorization Code를 받지 못했습니다')
    }

    // 4. Token Endpoint에서 토큰 교환
    const tokens = await postTokenEndpoint({
      grant_type: 'authorization_code',
      client_id: COGNITO_CLIENT_ID,
      code,
      code_verifier: codeVerifier,
      redirect_uri: getRedirectUri(),
    })

    if (!tokens.refresh_token) {
      throw new AuthError('Refresh Token을 받지 못했습니다')
    }

    // 5. id_token에서 사용자 정보 추출
    const claims = decodeIdToken(tokens.id_token)

    const authState: AuthState = {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      idToken: tokens.id_token,
      expiresAt: Date.now() + tokens.expires_in * 1000,
      userId: claims.sub,
      email: claims.email,
    }

    await writeAuthState(authState)
    return authState
  },

  /**
   * 로그아웃 — chrome.storage.local 정리
   */
  async logout(): Promise<void> {
    await clearAuthState()
    // savedUrlCache도 함께 삭제
    await chrome.storage.local.remove('savedUrlCache')
  },

  /**
   * 현재 저장된 인증 상태 조회 (만료 여부 무관)
   */
  async getAuthState(): Promise<AuthState | null> {
    return readAuthState()
  },

  /**
   * 유효한 Access Token 반환 (만료 60초 전 선제적 갱신)
   */
  async getValidToken(): Promise<string | null> {
    const state = await readAuthState()
    if (!state) return null

    const remainingMs = state.expiresAt - Date.now()
    if (remainingMs > PREEMPTIVE_REFRESH_THRESHOLD_MS) {
      return state.accessToken
    }

    // 선제적 갱신 시도
    return this.refreshToken()
  },

  /**
   * Refresh Token으로 Access Token 갱신
   */
  async refreshToken(): Promise<string | null> {
    // Mock 모드: 만료 시간만 연장하여 반환
    if (USE_MOCK) {
      const refreshed: AuthState = {
        ...MOCK_AUTH_STATE,
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      }
      await writeAuthState(refreshed)
      return refreshed.accessToken
    }

    const state = await readAuthState()
    if (!state?.refreshToken) {
      await clearAuthState()
      return null
    }

    try {
      const tokens = await postTokenEndpoint({
        grant_type: 'refresh_token',
        client_id: COGNITO_CLIENT_ID,
        refresh_token: state.refreshToken,
      })

      const updated: AuthState = {
        ...state,
        accessToken: tokens.access_token,
        idToken: tokens.id_token,
        expiresAt: Date.now() + tokens.expires_in * 1000,
        // refresh_token은 갱신 시 새로 받지 않으면 기존 것 유지
        refreshToken: tokens.refresh_token ?? state.refreshToken,
      }

      await writeAuthState(updated)
      return updated.accessToken
    } catch (error) {
      // 갱신 실패 → 로그아웃 처리
      // eslint-disable-next-line no-console
      console.error('[AuthManager] Token refresh failed:', error)
      await clearAuthState()
      return null
    }
  },
}
