import { z } from 'zod'

const EnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  COGNITO_USER_POOL_ID: z.string().min(1),
  COGNITO_CLIENT_ID: z.string().min(1),
  COGNITO_REGION: z.string().min(1),
  AWS_S3_BUCKET_NAME: z.string().min(1),
  AWS_CLOUDFRONT_DOMAIN: z.string().min(1),
  AWS_REGION: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.string().url(),
})

// 앱 시작 시 환경 변수 검증 — 누락 시 즉시 에러
export const env = EnvSchema.parse(process.env)
