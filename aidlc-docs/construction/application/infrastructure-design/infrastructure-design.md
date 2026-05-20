# Unit 2 (Application) — Infrastructure Design

> **작성일**: 2026-05-20  
> **단계**: Construction Phase — Infrastructure Design  
> **리전**: us-east-1 (버지니아)

---

## 1. 인프라 구성 요약

| 컴포넌트            | 서비스                          | 사양              | 비고                 |
| ------------------- | ------------------------------- | ----------------- | -------------------- |
| 앱 컨테이너         | ECS/Fargate                     | 0.5 vCPU / 1GB    | 태스크 1개           |
| 컨테이너 레지스트리 | ECR                             | -                 | 이미지 저장          |
| 데이터베이스        | Aurora PostgreSQL Serverless v2 | 0.5~2 ACU         | 직접 연결            |
| 인증                | Amazon Cognito User Pool        | -                 | 이메일+비밀번호      |
| 파일 스토리지       | S3                              | -                 | 이미지/파일          |
| CDN                 | CloudFront                      | \*.cloudfront.net | OAC, S3 + ALB 오리진 |
| 로드밸런서          | ALB                             | -                 | HTTPS 종료           |
| 설정 관리           | AWS Parameter Store             | -                 | 민감 정보            |
| 로그                | CloudWatch Logs                 | 7일 보존          | ECS 기본             |
| 네트워크            | VPC                             | 1개 AZ            | us-east-1a           |
| 도메인              | CloudFront 기본 도메인          | \*.cloudfront.net | 커스텀 도메인 없음   |
| CI/CD               | 수동 배포                       | -                 | Post-MVP에서 자동화  |

---

## 2. 컨테이너 & 컴퓨트

### 2.1 ECS Fargate 태스크

```
태스크 정의:
  - CPU: 512 (0.5 vCPU)
  - Memory: 1024 MB (1 GB)
  - 베이스 이미지: node:20-alpine
  - 포트: 3000 (Next.js 기본)
  - 로그 드라이버: awslogs (CloudWatch)

서비스 설정:
  - 원하는 태스크 수: 1
  - 배포 전략: Rolling Update
  - minimumHealthyPercent: 100
  - maximumPercent: 200
  - 헬스체크: GET /api/health → 200 OK
```

### 2.2 Dockerfile (멀티 스테이지 빌드)

```dockerfile
# Stage 1: 의존성 설치
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --only=production

# Stage 2: 빌드
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Stage 3: 실행
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# 보안: non-root 사용자
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
```

**next.config.ts 설정**:

```typescript
const nextConfig = {
  output: 'standalone', // 최소 번들 (node_modules 포함 없음)
  // ...
}
```

### 2.3 ECR 레포지토리

```
레포지토리 이름: moaring/app
이미지 태그 정책:
  - latest: 최신 프로덕션 이미지
  - {git-sha}: 특정 커밋 이미지 (롤백용)
이미지 스캔: 푸시 시 자동 취약점 스캔
수명 주기 정책: 최근 10개 이미지만 유지
```

---

## 3. 데이터베이스

### 3.1 Aurora PostgreSQL Serverless v2

```
클러스터 설정:
  - 엔진: Aurora PostgreSQL 15.x
  - 모드: Serverless v2
  - 최소 ACU: 0.5
  - 최대 ACU: 2
  - 리전: us-east-1

네트워크:
  - VPC 내 프라이빗 서브넷 배치
  - 보안 그룹: ECS 태스크 보안 그룹에서만 5432 포트 허용
  - 퍼블릭 접근: 비활성화

백업:
  - 자동 백업: 7일 보존
  - 스냅샷: 수동 (배포 전)
```

### 3.2 DB 연결 설정

```
DATABASE_URL 형식:
postgresql://{user}:{password}@{cluster-endpoint}:5432/moaring?
  connection_limit=10&
  pool_timeout=20&
  connect_timeout=10

connection_limit=10: ECS 태스크 1개 × 최대 10 연결
Aurora Serverless v2 max_connections: ACU × 90 ≈ 45 (0.5 ACU 기준)
→ 10 연결은 안전한 범위
```

### 3.3 DB 마이그레이션 전략

```
로컬 개발:
  npx prisma migrate dev

프로덕션 배포:
  1. ECS 태스크 배포 전 마이그레이션 실행
  2. 방법: ECS 태스크 정의에 마이그레이션 컨테이너 추가 (one-off task)
     또는 GitHub Actions에서 prisma migrate deploy 실행 (수동 배포 시 로컬에서)
  3. 명령: npx prisma migrate deploy (프로덕션 전용, 롤백 없음)
```

