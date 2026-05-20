# Unit 1: Infrastructure — Deployment Architecture

> **작성일**: 2026-05-20  
> **용도**: Demo  
> **리전**: ap-northeast-2 (서울)

---

## 1. 전체 배포 아키텍처

```
┌─────────────────────────────────────────────────────────────────────┐
│  AWS ap-northeast-2 (서울)                                           │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  VPC: 10.0.0.0/16                                            │   │
│  │                                                              │   │
│  │  ┌──────────────────────────────────────────────────────┐  │   │
│  │  │  Public 서브넷 (2a, 2c)                               │  │   │
│  │  │                                                       │  │   │
│  │  │  ┌─────────────────────────────────────────────┐    │  │   │
│  │  │  │  ALB (moaring-alb)  HTTP:80                  │    │  │   │
│  │  │  │  alb-sg: 0.0.0.0/0 → TCP:80                 │    │  │   │
│  │  │  └──────────────────┬──────────────────────────┘    │  │   │
│  │  │                     │ TCP:3000                        │  │   │
│  │  │  NAT GW (2a) ───────┼──────────────────────────────  │  │   │
│  │  └─────────────────────┼──────────────────────────────┘  │   │
│  │                        │                                   │   │
│  │  ┌─────────────────────┼──────────────────────────────┐  │   │
│  │  │  Private 서브넷 (2a, 2c)                            │  │   │
│  │  │                     ▼                               │  │   │
│  │  │  ┌──────────────────────────────────────────────┐  │  │   │
│  │  │  │  ECS Fargate Task (moaring-app)               │  │  │   │
│  │  │  │  512 CPU / 1024 MB  Port:3000                 │  │  │   │
│  │  │  │  ecs-sg: alb-sg → TCP:3000                    │  │  │   │
│  │  │  └──────────────────────┬───────────────────────┘  │  │   │
│  │  │                         │ TCP:5432                   │  │   │
│  │  │  ┌──────────────────────▼───────────────────────┐  │  │   │
│  │  │  │  Aurora PostgreSQL Serverless v2              │  │  │   │
│  │  │  │  moaring-db  DB:moaring                       │  │  │   │
│  │  │  │  db-sg: ecs-sg → TCP:5432                     │  │  │   │
│  │  │  └──────────────────────────────────────────────┘  │  │   │
│  │  └────────────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  AWS 관리형 서비스 (리전 내, VPC 외부)                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │  Cognito     │  │  ECR         │  │  Secrets Manager         │  │
│  │  User Pool   │  │  moaring-app │  │  DB 자격증명             │  │
│  └──────────────┘  └──────────────┘  └──────────────────────────┘  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │  Parameter   │  │  CloudWatch  │  │  S3 Bucket               │  │
│  │  Store       │  │  Logs        │  │  moaring-storage-*       │  │
│  └──────────────┘  └──────────────┘  └──────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘

AWS 글로벌 엣지 (CloudFront)
┌─────────────────────────────────────────────────────────────────────┐
│  CloudFront Distribution (PRICE_CLASS_100)                          │
│  Origin: S3 Bucket (OAC)                                            │
│  → 브라우저에서 이미지/파일 직접 접근                                │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. 배포 파이프라인

### 2.1 최초 배포 순서

```
[로컬 머신]

Step 1: 전제 조건 확인
  ├── AWS CLI v2 설치 + aws configure (계정 자격증명)
  ├── Node.js 20.x LTS
  ├── CDK CLI: npm install -g aws-cdk
  └── Docker (ECR 이미지 빌드용)

Step 2: CDK Bootstrap (최초 1회)
  └── cdk bootstrap aws://{account}/ap-northeast-2

Step 3: 인프라 배포
  └── cd infra && cdk deploy --all
      배포 순서 (CDK 자동 관리):
      1. NetworkStack
      2. DatabaseStack
      3. AuthStack
      4. StorageStack
      5. AppStack      ← ECR 레포지토리 생성됨
      6. ConfigStack

