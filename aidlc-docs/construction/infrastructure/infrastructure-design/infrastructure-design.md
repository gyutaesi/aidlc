# Unit 1: Infrastructure — Infrastructure Design

> **작성일**: 2026-05-20  
> **용도**: Demo  
> **클라우드**: AWS (ap-northeast-2, 서울)

---

## 1. 인프라 서비스 매핑

| 논리 컴포넌트 | AWS 서비스 | 스펙 | 비고 |
|--------------|-----------|------|------|
| 컨테이너 런타임 | ECS Fargate | 512 CPU / 1024 MB | 태스크 1개 고정 |
| 컨테이너 레지스트리 | Amazon ECR | — | 최신 5개 이미지 보존 |
| 로드밸런서 | ALB | HTTP:80 | Internet-facing |
| 데이터베이스 | Aurora PostgreSQL Serverless v2 | Min 0.5 / Max 4 ACU | PostgreSQL 15.x |
| 인증 | Amazon Cognito User Pool | — | 이메일+비밀번호, JWT |
| 파일 저장 | Amazon S3 | — | 단일 버킷, OAC |
| CDN | Amazon CloudFront | PRICE_CLASS_100 | S3 Origin, OAC |
| 네트워크 | Amazon VPC | 10.0.0.0/16, 2 AZ | Public 2 + Private 2 서브넷 |
| NAT | NAT Gateway | 1개 (단일 AZ) | demo 비용 절감 |
| 자격증명 | AWS Secrets Manager | — | DB 자격증명 자동 생성 |
| 설정 관리 | AWS Parameter Store | — | 비민감 설정값 6개 |
| 로그 | Amazon CloudWatch Logs | 7일 보존 | `/ecs/moaring` |
| IaC | AWS CDK v2 (TypeScript) | — | 6개 스택 |

---

## 2. CDK 스택 → AWS 서비스 매핑

### NetworkStack → VPC 인프라

```
NetworkStack
├── aws_ec2.Vpc
│   ├── CIDR: 10.0.0.0/16
│   ├── maxAzs: 2
│   └── subnetConfiguration:
│       ├── PUBLIC  (cidrMask: 24) × 2 AZ  → ALB 배치
│       └── PRIVATE (cidrMask: 24) × 2 AZ  → ECS + Aurora 배치
├── aws_ec2.NatGateway (1개, 첫 번째 AZ)
└── aws_ec2.SecurityGroup × 3
    ├── alb-sg:  Ingress TCP:80  from 0.0.0.0/0
    ├── ecs-sg:  Ingress TCP:3000 from alb-sg
    └── db-sg:   Ingress TCP:5432 from ecs-sg
```

---

### DatabaseStack → Aurora PostgreSQL

```
DatabaseStack
└── aws_rds.DatabaseCluster
    ├── engine: AuroraPostgresEngineVersion.VER_15_x
    ├── serverlessV2MinCapacity: 0.5
    ├── serverlessV2MaxCapacity: 4
    ├── defaultDatabaseName: 'moaring'     ← DB 자동 생성
    ├── credentials: Credentials.fromGeneratedSecret('moaring_admin')
    ├── vpc: NetworkStack.vpc
    ├── vpcSubnets: PRIVATE
    ├── securityGroups: [db-sg]
    ├── backup.retention: Duration.days(1)
    └── removalPolicy: DESTROY
        storageEncrypted: true
```

**DB 자격증명 → ECS 환경변수 주입 방식**:

```
Secrets Manager (자동 생성)
{
  "username": "moaring_admin",
  "password": "{auto-generated}",
  "host": "{cluster-endpoint}",
  "port": 5432,
  "dbname": "moaring"
}
        │
        ├─ ECS Secret: DB_HOST   ← secretValueFromJson('host')
        ├─ ECS Secret: DB_USER   ← secretValueFromJson('username')
        ├─ ECS Secret: DB_PASSWORD ← secretValueFromJson('password')
        └─ ECS Env:   DB_NAME=moaring, DB_PORT=5432 (하드코딩)

앱 코드 (lib/prisma.ts):
DATABASE_URL = `postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}?connection_limit=5&pool_timeout=10&connect_timeout=10`
```

