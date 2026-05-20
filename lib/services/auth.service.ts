import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  SignUpCommand,
  ConfirmSignUpCommand,
  GlobalSignOutCommand,
  ChangePasswordCommand,
  type AuthFlowType,
} from '@aws-sdk/client-cognito-identity-provider'
import { jwtVerify, createRemoteJWKSet } from 'jose'
import { prisma } from '@/lib/prisma'
import { env } from '@/lib/env'
import { NotFoundError, UnauthorizedError } from '@/lib/errors'
import { logger } from '@/lib/logger'
import type { User } from '@prisma/client'

const cognitoClient = new CognitoIdentityProviderClient({ region: env.COGNITO_REGION })

// JWKS 캐싱 — 모듈 레벨에서 한 번만 초기화
const JWKS = createRemoteJWKSet(
  new URL(
    `https://cognito-idp.${env.COGNITO_REGION}.amazonaws.com/${env.COGNITO_USER_POOL_ID}/.well-known/jwks.json`
  )
)

export interface AuthTokens {
  accessToken: string
  refreshToken: string
  idToken: string
}

export class AuthService {
  /**
   * JWT 검증 후 DB User 반환
   * Route Handler에서 사용 (Node.js Runtime)
   */
  async getUserFromToken(token: string): Promise<User> {
    try {
      const { payload } = await jwtVerify(token, JWKS, {
        issuer: `https://cognito-idp.${env.COGNITO_REGION}.amazonaws.com/${env.COGNITO_USER_POOL_ID}`,
      })

      const cognitoSub = payload.sub
      if (!cognitoSub) throw new UnauthorizedError('Invalid token: missing sub')

      const user = await prisma.user.findUnique({
        where: { cognitoSub },
      })

      if (!user) throw new NotFoundError('User')

      return user
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof UnauthorizedError) throw error
      logger.warn('JWT verification failed', {
        error: error instanceof Error ? error.message : 'Unknown',
      })
      throw new UnauthorizedError('Invalid or expired token')
    }
  }

  /**
   * Cognito 회원가입
   */
  async signUp(email: string, password: string): Promise<void> {
    await cognitoClient.send(
      new SignUpCommand({
        ClientId: env.COGNITO_CLIENT_ID,
        Username: email,
        Password: password,
        UserAttributes: [{ Name: 'email', Value: email }],
      })
    )
  }

  /**
   * 이메일 인증 코드 확인 + DB User 생성
   */
  async confirmSignUp(email: string, code: string): Promise<void> {
    await cognitoClient.send(
      new ConfirmSignUpCommand({
        ClientId: env.COGNITO_CLIENT_ID,
        Username: email,
        ConfirmationCode: code,
      })
    )
  }

  /**
   * 로그인 → 토큰 반환
   */
  async signIn(email: string, password: string): Promise<AuthTokens> {
    const response = await cognitoClient.send(
      new InitiateAuthCommand({
        AuthFlow: 'USER_PASSWORD_AUTH' as AuthFlowType,
        ClientId: env.COGNITO_CLIENT_ID,
        AuthParameters: {
          USERNAME: email,
          PASSWORD: password,
        },
      })
    )

    const result = response.AuthenticationResult
    if (!result?.AccessToken || !result.RefreshToken || !result.IdToken) {
      throw new UnauthorizedError('Authentication failed')
    }

    return {
      accessToken: result.AccessToken,
      refreshToken: result.RefreshToken,
      idToken: result.IdToken,
    }
  }

  /**
   * Refresh Token으로 Access Token 갱신
   */
  async refreshTokens(refreshToken: string): Promise<Pick<AuthTokens, 'accessToken' | 'idToken'>> {
    const response = await cognitoClient.send(
      new InitiateAuthCommand({
        AuthFlow: 'REFRESH_TOKEN_AUTH' as AuthFlowType,
        ClientId: env.COGNITO_CLIENT_ID,
        AuthParameters: {
          REFRESH_TOKEN: refreshToken,
        },
      })
    )

    const result = response.AuthenticationResult
    if (!result?.AccessToken || !result.IdToken) {
      throw new UnauthorizedError('Token refresh failed')
    }

    return {
      accessToken: result.AccessToken,
      idToken: result.IdToken,
    }
  }

  /**
   * 로그아웃 (Cognito 세션 무효화)
   */
  async signOut(accessToken: string): Promise<void> {
    await cognitoClient.send(new GlobalSignOutCommand({ AccessToken: accessToken }))
  }

  /**
   * 비밀번호 변경
   */
  async changePassword(
    accessToken: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    await cognitoClient.send(
      new ChangePasswordCommand({
        AccessToken: accessToken,
        PreviousPassword: currentPassword,
        ProposedPassword: newPassword,
      })
    )
  }

  /**
   * Cognito 사용자 정보를 DB에 동기화 (회원가입 완료 시)
   */
  async syncCognitoUser(cognitoSub: string, email: string): Promise<User> {
    return prisma.user.upsert({
      where: { cognitoSub },
      create: { cognitoSub, email },
      update: { email },
    })
  }
}

export const authService = new AuthService()
