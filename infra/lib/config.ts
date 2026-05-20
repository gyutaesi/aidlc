/**
 * moaring 인프라 설정 상수
 *
 * 모든 CDK 스택에서 참조하는 단일 진실 공급원(Single Source of Truth).
 * 스펙 변경 시 이 파일만 수정 후 `cdk deploy --all` 실행.
 *
 * cdk.Duration 같은 CDK 타입은 각 스택에서 감싸서 사용:
 *   cdk.Duration.days(Config.cloudfront.defaultTtlDays)
 */

export const Config = {
  // 환경
  env: 'prod' as const,
  region: 'us-east-1',
  projectName: 'moaring',

  // VPC
  vpc: {
    cidr: '10.0.0.0/16',
    maxAzs: 2,
    natGateways: 1, // demo: 단일 NAT
  },

  // Aurora PostgreSQL Serverless v2
  aurora: {
    minAcu: 0.5,
    maxAcu: 4,
    backupRetentionDays: 1,
    databaseName: 'moaring',
    username: 'moaring_admin',
    port: 5432,
  },

  // ECS Fargate
  ecs: {
    cpu: 512,
    memoryLimitMiB: 1024,
    desiredCount: 0, // 이미지 push 전까지 0, push 후 aws ecs update-service --desired-count 1
    minHealthyPercent: 0, // 태스크 1개 환경에서 Rolling update 가능하도록 0
    maxHealthyPercent: 200,
    containerPort: 3000,
    healthCheckPath: '/api/health',
    healthCheckIntervalSeconds: 30,
    healthCheckTimeoutSeconds: 5,
    healthCheckHealthyThreshold: 2,
    healthCheckUnhealthyThreshold: 3,
    healthCheckGracePeriodSeconds: 60,
  },

  // CloudFront
  cloudfront: {
    defaultTtlDays: 1,
    maxTtlDays: 365,
  },

  // ECR
  ecr: {
    maxImageCount: 5,
  },

  // Cognito
  cognito: {
    accessTokenValidityMinutes: 60,
    refreshTokenValidityDays: 30,
    idTokenValidityMinutes: 60,
    passwordMinLength: 8,
  },

  // CloudWatch Logs
  logs: {
    retentionDays: 7,
    logGroupName: '/ecs/moaring',
  },

  // Parameter Store
  parameterStore: {
    pathPrefix: '/moaring/prod',
    initialLogLevel: 'info',
  },

  // 공통 태그
  tags: {
    Project: 'moaring',
    Environment: 'prod',
    ManagedBy: 'cdk',
  },
} as const

export type AppConfig = typeof Config
