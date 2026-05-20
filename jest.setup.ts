// Jest 전역 설정
// 환경 변수 모킹
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test'
process.env.COGNITO_USER_POOL_ID = 'us-east-1_test'
process.env.COGNITO_CLIENT_ID = 'test-client-id'
process.env.COGNITO_REGION = 'us-east-1'
process.env.AWS_S3_BUCKET_NAME = 'test-bucket'
process.env.AWS_CLOUDFRONT_DOMAIN = 'test.cloudfront.net'
process.env.AWS_REGION = 'us-east-1'
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'
