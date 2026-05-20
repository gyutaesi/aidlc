# moaring Infrastructure

> moaring AWS CDK 인프라 코드 (demo 용도)  
> 리전: `ap-northeast-2` (서울)

---

## 구성

6개 CDK 스택으로 구성되며, 모두 단일 AWS 계정/리전에 배포됩니다.

| 스택 | 리소스 |
|------|--------|
| `moaring-prod-network` | VPC, 서브넷, 보안 그룹, NAT Gateway |
| `moaring-prod-database` | Aurora PostgreSQL Serverless v2, Secrets Manager |
| `moaring-prod-auth` | Cognito User Pool + App Client |
| `moaring-prod-storage` | S3 버킷 + CloudFront |
| `moaring-prod-app` | ECR + ECS Cluster + ALB + Fargate Service + CloudWatch Logs |
| `moaring-prod-config` | Parameter Store 파라미터 |

---

## 전제 조건

| 도구 | 버전 |
|------|------|
| Node.js | 20.x LTS 이상 |
| AWS CLI | v2 (자격증명 설정 완료) |
| AWS CDK CLI | v2 — `npm install -g aws-cdk` |
| Docker | ECR 이미지 빌드/push용 |

AWS CLI 자격증명 확인:
```bash
aws sts get-caller-identity
```

---

## 최초 배포

### 1. 의존성 설치

```bash
cd infra
npm install
```

### 2. CDK Bootstrap (계정/리전당 1회)

```bash
cdk bootstrap aws://$(aws sts get-caller-identity --query Account --output text)/ap-northeast-2
```

### 3. CDK 합성 확인 (선택)

```bash
npm run synth
```

### 4. 인프라 배포

```bash
npm run deploy
# 또는: cdk deploy --all
```

배포 시간: 약 15~25분 (Aurora 클러스터 생성이 가장 오래 걸림).

### 5. 배포 결과 확인

배포 완료 후 출력되는 주요 값:
- `moaring-prod-app.AlbUrl` — 앱 접근 URL
- `moaring-prod-app.EcrRepositoryUri` — Docker 이미지 push 대상
- `moaring-prod-auth.UserPoolId` — Cognito User Pool ID
- `moaring-prod-auth.UserPoolClientId` — App Client ID

### 6. 컨테이너 이미지 빌드 & Push

ECR 레포지토리가 생성되었으므로, Unit 2(Next.js 앱) 빌드 후 push:

```bash
# 워크스페이스 루트에서
ECR_URI=$(aws ecr describe-repositories --repository-names moaring-app \
  --query 'repositories[0].repositoryUri' --output text)

# Docker login
aws ecr get-login-password --region ap-northeast-2 | \
  docker login --username AWS --password-stdin $ECR_URI

# 빌드 & 태그 & push
docker build -t moaring-app .
docker tag moaring-app:latest $ECR_URI:latest
docker push $ECR_URI:latest
```

### 7. ECS 서비스 업데이트 (이미지 push 후)

```bash
aws ecs update-service \
  --cluster moaring-cluster \
  --service moaring-service \
  --force-new-deployment
```

새 태스크가 시작되면서 `prisma migrate deploy`가 자동 실행됩니다.

---

## 일상 운영 명령어

### 인프라 변경 미리보기

```bash
npm run diff
```

### 부분 배포 (특정 스택)

```bash
cdk deploy moaring-prod-app
```

### ECS 컨테이너 직접 접속 (디버깅, DB 쿼리)

```bash
TASK_ID=$(aws ecs list-tasks --cluster moaring-cluster \
  --service-name moaring-service --query 'taskArns[0]' --output text | awk -F'/' '{print $NF}')

aws ecs execute-command \
  --cluster moaring-cluster \
  --task $TASK_ID \
  --container moaring-app \
  --interactive \
  --command "/bin/sh"

# 컨테이너 내부에서 DB 접속
psql postgresql://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME
```

### 로그 레벨 변경 (재배포 필요)

```bash
aws ssm put-parameter \
  --name "/moaring/prod/log-level" \
  --value "debug" \
  --overwrite

aws ecs update-service \
  --cluster moaring-cluster \
  --service moaring-service \
  --force-new-deployment
```

### 로그 확인

```bash
aws logs tail /ecs/moaring --follow
```

---

## 인프라 정리 (demo 종료 시)

```bash
npm run destroy
# 또는: cdk destroy --all
```

⚠️ **주의사항**:
- Aurora 클러스터는 스냅샷 없이 즉시 삭제됩니다 (`skipFinalSnapshot: true`)
- S3 버킷의 객체가 모두 삭제됩니다 (`autoDeleteObjects: true`)
- Cognito User Pool의 모든 사용자 데이터가 영구 삭제됩니다
- ECR 이미지가 모두 삭제됩니다

---

## 디렉토리 구조

```
infra/
├── bin/
│   └── moaring.ts          # CDK App 진입점
├── lib/
│   ├── config.ts           # 모든 설정 상수 (스펙 변경은 여기서)
│   ├── network-stack.ts    # VPC, 서브넷, 보안 그룹
│   ├── database-stack.ts   # Aurora PostgreSQL
│   ├── auth-stack.ts       # Cognito User Pool
│   ├── storage-stack.ts    # S3 + CloudFront
│   ├── app-stack.ts        # ECR + ECS + ALB
│   └── config-stack.ts     # Parameter Store
├── package.json
├── tsconfig.json
├── cdk.json
└── README.md
```

---

## 예상 비용 (demo 상시 운영 기준)

| 서비스 | 월 비용 |
|--------|---------|
| ECS Fargate (512 CPU / 1 GB) | ~$15 |
| Aurora Serverless v2 (Min 0.5 ACU) | ~$43 |
| NAT Gateway | ~$32 |
| ALB | ~$16 |
| CloudFront + S3 | ~$2 |
| CloudWatch Logs | ~$1 |
| **합계** | **~$109/월** |

미사용 시 `cdk destroy --all`로 모두 삭제하면 비용 0.

---

## 트러블슈팅

### CDK Bootstrap 실패
- IAM 권한이 부족할 수 있습니다. `AdministratorAccess` 권한이 있는 계정/사용자로 bootstrap 실행

### ECS 태스크가 RUNNING으로 전환되지 않음
1. CloudWatch Logs `/ecs/moaring` 확인
2. Prisma migrate 실패 가능성 확인
3. DB_HOST 등 환경변수 정상 주입 확인 (`aws ecs describe-tasks ...`)

### ALB 헬스체크 실패
- 앱이 `/api/health`에 200을 응답하는지 확인 (Unit 2에서 구현)
- `health check grace period`(60초) 동안 컨테이너가 시작되어야 함

### Aurora 첫 쿼리 지연
- Min ACU 0.5에서 스케일업 중 일시 지연 발생 가능
- demo 시연 5분 전 워밍업 쿼리 권장
