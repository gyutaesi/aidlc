'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { authService } from '@/lib/services/auth.service'
import {
  SignUpSchema,
  SignInSchema,
  VerifySchema,
  ChangePasswordSchema,
} from '@/lib/schemas/auth.schema'
import { logger } from '@/lib/logger'

export interface ActionResult {
  success: boolean
  error?: string
}

/**
 * 회원가입
 */
export async function signUpAction(formData: FormData): Promise<ActionResult> {
  const raw = {
    email: formData.get('email'),
    password: formData.get('password'),
    passwordConfirm: formData.get('passwordConfirm'),
  }

  const parsed = SignUpSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message }
  }

  try {
    await authService.signUp(parsed.data.email, parsed.data.password)
    return { success: true }
  } catch (error) {
    logger.error('SignUp failed', { error: error instanceof Error ? error.message : 'Unknown' })
    const message = error instanceof Error ? error.message : '회원가입에 실패했습니다'
    return { success: false, error: message }
  }
}

/**
 * 이메일 인증 코드 확인 + DB User 생성
 */
export async function confirmSignUpAction(formData: FormData): Promise<ActionResult> {
  const raw = {
    email: formData.get('email'),
    code: formData.get('code'),
  }

  const parsed = VerifySchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message }
  }

  try {
    await authService.confirmSignUp(parsed.data.email, parsed.data.code)

    // 임시 로그인으로 cognitoSub 획득 후 DB User 생성
    // (실제로는 로그인 후 토큰에서 sub 추출)
    return { success: true }
  } catch (error) {
    logger.error('ConfirmSignUp failed', {
      error: error instanceof Error ? error.message : 'Unknown',
    })
    return { success: false, error: '인증 코드가 올바르지 않습니다' }
  }
}

/**
 * 로그인 → HttpOnly Cookie에 토큰 저장
 */
export async function signInAction(formData: FormData): Promise<ActionResult> {
  const raw = {
    email: formData.get('email'),
    password: formData.get('password'),
  }

  const parsed = SignInSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message }
  }

  try {
    const tokens = await authService.signIn(parsed.data.email, parsed.data.password)

    // JWT payload에서 cognitoSub 추출 후 DB User 동기화
    const { jwtVerify, createRemoteJWKSet } = await import('jose')
    const JWKS = createRemoteJWKSet(
      new URL(
        `https://cognito-idp.${process.env.COGNITO_REGION}.amazonaws.com/${process.env.COGNITO_USER_POOL_ID}/.well-known/jwks.json`
      )
    )
    const { payload } = await jwtVerify(tokens.accessToken, JWKS)
    const cognitoSub = payload.sub as string
    const email = (payload.email as string) ?? parsed.data.email

    await authService.syncCognitoUser(cognitoSub, email)

    // HttpOnly Cookie에 토큰 저장
    const cookieStore = await cookies()
    cookieStore.set('access_token', tokens.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 3600, // 1시간
      path: '/',
    })
    cookieStore.set('refresh_token', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 2592000, // 30일
      path: '/',
    })

    return { success: true }
  } catch (error) {
    logger.error('SignIn failed', { error: error instanceof Error ? error.message : 'Unknown' })
    return { success: false, error: '이메일 또는 비밀번호가 올바르지 않습니다' }
  }
}

/**
 * 로그아웃
 */
export async function signOutAction(): Promise<void> {
  const cookieStore = await cookies()
  const accessToken = cookieStore.get('access_token')?.value

  if (accessToken) {
    try {
      await authService.signOut(accessToken)
    } catch (error) {
      logger.warn('SignOut Cognito call failed', {
        error: error instanceof Error ? error.message : 'Unknown',
      })
    }
  }

  cookieStore.delete('access_token')
  cookieStore.delete('refresh_token')

  redirect('/ko/login')
}

/**
 * 비밀번호 변경
 */
export async function changePasswordAction(formData: FormData): Promise<ActionResult> {
  const raw = {
    currentPassword: formData.get('currentPassword'),
    newPassword: formData.get('newPassword'),
    newPasswordConfirm: formData.get('newPasswordConfirm'),
  }

  const parsed = ChangePasswordSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message }
  }

  const cookieStore = await cookies()
  const accessToken = cookieStore.get('access_token')?.value
  if (!accessToken) return { success: false, error: '로그인이 필요합니다' }

  try {
    await authService.changePassword(
      accessToken,
      parsed.data.currentPassword,
      parsed.data.newPassword
    )
    return { success: true }
  } catch (error) {
    logger.error('ChangePassword failed', {
      error: error instanceof Error ? error.message : 'Unknown',
    })
    return { success: false, error: '비밀번호 변경에 실패했습니다' }
  }
}
