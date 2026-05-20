'use client'

import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SignInSchema, type SignInInput } from '@/lib/schemas/auth.schema'
import { signInAction } from '@/lib/actions/auth.actions'

export default function LoginPage() {
  const t = useTranslations('auth')
  const router = useRouter()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignInInput>({ resolver: zodResolver(SignInSchema) })

  async function onSubmit(data: SignInInput) {
    const formData = new FormData()
    formData.set('email', data.email)
    formData.set('password', data.password)

    const result = await signInAction(formData)
    if (result.success) {
      toast.success(t('loginSuccess'))
      router.push('/ko/inbox')
    } else {
      toast.error(result.error ?? t('errors.invalidCredentials'))
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-sm space-y-6 p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">moaring</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t('login')}</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" data-testid="login-form">
          <div className="space-y-1">
            <label className="text-sm font-medium">{t('email')}</label>
            <Input
              {...register('email')}
              type="email"
              placeholder="you@example.com"
              data-testid="login-email-input"
            />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">{t('password')}</label>
            <Input
              {...register('password')}
              type="password"
              data-testid="login-password-input"
            />
            {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={isSubmitting}
            data-testid="login-submit-button"
          >
            {isSubmitting ? useTranslations('common')('loading') : t('login')}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          {t('noAccount')}{' '}
          <Link href="/ko/signup" className="text-primary hover:underline" data-testid="login-signup-link">
            {t('signup')}
          </Link>
        </p>
      </div>
    </div>
  )
}
