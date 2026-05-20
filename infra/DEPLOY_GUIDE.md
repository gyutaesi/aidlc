# moaring 배포 가이드

> 각 서비스별 배포 방법 및 순서

---

## 전제 조건

```bash
# AWS 자격증명 설정
export AWS_DEFAULT_REGION="us-east-1"
export AWS_ACCESS_KEY_ID="..."
export AWS_SECRET_ACCESS_KEY="..."
export AWS_SESSION_TOKEN="..."  # STS 임시 자격증명인 경우

# 확인
aws sts get-caller-identity
```

| 도구 | 설치 |
|------|------|
| Node.js 20+ | https://nodejs.org |
| AWS CDK CLI | `npm install -g aws-cdk` |
| Docker | https://docker.com |

---

## 1단계: CDK Bootstrap (최초 1회)

```bash
cd infra
npm install
cdk bootstrap aws://$(aws sts get-caller-identity --query Account --output text)/us-east-1
```

---

## 2단계: 인프라 배포

```bash
cd infra
npx cdk deploy --all --require-approval never
```

**배포되는 스택 (순서대로)**:
1. `moaring-prod-network` — VPC, 서브넷, 보안 그룹, NAT Gateway
2. `moaring-prod-database` — Aurora PostgreSQL Serverless v2
3. `moaring-prod-auth` — Cognito User Pool + App Client
4. `moaring-prod-storage` — S3 + CloudFront
5. `moaring-prod-config` — Parameter Store
6. `moaring-prod-app` — ECR + ECS Cluster + ALB + Fargate Service (desiredCount: 0)

> ⚠️ AppStack은 `desiredCount: 0`으로 배포됩니다. 컨테이너 이미지를 push한 후 태스크를 시작해야 합니다.

**소요 시간**: 약 15~20분 (Aurora 클러스터 생성이 가장 오래 걸림)

---

## 3단계: Next.js 앱 이미지 빌드 & Push (Unit 2 완료 후)

```bash
# ECR 레포지토리 URI 확인
ECR_URI=$(aws ecr describe-repositories --repository-names moaring-app \
  --query 'repositories[0].repositoryUri' --output text)

# Docker 로그인
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin $ECR_URI

# 워크스페이스 루트에서 빌드 (Dockerfile은 Unit 2에서 생성)
docker build -t moaring-app .
docker tag moaring-app:latest $ECR_URI:$(git rev-parse --short HEAD)
docker push $ECR_URI:$(git rev-parse --short HEAD)

# latest 태그도 push (ECS Task Definition이 참조)
docker tag moaring-app:latest $ECR_URI:latest
docker push $ECR_URI:latest
```

---

## 4단계: ECS 서비스 시작

```bash
# 태스크 수를 0 → 1로 변경
aws ecs update-service \
  --cluster moaring-cluster \
  --service moaring-service \
  --desired-count 1 \
  --force-new-deployment

# 태스크 시작 확인 (RUNNING 상태가 될 때까지)
aws ecs wait services-stable --cluster moaring-cluster --services moaring-service
echo "Service is stable!"
```

---

## 5단계: 배포 확인

```bash
# ALB URL 확인
ALB_URL=$(aws elbv2 describe-load-balancers --names moaring-alb \
  --query 'LoadBalancers[0].DNSName' --output text)
echo "App URL: http://$ALB_URL"

# 헬스체크 확인
curl http://$ALB_URL/api/health
```

---

## 개별 스택 재배포 (변경 시)

```bash
# 특정 스택만 배포
npx cdk deploy moaring-prod-app

# 변경사항 미리보기
npx cdk diff moaring-prod-app
```

---

## 코드 변경 후 재배포 (이후 배포)

```bash
# 1. 이미지 빌드 & push
docker build -t moaring-app .
docker tag moaring-app:latest $ECR_URI:$(git rev-parse --short HEAD)
docker push $ECR_URI:$(git rev-parse --short HEAD)
docker tag moaring-app:latest $ECR_URI:latest
docker push $ECR_URI:latest

# 2. ECS 서비스 업데이트 (새 이미지로 태스크 재시작)
aws ecs update-service \
  --cluster moaring-cluster \
  --service moaring-service \
  --force-new-deployment
```

---

## 인프라 정리 (demo 종료)

```bash
# ECS 서비스 태스크 먼저 0으로 (선택)
aws ecs update-service --cluster moaring-cluster --service moaring-service --desired-count 0

# 전체 삭제
cd infra
npx cdk destroy --all
```

⚠️ **삭제 시 주의**: Aurora DB, S3 객체, Cognito 사용자, ECR 이미지 모두 영구 삭제됩니다.

---

## 주요 출력값 확인

```bash
# Cognito User Pool ID
aws cloudformation describe-stacks --stack-name moaring-prod-auth \
  --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' --output text

# Cognito Client ID
aws cloudformation describe-stacks --stack-name moaring-prod-auth \
  --query 'Stacks[0].Outputs[?OutputKey==`UserPoolClientId`].OutputValue' --output text

# Aurora 엔드포인트
aws cloudformation describe-stacks --stack-name moaring-prod-database \
  --query 'Stacks[0].Outputs[?OutputKey==`ClusterEndpoint`].OutputValue' --output text

# CloudFront 도메인
aws cloudformation describe-stacks --stack-name moaring-prod-storage \
  --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontDomain`].OutputValue' --output text

# ECR 레포지토리 URI
aws cloudformation describe-stacks --stack-name moaring-prod-app \
  --query 'Stacks[0].Outputs[?OutputKey==`EcrRepositoryUri`].OutputValue' --output text

# ALB URL
aws cloudformation describe-stacks --stack-name moaring-prod-app \
  --query 'Stacks[0].Outputs[?OutputKey==`AlbUrl`].OutputValue' --output text
```

---

## 트러블슈팅

| 문제 | 해결 |
|------|------|
| AppStack 롤백 | `desiredCount: 0` 확인, 이미지 없으면 태스크 시작 실패 |
| Aurora 버전 에러 | `database-stack.ts`에서 `VER_15_8` 이상 사용 |
| ECS 태스크 STOPPED | `aws logs tail /ecs/moaring --follow`로 로그 확인 |
| ALB 503 | 태스크가 RUNNING인지 확인, 헬스체크 경로 `/api/health` 구현 필요 |
| CDK Bootstrap 실패 | IAM 권한 확인 (AdministratorAccess 필요) |