Step 4: 컨테이너 이미지 빌드 & Push
  ├── docker build -t moaring-app .
  ├── aws ecr get-login-password | docker login --username AWS --password-stdin {ecr-uri}
  └── docker tag moaring-app:latest {ecr-uri}/moaring-app:{git-sha}
      docker push {ecr-uri}/moaring-app:{git-sha}

Step 5: ECS 서비스 업데이트
  └── aws ecs update-service \
        --cluster moaring-cluster \
        --service moaring-service \
        --force-new-deployment
      (새 태스크 시작 → prisma migrate deploy 자동 실행 → 앱 시작)

Step 6: 배포 확인
  └── ALB DNS: http://{alb-dns-name}
      (AWS Console → EC2 → Load Balancers에서 DNS 확인)
```

### 2.2 이후 배포 (코드 변경 시)

```
Step 1: 이미지 빌드 & Push (Step 4와 동일)
Step 2: ECS 서비스 업데이트 (Step 5와 동일)
  └── minimumHealthyPercent: 0 → 구 태스크 중단 후 새 태스크 시작
      (수십 초 다운타임 허용)
```

### 2.3 인프라 변경 시

```
cd infra
cdk diff    # 변경사항 미리 확인
cdk deploy --all
```

---

## 3. 스택 배포 의존성 그래프

```
NetworkStack (독립)
    │
    ├──► DatabaseStack
    │         │
    │         └──► AppStack ◄── AuthStack (독립)
    │                      ◄── StorageStack (독립)
    │                           │
    └──────────────────────────►└──► ConfigStack
```

CDK가 의존성을 자동 감지하여 올바른 순서로 배포합니다.  
`cdk deploy --all` 한 번으로 전체 배포 가능.

---

## 4. 인프라 정리 (demo 종료 시)

```bash
# 전체 리소스 삭제
cd infra && cdk destroy --all

# 삭제 순서 (CDK 자동 관리, 역순)
# ConfigStack → AppStack → StorageStack → AuthStack → DatabaseStack → NetworkStack

# ⚠️ 주의사항:
# - Aurora 클러스터: 스냅샷 없이 즉시 삭제 (skipFinalSnapshot: true)
# - S3 버킷: 객체 포함 삭제 (autoDeleteObjects: true)
# - Cognito User Pool: 사용자 데이터 영구 삭제
# - ECR: 이미지 포함 삭제
```

---

## 5. 로컬 개발 환경 vs AWS 배포 환경

| 항목 | 로컬 개발 | AWS 배포 (demo) |
|------|-----------|-----------------|
| 실행 방법 | `npm run dev` | ECS Fargate |
| DB | Docker Compose PostgreSQL | Aurora Serverless v2 |
| DB 연결 | `.env.local` `DATABASE_URL` | Secrets Manager → 환경변수 조합 |
| 인증 | 실제 Cognito (로컬에서도 연결) | 동일 Cognito |
| 파일 저장 | 로컬 또는 실제 S3 | S3 + CloudFront |
| 환경변수 | `.env.local` | Parameter Store + Secrets Manager |
| 로그 | 콘솔 출력 | CloudWatch Logs |
| 접근 URL | `http://localhost:3000` | `http://{alb-dns-name}` |

---

## 6. 운영 참고 명령어

```bash
# ECS 태스크 목록 확인
aws ecs list-tasks --cluster moaring-cluster

# ECS Exec으로 컨테이너 접속 (DB 디버깅)
aws ecs execute-command \
  --cluster moaring-cluster \
  --task {task-id} \
  --container moaring-app \
  --interactive \
  --command "/bin/sh"

# 로그 레벨 변경 (재배포 필요)
aws ssm put-parameter --name "/moaring/prod/log-level" --value "debug" --overwrite
aws ecs update-service --cluster moaring-cluster --service moaring-service --force-new-deployment

# ALB DNS 확인
aws elbv2 describe-load-balancers --names moaring-alb \
  --query 'LoadBalancers[0].DNSName' --output text

# Aurora 연결 확인 (컨테이너 내부에서)
psql postgresql://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME
```
