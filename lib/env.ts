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

// 빌드 타임에는 환경 변수가 없을 수 있으므로 런타임에만 검증
// NEXT_PHASE가 'phase-production-build'이면 더미 값으로 대체
function getEnv() {
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    return {
      DATABASE_URL: 'postgresql://placeholder:placeholder@localhost:5432/placeholder',
      COGNITO_USER_POOL_ID: 'placeholder',
      COGNITO_CLIENT_ID: 'placeholder',
      COGNITO_REGION: 'us-east-1',
      AWS_S3_BUCKET_NAME: 'placeholder',
      AWS_CLOUDFRONT_DOMAIN: 'placeholder.cloudfront.net',
      AWS_REGION: 'us-east-1',
      NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
    }
  }
  return EnvSchema.parse(process.env)
}

export const env = getEnv()