---

## 4. 인증 — Amazon Cognito

### 4.1 User Pool 설정

```
User Pool 설정:
  - 로그인 방식: 이메일 + 비밀번호
  - 이메일 인증: 필수 (가입 후 코드 입력)
  - 비밀번호 정책: 최소 8자, 대소문자+숫자 포함
  - MFA: 비활성화 (MVP)
  - 이메일 발신: Cognito 기본 이메일 (50건/일 제한)

App Client 설정:
  - 클라이언트 시크릿: 없음 (SPA/서버 사이드 모두 사용)
  - 인증 흐름: USER_PASSWORD_AUTH, REFRESH_TOKEN_AUTH
  - Access Token 만료: 1시간
  - Refresh Token 만료: 30일
  - ID Token 만료: 1시간

JWKS 엔드포인트:
  https://cognito-idp.us-east-1.amazonaws.com/{userPoolId}/.well-known/jwks.json
```

### 4.2 Cognito와 Next.js 연동

```
웹앱 (Server Action):
  - @aws-sdk/client-cognito-identity-provider 사용
  - InitiateAuth → AccessToken + RefreshToken → HttpOnly Cookie 저장

Middleware (Edge Runtime):
  - jose 라이브러리로 JWT 서명 검증
  - JWKS 공개키 캐싱 (모듈 레벨)

Chrome Extension:
  - Cognito Hosted UI 또는 직접 API 호출
  - chrome.storage.local에 토큰 저장
```

---

## 5. 스토리지 — S3 + CloudFront

### 5.1 S3 버킷

```
버킷 이름: moaring-assets-{account-id}
리전: us-east-1

버킷 정책:
  - 퍼블릭 직접 접근: 차단 (Block Public Access 전체 활성화)
  - CloudFront OAC만 접근 허용

디렉토리 구조:
  users/{userId}/collection-image/{nanoid}.{ext}
  users/{userId}/thumbnail/{nanoid}.{ext}

CORS 설정 (Pre-signed URL 업로드용):
  AllowedOrigins: [앱 도메인]
  AllowedMethods: [PUT]
  AllowedHeaders: [Content-Type]
  MaxAgeSeconds: 3600
```

### 5.2 CloudFront 배포

```
오리진 1: S3 버킷 (이미지/파일)
  - OAC (Origin Access Control) 설정
  - 캐시 정책: 1년 (이미지는 불변)

오리진 2: ALB (Next.js 앱)
  - 프로토콜: HTTPS
  - 캐시 정책: 없음 (동적 콘텐츠)
  - 헤더 전달: Host, Authorization, Cookie

도메인: *.cloudfront.net (커스텀 도메인 없음)

경로 라우팅:
  /users/*  → S3 오리진 (이미지)
  /*        → ALB 오리진 (Next.js 앱)

보안 헤더:
  - X-Content-Type-Options: nosniff
  - X-Frame-Options: DENY
  - Strict-Transport-Security: max-age=31536000
```

---

## 6. 네트워킹

### 6.1 VPC 구성 (1개 AZ)

```
VPC CIDR: 10.0.0.0/16
리전: us-east-1
AZ: us-east-1a (1개)

서브넷:
  퍼블릭 서브넷:  10.0.1.0/24  (ALB)
  프라이빗 서브넷: 10.0.2.0/24  (ECS, Aurora)

인터넷 게이트웨이: 퍼블릭 서브넷에 연결
NAT Gateway: ECS → 외부 인터넷 (OG fetch, Cognito API)
  - 비용: ~$35/월 (NAT Gateway 고정 비용)
  - 대안: VPC Endpoint (Cognito, S3) + NAT 없이 구성 (복잡도 증가)
  → NAT Gateway 사용 (단순성 우선)
```

### 6.2 보안 그룹

```
ALB 보안 그룹 (alb-sg):
  인바운드: 443 (HTTPS) from 0.0.0.0/0
  인바운드: 80 (HTTP) from 0.0.0.0/0 → 443으로 리다이렉트
  아웃바운드: 3000 to ecs-sg

ECS 보안 그룹 (ecs-sg):
  인바운드: 3000 from alb-sg
  아웃바운드: 443 to 0.0.0.0/0 (Cognito, S3 API)
  아웃바운드: 5432 to aurora-sg

Aurora 보안 그룹 (aurora-sg):
  인바운드: 5432 from ecs-sg
  아웃바운드: 없음
```

### 6.3 ALB 설정