---

### AuthStack → Cognito

```
AuthStack
└── aws_cognito.UserPool
    ├── signInAliases: { email: true }
    ├── autoVerify: { email: true }
    ├── passwordPolicy: { minLength: 8, requireUppercase, requireLowercase, requireDigits }
    ├── mfa: OPTIONAL → OFF
    ├── removalPolicy: DESTROY
    └── UserPoolClient
        ├── generateSecret: false
        ├── authFlows: { userPassword: true, userSrp: true }
        ├── accessTokenValidity: Duration.minutes(60)
        ├── idTokenValidity: Duration.minutes(60)
        └── refreshTokenValidity: Duration.days(30)
```

---

### StorageStack → S3 + CloudFront

```
StorageStack
├── aws_s3.Bucket
│   ├── bucketName: `moaring-storage-${account}-${region}`
│   ├── blockPublicAccess: BLOCK_ALL
│   ├── encryption: S3_MANAGED
│   ├── cors: [{ allowedMethods: [PUT, GET], allowedOrigins: ['*'], allowedHeaders: ['*'] }]
│   ├── autoDeleteObjects: true
│   └── removalPolicy: DESTROY
│
└── aws_cloudfront.Distribution
    ├── defaultBehavior:
    │   ├── origin: S3BucketOrigin.withOriginAccessControl(bucket)
    │   ├── compress: true
    │   ├── viewerProtocolPolicy: ALLOW_ALL
    │   ├── cachePolicy: CachePolicy.CACHING_OPTIMIZED
    │   └── defaultTtl: Duration.days(1), maxTtl: Duration.days(365)
    └── priceClass: PRICE_CLASS_100
```

---

### AppStack → ECR + ECS + ALB

```
AppStack
├── aws_ecr.Repository
│   ├── repositoryName: 'moaring-app'
│   ├── lifecycleRules: [{ maxImageCount: 5 }]
│   └── removalPolicy: DESTROY
│
├── aws_ecs.Cluster
│   └── clusterName: 'moaring-cluster'
│
├── aws_logs.LogGroup
│   ├── logGroupName: '/ecs/moaring'
│   ├── retention: RetentionDays.ONE_WEEK
│   └── removalPolicy: DESTROY
│
├── aws_iam.Role (Task Execution Role)
│   └── managedPolicies: [AmazonECSTaskExecutionRolePolicy]
│       + secretsmanager:GetSecretValue (DB Secret ARN)
│
├── aws_iam.Role (Task Role)
│   └── inlinePolicies:
│       ├── ssm:GetParameters, ssm:GetParameter → /moaring/prod/*
│       ├── s3:PutObject, GetObject, DeleteObject → bucket/*
│       └── ssmmessages:* → * (ECS Exec)
│
├── aws_ecs.FargateTaskDefinition
│   ├── cpu: 512, memoryLimitMiB: 1024
│   ├── taskRole: TaskRole
│   ├── executionRole: TaskExecutionRole
│   └── container 'moaring-app':
│       ├── image: ContainerImage.fromEcrRepository(repo, tag)
│       ├── portMappings: [{ containerPort: 3000 }]
│       ├── logging: LogDriver.awsLogs({ logGroup, streamPrefix: 'ecs' })
│       ├── environment:  (Parameter Store → ECS Env)
│       │   ├── NODE_ENV: 'production'
│       │   ├── DB_NAME: 'moaring'
│       │   ├── DB_PORT: '5432'
│       │   ├── LOG_LEVEL: (from SSM /moaring/prod/log-level)
│       │   ├── COGNITO_USER_POOL_ID: (from SSM)
│       │   ├── COGNITO_CLIENT_ID: (from SSM)
│       │   ├── S3_BUCKET_NAME: (from SSM)
│       │   ├── CLOUDFRONT_DOMAIN: (from SSM)
│       │   └── AWS_REGION: 'ap-northeast-2'
│       └── secrets:  (Secrets Manager → ECS Secrets)
│           ├── DB_HOST: Secret.fromSecretsManager(dbSecret, 'host')
│           ├── DB_USER: Secret.fromSecretsManager(dbSecret, 'username')
│           └── DB_PASSWORD: Secret.fromSecretsManager(dbSecret, 'password')
│
├── aws_elasticloadbalancingv2.ApplicationLoadBalancer
│   ├── internetFacing: true
│   ├── vpc: NetworkStack.vpc
│   ├── vpcSubnets: PUBLIC
│   └── securityGroups: [alb-sg]
│
├── aws_elasticloadbalancingv2.ApplicationTargetGroup
│   ├── port: 3000, protocol: HTTP
│   └── healthCheck: { path: '/api/health', interval: 30s, healthyThresholdCount: 2, unhealthyThresholdCount: 3 }
│
├── ALB Listener: HTTP:80 → TargetGroup
│
└── aws_ecs.FargateService
    ├── cluster, taskDefinition
    ├── desiredCount: 1
    ├── vpcSubnets: PRIVATE
    ├── securityGroups: [ecs-sg]
    ├── assignPublicIp: false
    ├── enableExecuteCommand: true
    ├── minHealthyPercent: 0
    ├── maxHealthyPercent: 200
    └── targetGroups: [TargetGroup]
```

