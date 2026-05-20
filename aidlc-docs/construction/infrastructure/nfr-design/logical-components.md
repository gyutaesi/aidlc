# Unit 1: Infrastructure — Logical Components

> **작성일**: 2026-05-20  
> **용도**: Demo

---

## 1. 논리 컴포넌트 전체 구성도

```
┌─────────────────────────────────────────────────────────────────┐
│  인터넷                                                          │
│  브라우저 / Chrome Extension                                     │
└──────────────────────┬──────────────────────────────────────────┘
                       │ HTTP:80
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│  Public 서브넷 (ap-northeast-2a, 2c)                            │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  ALB (moaring-alb)                                       │   │
│  │  - 리스너: HTTP:80                                       │   │
│  │  - 헬스체크: GET /api/health (30초 간격)                 │   │
│  └──────────────────────┬──────────────────────────────────┘   │
│                          │ TCP:3000                              │
└──────────────────────────┼──────────────────────────────────────┘
                           │
┌──────────────────────────┼──────────────────────────────────────┐
│  Private 서브넷 (ap-northeast-2a, 2c)                           │
│                          ▼                                       │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  ECS Fargate Task (moaring-app)                          │   │
│  │  CPU: 512 / Memory: 1024MB                               │   │
│  │  Port: 3000                                              │   │
│  │  ENV: LOG_LEVEL, S3_BUCKET_NAME, CLOUDFRONT_DOMAIN,     │   │
│  │       COGNITO_USER_POOL_ID, COGNITO_CLIENT_ID            │   │
│  │  SECRET: DATABASE_URL (Secrets Manager)                  │   │
│  └──────┬──────────────────────────────────────────────────┘   │
│         │ TCP:5432                                               │
│         ▼                                                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Aurora PostgreSQL Serverless v2 (moaring-db)            │   │
│  │  Min 0.5 ACU / Max 4 ACU                                 │   │
│  │  DB: moaring                                             │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  NAT Gateway (2a) ──► 인터넷 게이트웨이                         │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  AWS 관리형 서비스 (VPC 외부)                                    │
│                                                                  │
│  Cognito User Pool ◄── ECS (JWT 검증)                           │
│  S3 Bucket ◄────────── ECS (Pre-signed URL 업로드)              │
│  CloudFront ────────── 브라우저 (이미지 CDN)                    │
│  ECR ◄──────────────── ECS (이미지 pull, NAT 경유)              │
│  Secrets Manager ◄──── ECS Task (DB 자격증명 조회)              │
│  Parameter Store ◄──── ECS Task (설정값 조회)                   │
│  CloudWatch Logs ◄──── ECS Task (로그 전송)                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. 컴포넌트별 상세 명세

### LC-01: ALB (Application Load Balancer)

| 속성 | 값 |
|------|-----|
| 이름 | `moaring-alb` |
| 타입 | Internet-facing |
| 서브넷 | Public (2 AZ) |
| 보안 그룹 | `alb-sg` (인바운드 HTTP:80) |
| 리스너 | HTTP:80 |
| 타겟 그룹 | ECS Service, 포트 3000, 프로토콜 HTTP |
| 헬스체크 경로 | `/api/health` |
| 헬스체크 정상 임계값 | 2회 |
| 헬스체크 비정상 임계값 | 3회 |
| 헬스체크 간격 | 30초 |
| 헬스체크 타임아웃 | 5초 |

**연결**: 인터넷 → ALB → ECS Task (포트 3000)

---

### LC-02: ECS Fargate Service

| 속성 | 값 |
|------|-----|
| 클러스터 | `moaring-cluster` |
| 서비스명 | `moaring-service` |
| 태스크 수 | 1 (고정) |
| 서브넷 | Private (2 AZ) |
| 보안 그룹 | `ecs-sg` |
| 퍼블릭 IP | 없음 |
| minimumHealthyPercent | 0 |
| maximumPercent | 200 |
| enableExecuteCommand | true |
| 배포 방식 | Rolling update |

**Task Definition**:

| 속성 | 값 |
|------|-----|
| CPU | 512 |
| Memory | 1024 MB |
| 컨테이너명 | `moaring-app` |
| 이미지 | `{ecr-uri}/moaring-app:{tag}` |
| 포트 | 3000 |
| 로그 드라이버 | `awslogs` |
| 로그 그룹 | `/ecs/moaring` |

**환경변수 (ECS Environment)**:

| 변수명 | 소스 | 값 |
|--------|------|-----|
| `LOG_LEVEL` | Parameter Store | `/moaring/prod/log-level` |
| `COGNITO_USER_POOL_ID` | Parameter Store | `/moaring/prod/cognito-user-pool-id` |
| `COGNITO_CLIENT_ID` | Parameter Store | `/moaring/prod/cognito-client-id` |
| `S3_BUCKET_NAME` | Parameter Store | `/moaring/prod/s3-bucket-name` |
| `CLOUDFRONT_DOMAIN` | Parameter Store | `/moaring/prod/cloudfront-domain` |
| `AWS_REGION` | Parameter Store | `/moaring/prod/aws-region` |
| `NODE_ENV` | 하드코딩 | `production` |

**민감 정보 (ECS Secrets)**:

| 변수명 | 소스 | 값 |
|--------|------|-----|
| `DATABASE_URL` | Secrets Manager (별도 Secret) | `{database-url-secret-arn}` |

> **DATABASE_URL 주입 방식**:  
> ECS Secrets는 Secrets Manager JSON에서 단일 필드 하나만 꺼낼 수 있습니다.  
> `DATABASE_URL` 전체 문자열 조합은 ECS가 지원하지 않으므로, CDK에서 별도 Secret을 생성합니다:
>
> ```typescript
> // AppStack — DATABASE_URL 전용 Secret 생성
> const dbUrlSecret = new secretsmanager.Secret(this, 'DbUrlSecret', {
>   secretName: '/moaring/prod/database-url',
>   secretStringValue: cdk.SecretValue.unsafePlainText(
>     `postgresql://moaring_admin:${dbSecret.secretValueFromJson('password').unsafeUnwrap()}` +
>     `@${cluster.clusterEndpoint.hostname}:5432/moaring` +
>     `?connection_limit=5&pool_timeout=10&connect_timeout=10`
>   ),
> })
>
> // Task Definition secrets 필드에서 참조
> secrets: {
>   DATABASE_URL: ecs.Secret.fromSecretsManager(dbUrlSecret),
> }
> ```
>
> ⚠️ CDK synth 시점에 DB 엔드포인트와 비밀번호가 확정되지 않으므로,  
> 실제 구현에서는 **CDK Custom Resource** 또는 **배포 후 수동 입력** 방식을 사용합니다.  
> 코드 생성 단계에서 구체적인 구현 방법을 결정합니다.

---

### LC-03: Aurora PostgreSQL Serverless v2

| 속성 | 값 |
|------|-----|
| 클러스터명 | `moaring-db` |
| 엔진 | Aurora PostgreSQL 15.x |
| 인스턴스 | Writer 1개 (Serverless v2) |
| Min ACU | 0.5 |
| Max ACU | 4 |
| 서브넷 | Private (2 AZ) |
| 보안 그룹 | `db-sg` (인바운드 TCP:5432, 소스: ecs-sg) |
| 퍼블릭 접근 | 없음 |
| 자격증명 | Secrets Manager 자동 생성 |
| 백업 보존 | 1일 |
| 삭제 정책 | DESTROY |

---

### LC-04: S3 + CloudFront

**S3 버킷**:

| 속성 | 값 |
|------|-----|
| 버킷명 | `moaring-storage-{account}-{region}` |
| 퍼블릭 접근 | 전체 차단 |
| CORS | PUT/GET 허용, Origin `*` |
| 암호화 | SSE-S3 |
| 삭제 정책 | DESTROY + autoDeleteObjects |

**CloudFront Distribution**:

| 속성 | 값 |
|------|-----|
| Origin | S3 (OAC) |
| 압축 | 활성화 (Gzip/Brotli) |
| 기본 TTL | 1일 |
| 최대 TTL | 1년 |
| 뷰어 프로토콜 | HTTP and HTTPS |
| 가격 등급 | PRICE_CLASS_100 |

---

### LC-05: Cognito User Pool

| 속성 | 값 |
|------|-----|
| Pool명 | `moaring-user-pool` |
| 로그인 식별자 | 이메일 |
| 이메일 인증 | 필수 |
| MFA | 없음 |
| 비밀번호 정책 | 최소 8자, 대소문자+숫자 |
| Access Token | 1시간 |
| Refresh Token | 30일 |
| Client Secret | 없음 |

---

### LC-06: ECR + Parameter Store + Secrets Manager

**ECR**:

| 속성 | 값 |
|------|-----|
| 레포지토리명 | `moaring-app` |
| 이미지 보존 | 최신 5개 |
| 삭제 정책 | DESTROY |

**Parameter Store** (String, 비민감):

| 경로 | 값 |
|------|-----|
| `/moaring/prod/log-level` | `info` |
| `/moaring/prod/cognito-user-pool-id` | Cognito Pool ID |
| `/moaring/prod/cognito-client-id` | App Client ID |
| `/moaring/prod/s3-bucket-name` | S3 버킷명 |
| `/moaring/prod/cloudfront-domain` | CloudFront 도메인 |
| `/moaring/prod/aws-region` | `ap-northeast-2` |

**Secrets Manager**:

| 항목 | 값 |
|------|-----|
| DB 자격증명 Secret | CDK 자동 생성 — `{ "username": "moaring_admin", "password": "{auto}", "host": "{endpoint}", "port": 5432, "dbname": "moaring" }` |
| DATABASE_URL Secret | `/moaring/prod/database-url` — `postgresql://moaring_admin:{password}@{endpoint}:5432/moaring?connection_limit=5&pool_timeout=10&connect_timeout=10` |
| 참조 방식 | ECS Task Definition `secrets` 필드에서 DATABASE_URL Secret 직접 참조 |