```
리스너:
  - HTTP:80 → HTTPS:443 리다이렉트
  - HTTPS:443 → ECS 타겟 그룹

SSL 인증서: ACM (CloudFront 기본 도메인 사용이므로 ALB용 자체 서명 또는 ACM)
  → CloudFront가 HTTPS 종료를 담당하므로 ALB는 HTTP로 CloudFront와 통신 가능
  → 또는 ACM 인증서를 ALB에 적용 (ALB 직접 접근 시 HTTPS)

타겟 그룹:
  - 프로토콜: HTTP
  - 포트: 3000
  - 헬스체크: GET /api/health, 200 OK
  - 헬스체크 간격: 30초
```

---

## 7. 설정 관리 — AWS Parameter Store

### 7.1 파라미터 경로 구조

```
/moaring/prod/
  DATABASE_URL
  COGNITO_USER_POOL_ID
  COGNITO_CLIENT_ID
  COGNITO_REGION
  AWS_S3_BUCKET_NAME
  AWS_CLOUDFRONT_DOMAIN
  AWS_REGION
  NEXT_PUBLIC_APP_URL
```

### 7.2 ECS 태스크 정의에서 참조

```json
{
  "secrets": [
    {
      "name": "DATABASE_URL",
      "valueFrom": "arn:aws:ssm:us-east-1:{account}:parameter/moaring/prod/DATABASE_URL"
    }
  ]
}
```

**IAM 권한**: ECS Task Role에 `ssm:GetParameters` 권한 부여

---

## 8. 모니터링 & 로깅

### 8.1 CloudWatch Logs

```
로그 그룹: /ecs/moaring-app
보존 기간: 7일
로그 형식: JSON (구조화 로그)

ECS 로그 드라이버 설정:
  "logConfiguration": {
    "logDriver": "awslogs",
    "options": {
      "awslogs-group": "/ecs/moaring-app",
      "awslogs-region": "us-east-1",
      "awslogs-stream-prefix": "ecs"
    }
  }
```

### 8.2 CloudWatch 알람

```
MVP: 알람 없음 (로그 직접 확인)
Post-MVP 추가 예정:
  - ECS CPU 사용률 > 80%
  - ALB 5xx 에러율 > 5%
  - Aurora 연결 수 > 40
```

---

## 9. 배포 프로세스 (수동)

### 9.1 초기 배포 순서

```
1. AWS 인프라 프로비저닝 (Unit 1 CDK 실행)
   - VPC, 서브넷, 보안 그룹
   - Aurora 클러스터
   - Cognito User Pool
   - S3 버킷 + CloudFront
   - ALB + ECS 클러스터

2. DB 마이그레이션
   npx prisma migrate deploy

3. Docker 이미지 빌드 & ECR 푸시
   docker build -t moaring/app .
   docker tag moaring/app:latest {ecr-uri}:latest
   aws ecr get-login-password | docker login --username AWS --password-stdin {ecr-uri}
   docker push {ecr-uri}:latest

4. ECS 서비스 업데이트
   aws ecs update-service \
     --cluster moaring \
     --service moaring-app \
     --force-new-deployment
```

### 9.2 이후 배포 순서

```
1. (필요 시) DB 마이그레이션: npx prisma migrate deploy
2. Docker 이미지 빌드 & ECR 푸시 (새 태그)
3. ECS 서비스 업데이트 (Rolling Update 자동 실행)
4. CloudWatch Logs에서 에러 확인
```

---

## 10. 비용 추정 (월간, us-east-1)

| 서비스               | 사양                               | 예상 비용   |
| -------------------- | ---------------------------------- | ----------- |
| ECS Fargate          | 0.5 vCPU / 1GB × 1태스크 × 730시간 | ~$18        |
| Aurora Serverless v2 | 0.5~2 ACU (평균 0.5 ACU 가정)      | ~$7         |
| ALB                  | 기본 요금 + LCU                    | ~$18        |
| NAT Gateway          | 기본 요금 + 데이터 처리            | ~$35        |
| S3                   | 저장 + 요청 (소규모)               | ~$1         |
| CloudFront           | 데이터 전송 (소규모)               | ~$1         |
| ECR                  | 이미지 저장                        | ~$1         |
| CloudWatch Logs      | 7일 보존                           | ~$1         |
| Parameter Store      | Standard (무료)                    | $0          |
| Cognito              | MAU 50,000 이하 무료               | $0          |
| **합계**             |                                    | **~$82/월** |

> **참고**: NAT Gateway가 비용의 약 43%를 차지합니다. 비용 절감이 필요하면 VPC Endpoint(S3, Cognito)를 사용하고 NAT를 제거할 수 있지만 설정이 복잡해집니다.
