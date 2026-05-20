import { AuthService } from '../auth.service'
import { NotFoundError, UnauthorizedError } from '@/lib/errors'

// Prisma 모킹
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
  },
}))

// jose 모킹
jest.mock('jose', () => ({
  jwtVerify: jest.fn(),
  createRemoteJWKSet: jest.fn(() => ({})),
}))

import { prisma } from '@/lib/prisma'

const mockUser = {
  id: 'user-1',
  cognitoSub: 'cognito-sub-123',
  email: 'test@example.com',
  createdAt: new Date(),
  updatedAt: new Date(),
}

describe('AuthService', () => {
  let authService: AuthService

  beforeEach(() => {
    jest.clearAllMocks()
    authService = new AuthService()
  })

  describe('getUserFromToken', () => {
    it('유효한 토큰으로 User를 반환한다', async () => {
      const { jwtVerify } = await import('jose')
      ;(jwtVerify as jest.Mock).mockResolvedValue({
        payload: { sub: 'cognito-sub-123' },
      })
      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser)

      const result = await authService.getUserFromToken('valid-token')
      expect(result).toEqual(mockUser)
    })

    it('DB에 User가 없으면 NotFoundError를 던진다', async () => {
      const { jwtVerify } = await import('jose')
      ;(jwtVerify as jest.Mock).mockResolvedValue({
        payload: { sub: 'cognito-sub-unknown' },
      })
      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(null)

      await expect(authService.getUserFromToken('valid-token')).rejects.toThrow(NotFoundError)
    })

    it('JWT 검증 실패 시 UnauthorizedError를 던진다', async () => {
      const { jwtVerify } = await import('jose')
      ;(jwtVerify as jest.Mock).mockRejectedValue(new Error('JWT expired'))

      await expect(authService.getUserFromToken('invalid-token')).rejects.toThrow(UnauthorizedError)
    })
  })

  describe('syncCognitoUser', () => {
    it('새 User를 생성한다', async () => {
      ;(prisma.user.upsert as jest.Mock).mockResolvedValue(mockUser)

      const result = await authService.syncCognitoUser('sub-123', 'new@example.com')
      expect(result).toEqual(mockUser)
      expect(prisma.user.upsert).toHaveBeenCalledWith({
        where: { cognitoSub: 'sub-123' },
        create: { cognitoSub: 'sub-123', email: 'new@example.com' },
        update: { email: 'new@example.com' },
      })
    })
  })
})
