'use client'

import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SignUpSchema, type SignUpInput } from '@/lib/schemas/auth.schema'
import { signUpAction } from '@/lib/actions/auth.actions'

export default function SignupPage() {
  const t = useTranslations('auth')
  const router = useRouter()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignUpInput>({ resolver: zodResolver(SignUpSchema) })

  async function onSubmit(data: SignUpInput) {
    const formData = new FormData()
    formData.set('email', data.email)
    formData.set('password', data.password)
    formData.set('passwordConfirm', data.passwordConfirm)

    const result = await signUpAction(formData)
    if (result.success) {
      toast.success(t('signupSuccess'))
      router.push(`/ko/verify?email=${encodeURIComponent(data.email)}`)
    } else {
      toast.error(result.error ?? '회원가입에 실패했습니다')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-sm space-y-6 p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">moaring</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t('signup')}</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" data-testid="signup-form">
          <div className="space-y-1">
            <label className="text-sm font-medium">{t('email')}</label>
            <Input
              {...register('email')}
              type="email"
              placeholder="you@example.com"
              data-testid="signup-email-input"
            />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">{t('password')}</label>
            <Input
              {...register('password')}
              type="password"
              data-testid="signup-password-input"
            />
            {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">{t('passwordConfirm')}</label>
            <Input
              {...register('passwordConfirm')}
              type="password"
              data-testid="signup-password-confirm-input"
            />
            {errors.passwordConfirm && (
              <p className="text-xs text-destructive">{errors.passwordConfirm.message}</p>
            )}
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={isSubmitting}
            data-testid="signup-submit-button"
          >
            {isSubmitting ? useTranslations('common')('loading') : t('signup')}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          {t('hasAccount')}{' '}
          <Link href="/ko/login" className="text-primary hover:underline" data-testid="signup-login-link">
            {t('login')}
          </Link>
        </p>
      </div>
    </div>
  )
}