---

## 3. IAM 역할 명세

### Task Execution Role (ECS 에이전트)

| 액션 | 리소스 |
|------|--------|
| `ecr:GetAuthorizationToken` | `*` |
| `ecr:BatchGetImage`, `ecr:GetDownloadUrlForLayer` | ECR 레포지토리 ARN |
| `logs:CreateLogStream`, `logs:PutLogEvents` | `/ecs/moaring` 로그 그룹 ARN |
| `secretsmanager:GetSecretValue` | DB 자격증명 Secret ARN + DATABASE_URL Secret ARN |

### Task Role (앱 코드)

| 액션 | 리소스 |
|------|--------|
| `ssm:GetParameters`, `ssm:GetParameter` | `/moaring/prod/*` |
| `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject` | S3 버킷 ARN + `/*` |
| `ssmmessages:CreateControlChannel` | `*` |
| `ssmmessages:CreateDataChannel` | `*` |
| `ssmmessages:OpenControlChannel` | `*` |
| `ssmmessages:OpenDataChannel` | `*` |

---

## 4. 네트워크 트래픽 흐름 요약

| 흐름 | 경로 | 프로토콜 |
|------|------|----------|
| 사용자 → 앱 | 인터넷 → ALB → ECS | HTTP:80 → TCP:3000 |
| 앱 → DB | ECS → Aurora | TCP:5432 (Private) |
| 앱 → AWS 서비스 | ECS → NAT GW → 인터넷 → ECR/Cognito/SSM/Secrets | HTTPS:443 |
| 앱 → S3 | ECS → NAT GW → S3 | HTTPS:443 |
| 사용자 → 이미지 | 브라우저 → CloudFront → S3 (OAC) | HTTPS/HTTP |
| 개발자 → 컨테이너 | SSM Session Manager → ECS Exec | HTTPS (SSM) |
