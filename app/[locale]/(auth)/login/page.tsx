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
  const tCommon = useTranslations('common')
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
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md space-y-8">
        <div className="animate-fade-in space-y-4 text-center">
          <h1 className="gradient-text text-5xl font-extrabold tracking-tight">moaring</h1>
          <p className="text-lg text-[#6b5b50]">{t('login')}</p>
        </div>

        <div
          className="glass-card animate-float-in space-y-6 p-8"
          style={{
            animation: 'floatIn 1s ease 0.3s both',
          }}
        >
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" data-testid="login-form">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-[#3d2e24]">{t('email')}</label>
              <Input
                {...register('email')}
                type="email"
                placeholder="you@example.com"
                data-testid="login-email-input"
                className="h-11 border-[#D6CCC2] bg-white/60 text-[#3d2e24] transition-all placeholder:text-[#a09080] focus:border-[#D5BDAF] focus:ring-[#D5BDAF]/50"
              />
              {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-[#3d2e24]">{t('password')}</label>
              <Input
                {...register('password')}
                type="password"
                data-testid="login-password-input"
                className="h-11 border-[#D6CCC2] bg-white/60 text-[#3d2e24] transition-all placeholder:text-[#a09080] focus:border-[#D5BDAF] focus:ring-[#D5BDAF]/50"
              />
              {errors.password && <p className="text-xs text-red-500">{errors.password.message}</p>}
            </div>

            <Button
              type="submit"
              className="glow-button h-11 w-full text-base font-semibold"
              disabled={isSubmitting}
              data-testid="login-submit-button"
            >
              {isSubmitting ? tCommon('loading') : t('login')}
            </Button>
          </form>

          <p className="text-center text-sm text-[#6b5b50]">
            {t('noAccount')}{' '}
            <Link
              href="/ko/signup"
              className="font-semibold text-[#8b6b5a] transition-colors hover:text-[#6b4b3a]"
              data-testid="login-signup-link"
            >
              {t('signup')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
