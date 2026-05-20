'use client'

import { useTranslations } from 'next-intl'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { VerifySchema, type VerifyInput } from '@/lib/schemas/auth.schema'
import { confirmSignUpAction } from '@/lib/actions/auth.actions'

export default function VerifyPage() {
  const t = useTranslations('auth')
  const router = useRouter()
  const searchParams = useSearchParams()
  const email = searchParams.get('email') ?? ''

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<VerifyInput>({
    resolver: zodResolver(VerifySchema),
    defaultValues: { email },
  })

  async function onSubmit(data: VerifyInput) {
    const formData = new FormData()
    formData.set('email', data.email)
    formData.set('code', data.code)

    const result = await confirmSignUpAction(formData)
    if (result.success) {
      toast.success(t('signupSuccess'))
      router.push('/ko/login')
    } else {
      toast.error(result.error ?? t('errors.invalidCode'))
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-sm space-y-6 p-6">
        <div className="text-center">
          <h1 className="text-xl font-bold">{t('emailVerification')}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t('verificationSent')}</p>
          {email && <p className="mt-1 text-sm font-medium">{email}</p>}
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" data-testid="verify-form">
          <input type="hidden" {...register('email')} />

          <div className="space-y-1">
            <label className="text-sm font-medium">{t('verificationCode')}</label>
            <Input
              {...register('code')}
              placeholder="123456"
              maxLength={6}
              data-testid="verify-code-input"
            />
            {errors.code && <p className="text-xs text-destructive">{errors.code.message}</p>}
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={isSubmitting}
            data-testid="verify-submit-button"
          >
            {isSubmitting ? useTranslations('common')('loading') : useTranslations('common')('confirm')}
          </Button>
        </form>
      </div>
    </div>
  )
}
