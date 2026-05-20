# Unit 2 (Application) — Deployment Architecture

> **작성일**: 2026-05-20  
> **단계**: Construction Phase — Infrastructure Design  
> **리전**: us-east-1 (버지니아)

---

## 1. 전체 아키텍처 다이어그램

```
[사용자 브라우저 / Chrome Extension]
              |
              | HTTPS (*.cloudfront.net)
              v
+------------------------------------------+
|  Amazon CloudFront                        |
|  - 오리진 1: S3 (이미지, /users/*)       |
|  - 오리진 2: ALB (앱, /*)                |
|  - OAC (S3 접근)                         |
|  - 보안 헤더 설정                         |
+------------------------------------------+
         |                    |
    /users/*              /*
         |                    |
         v                    v
+----------------+   +------------------+
|  Amazon S3     |   |  ALB             |
|  (이미지 저장) |   |  HTTP:80 → 443   |
|  OAC 전용 접근 |   |  HTTPS:443       |
+----------------+   +------------------+
                              |
                              | HTTP:3000
                              v
                    +------------------+
                    |  ECS/Fargate     |
                    |  (ap-northeast-  |
                    |   2a, 프라이빗)  |
                    |                  |
                    |  Next.js 15      |
                    |  node:20-alpine  |
                    |  0.5vCPU / 1GB   |
                    |  태스크 1개      |
                    +------------------+
                         |        |
              5432        |        | HTTPS
                         v        v
              +----------+   +----------+
              | Aurora   |   | Cognito  |
              | PG SV2   |   | User Pool|
              | 0.5~2ACU |   | (외부)   |
              | 프라이빗 |   +----------+
              +----------+
                              |
                    Parameter Store
                    (환경 변수 주입)
```

---

## 2. 네트워크 토폴로지

```
VPC: 10.0.0.0/16 (us-east-1)
|
+-- 퍼블릭 서브넷:  10.0.1.0/24 (us-east-1a)
|   +-- ALB
|   +-- NAT Gateway (ECS 아웃바운드용)
|   +-- Internet Gateway
|
+-- 프라이빗 서브넷: 10.0.2.0/24 (us-east-1a)
    +-- ECS Fargate 태스크
    +-- Aurora PostgreSQL Serverless v2
```

**트래픽 흐름**:

```
인바운드:
  인터넷 → CloudFront → ALB (퍼블릭) → ECS (프라이빗)

아웃바운드 (ECS → 외부):
  ECS (프라이빗) → NAT Gateway (퍼블릭) → 인터넷
  대상: Cognito API, OG 메타데이터 fetch, S3 API

DB 접근:
  ECS (프라이빗) → Aurora (프라이빗, 동일 서브넷)
```

---

## 3. 보안 그룹 매트릭스

```
+----------+    443    +----------+    3000   +----------+    5432   +----------+
| Internet | --------> |  ALB-SG  | --------> |  ECS-SG  | --------> | Aurora-SG|
+----------+           +----------+           +----------+           +----------+
                                                   |
                                              443 (아웃바운드)
                                                   |
                                              +----------+
                                              | NAT GW   |
                                              | Internet |
                                              +----------+
```

---

## 4. 컨테이너 배포 흐름

### 4.1 이미지 빌드 & 푸시

```
[로컬 개발 머신]
        |
        | docker build
        v
[Docker 이미지: moaring/app:{git-sha}]
        |
        | aws ecr get-login-password | docker login
        | docker push
        v
[Amazon ECR: {account}.dkr.ecr.ap-northeast-2.amazonaws.com/moaring/app]
  - :latest 태그 업데이트
  - :{git-sha} 태그 보존 (롤백용)
```

### 4.2 ECS Rolling Update 배포

```
[aws ecs update-service --force-new-deployment]
        |
        v
[ECS: 새 태스크 시작]
  - ECR에서 최신 이미지 pull
  - Parameter Store에서 환경 변수 로드
  - 컨테이너 시작 (포트 3000)
        |
        v
[ALB 헬스체크: GET /api/health]
  - 200 OK 확인 (30초 간격, 2회 연속 성공)
        |
        v
[새 태스크 정상 → 기존 태스크 종료]
  - minimumHealthyPercent: 100 (기존 태스크 유지 중 새 태스크 시작)
  - maximumPercent: 200 (동시에 최대 2개 태스크 허용)
        |
        v
[배포 완료: 다운타임 없음]
```

### 4.3 롤백 절차

```
[문제 감지: CloudWatch Logs 확인]
        |
        v
[이전 이미지 태그 확인]
  aws ecr list-images --repository-name moaring/app

[이전 태그로 태스크 정의 업데이트]
  aws ecs register-task-definition \
    --container-definitions '[{"image": "{ecr-uri}:{이전-git-sha}"}]'

[서비스 업데이트]
  aws ecs update-service \
    --task-definition moaring-app:{이전-revision}
```

---

## 5. 환경 구성

### 5.1 로컬 개발 환경