---

### ConfigStack → Parameter Store

```
ConfigStack
└── aws_ssm.StringParameter × 6
    ├── /moaring/prod/log-level          = 'info'
    ├── /moaring/prod/cognito-user-pool-id = userPool.userPoolId
    ├── /moaring/prod/cognito-client-id    = userPoolClient.userPoolClientId
    ├── /moaring/prod/s3-bucket-name       = bucket.bucketName
    ├── /moaring/prod/cloudfront-domain    = `https://${distribution.distributionDomainName}`
    └── /moaring/prod/aws-region           = 'ap-northeast-2'
```

---

## 3. 환경변수 전체 목록 (ECS Task)

| 변수명 | 타입 | 소스 | 값 |
|--------|------|------|-----|
| `NODE_ENV` | Env | 하드코딩 | `production` |
| `DB_NAME` | Env | 하드코딩 | `moaring` |
| `DB_PORT` | Env | 하드코딩 | `5432` |
| `AWS_REGION` | Env | 하드코딩 | `ap-northeast-2` |
| `LOG_LEVEL` | Env | Parameter Store | `/moaring/prod/log-level` |
| `COGNITO_USER_POOL_ID` | Env | Parameter Store | `/moaring/prod/cognito-user-pool-id` |
| `COGNITO_CLIENT_ID` | Env | Parameter Store | `/moaring/prod/cognito-client-id` |
| `S3_BUCKET_NAME` | Env | Parameter Store | `/moaring/prod/s3-bucket-name` |
| `CLOUDFRONT_DOMAIN` | Env | Parameter Store | `/moaring/prod/cloudfront-domain` |
| `DB_HOST` | Secret | Secrets Manager | `dbSecret['host']` |
| `DB_USER` | Secret | Secrets Manager | `dbSecret['username']` |
| `DB_PASSWORD` | Secret | Secrets Manager | `dbSecret['password']` |

---

## 4. 리소스 태그 전략

모든 스택에 `Tags.of(stack).add(key, value)` 적용:

| 태그 키 | 값 |
|---------|-----|
| `Project` | `moaring` |
| `Environment` | `prod` |
| `ManagedBy` | `cdk` |

---

## 5. 삭제 정책 요약 (demo)

| 리소스 | 삭제 정책 | 비고 |
|--------|-----------|------|
| Aurora 클러스터 | DESTROY | skipFinalSnapshot: true |
| S3 버킷 | DESTROY | autoDeleteObjects: true |
| ECR 레포지토리 | DESTROY | — |
| CloudWatch Logs | DESTROY | — |
| Cognito User Pool | DESTROY | ⚠️ 사용자 데이터 삭제됨 |
| Parameter Store | DESTROY (CDK 관리) | — |
