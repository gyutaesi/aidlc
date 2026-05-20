import { z } from 'zod'

export const SignUpSchema = z
  .object({
    email: z.string().email('유효한 이메일을 입력해 주세요'),
    password: z
      .string()
      .min(8, '비밀번호는 8자 이상이어야 합니다')
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        '비밀번호는 대소문자와 숫자를 포함해야 합니다'
      ),
    passwordConfirm: z.string(),
  })
  .refine((data) => data.password === data.passwordConfirm, {
    message: '비밀번호가 일치하지 않습니다',
    path: ['passwordConfirm'],
  })

export const SignInSchema = z.object({
  email: z.string().email('유효한 이메일을 입력해 주세요'),
  password: z.string().min(1, '비밀번호를 입력해 주세요'),
})

export const VerifySchema = z.object({
  email: z.string().email(),
  code: z.string().length(6, '인증 코드는 6자리입니다'),
})

export const ChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z
      .string()
      .min(8)
      .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/),
    newPasswordConfirm: z.string(),
  })
  .refine((data) => data.newPassword === data.newPasswordConfirm, {
    message: '새 비밀번호가 일치하지 않습니다',
    path: ['newPasswordConfirm'],
  })

export type SignUpInput = z.infer<typeof SignUpSchema>
export type SignInInput = z.infer<typeof SignInSchema>
export type VerifyInput = z.infer<typeof VerifySchema>