```
+------------------+     +------------------+
|  Next.js Dev     |     |  Docker Compose  |
|  (localhost:3000)|     |                  |
|  npm run dev     |     |  PostgreSQL 15   |
+------------------+     |  (localhost:5432)|
         |               +------------------+
         | .env.local
         v
+------------------+
|  실제 AWS 서비스  |
|  - Cognito (개발 |
|    User Pool)    |
|  - S3 (개발 버킷)|
+------------------+
```

**docker-compose.yml**:

```yaml
version: '3.8'
services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: moaring
      POSTGRES_USER: moaring
      POSTGRES_PASSWORD: moaring_local
    ports:
      - '5432:5432'
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

**.env.local**:

```
DATABASE_URL=postgresql://moaring:moaring_local@localhost:5432/moaring?connection_limit=5
COGNITO_USER_POOL_ID=ap-northeast-2_xxxxxxxxx
COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
COGNITO_REGION=us-east-1
AWS_S3_BUCKET_NAME=moaring-assets-dev-{account-id}
AWS_CLOUDFRONT_DOMAIN=xxxxxxxxxx.cloudfront.net
AWS_REGION=us-east-1
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 5.2 프로덕션 환경

```
+------------------+     +------------------+
|  ECS/Fargate     |     |  Aurora PG SV2   |
|  (프라이빗 서브넷)|     |  (프라이빗 서브넷)|
|                  |---->|  0.5~2 ACU       |
|  Next.js 15      |     +------------------+
|  node:20-alpine  |
|  0.5vCPU / 1GB   |     +------------------+
|                  |---->|  Cognito         |
|  환경 변수:      |     |  (외부 서비스)   |
|  Parameter Store |     +------------------+
+------------------+
```

---

## 6. 헬스체크 엔드포인트

```typescript
// app/api/health/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    // DB 연결 확인
    await prisma.$queryRaw`SELECT 1`
    return NextResponse.json({ status: 'ok', timestamp: new Date().toISOString() }, { status: 200 })
  } catch (error) {
    return NextResponse.json({ status: 'error', message: 'DB connection failed' }, { status: 503 })
  }
}
```

**ALB 헬스체크 설정**:

```
경로: /api/health
프로토콜: HTTP
포트: 3000
정상 임계값: 2 (연속 2회 성공)
비정상 임계값: 3 (연속 3회 실패)
간격: 30초
타임아웃: 5초
```

---

## 7. IAM 역할 및 권한

### 7.1 ECS Task Role (앱 권한)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::moaring-assets-*/*"
    },
    {
      "Effect": "Allow",
      "Action": ["ssm:GetParameters", "ssm:GetParameter"],
      "Resource": "arn:aws:ssm:us-east-1:*:parameter/moaring/prod/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "cognito-idp:InitiateAuth",
        "cognito-idp:SignUp",
        "cognito-idp:ConfirmSignUp",
        "cognito-idp:ForgotPassword",
        "cognito-idp:ConfirmForgotPassword",
        "cognito-idp:ChangePassword",
        "cognito-idp:GlobalSignOut",
        "cognito-idp:GetUser"
      ],
      "Resource": "arn:aws:cognito-idp:us-east-1:*:userpool/*"
    }
  ]
}
```

### 7.2 ECS Task Execution Role (ECS 인프라 권한)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ecr:GetAuthorizationToken",
        "ecr:BatchCheckLayerAvailability",
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchGetImage"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": ["logs:CreateLogStream", "logs:PutLogEvents"],
      "Resource": "arn:aws:logs:us-east-1:*:log-group:/ecs/moaring-app:*"
    }
  ]
}
```

---

## 8. Unit 1 (인프라 CDK)과의 의존성

Unit 2 배포 전 Unit 1에서 프로비저닝되어야 하는 리소스:

| 리소스                         | CDK 스택          | Unit 2 참조 방법                                                           |
| ------------------------------ | ----------------- | -------------------------------------------------------------------------- |
| VPC, 서브넷, 보안 그룹         | network-stack.ts  | ECS 태스크 정의                                                            |
| Aurora 클러스터 엔드포인트     | database-stack.ts | DATABASE_URL (Parameter Store)                                             |
| Cognito User Pool ID/Client ID | auth-stack.ts     | COGNITO\_\* (Parameter Store)                                              |
| S3 버킷명                      | storage-stack.ts  | AWS_S3_BUCKET_NAME (Parameter Store)                                       |
| CloudFront 도메인              | storage-stack.ts  | AWS_CLOUDFRONT_DOMAIN (Parameter Store)                                    |
| ECR 레포지토리 URI             | app-stack.ts      | Docker push 대상 (`{account}.dkr.ecr.us-east-1.amazonaws.com/moaring/app`) |
| ECS 클러스터                   | app-stack.ts      | ECS 서비스 배포 대상                                                       |
| ALB                            | app-stack.ts      | 트래픽 라우팅                                                              |

**배포 순서**:

```
1. Unit 1: CDK deploy (인프라 전체)
2. Unit 2: prisma migrate deploy (DB 스키마)
3. Unit 2: Docker build & ECR push
4. Unit 2: ECS service update
```
