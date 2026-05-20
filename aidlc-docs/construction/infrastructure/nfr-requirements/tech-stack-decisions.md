# Unit 1: Infrastructure — Tech Stack Decisions

> **작성일**: 2026-05-20  
> **용도**: Demo

---

## 1. 핵심 기술 스택 결정

| 레이어 | 선택 | 버전/스펙 | 결정 근거 |
|--------|------|-----------|-----------|
| IaC 도구 | AWS CDK | v2 (latest) | TypeScript 타입 안전, 앱 코드와 동일 언어 |
| CDK 언어 | TypeScript | 5.x | 프로젝트 전체 TypeScript 통일 |
| 컨테이너 런타임 | ECS Fargate | — | 서버 관리 불필요, demo에 적합 |
| 데이터베이스 | Aurora PostgreSQL Serverless v2 | PostgreSQL 15.x | 자동 스케일링, 미사용 시 비용 절감 |
| 인증 | Amazon Cognito User Pool | — | JWT 발급/검증 내장, 이메일 인증 기본 제공 |
| 파일 저장 | Amazon S3 + CloudFront | — | OAC 보안, CDN 캐싱 |
| 로드밸런서 | ALB (Application Load Balancer) | — | ECS 헬스체크 통합, HTTP 리스너 |
| 컨테이너 레지스트리 | Amazon ECR | — | ECS와 네이티브 통합 |
| 설정 관리 | AWS Parameter Store | — | 비민감 설정값 중앙 관리 |
| 자격증명 관리 | AWS Secrets Manager | — | DB 비밀번호 자동 생성/로테이션 |
| 로그 | Amazon CloudWatch Logs | — | ECS Fargate 기본 로그 드라이버 |

---

## 2. 주요 결정 사항 및 근거

### TSD-01: AWS CDK v2 (TypeScript)
- **결정**: CDK v2 TypeScript
- **대안**: Terraform, CloudFormation YAML, Pulumi
- **근거**: 프로젝트 전체가 TypeScript이므로 동일 언어로 인프라 코드 작성. CDK v2는 단일 패키지(`aws-cdk-lib`)로 의존성 관리 단순. Terraform 대비 AWS 네이티브 타입 지원이 우수.

### TSD-02: ECS Fargate (서버리스 컨테이너)
- **결정**: ECS Fargate
- **대안**: EC2, EKS, App Runner
- **근거**: 서버 패치/관리 불필요. demo 규모(태스크 1개)에서 EC2보다 비용 효율적. App Runner 대비 ALB 통합, 보안 그룹 제어가 유연. EKS는 demo에 과잉.

### TSD-03: Aurora Serverless v2 (PostgreSQL 15)
- **결정**: Aurora Serverless v2, Min 0.5 / Max 4 ACU
- **대안**: RDS PostgreSQL (프로비저닝), Aurora Serverless v1
- **근거**: 미사용 시 최소 ACU로 비용 절감. v1 대비 스케일링 속도 빠름(수초). 프로비저닝 RDS 대비 demo 트래픽 패턴(간헐적 사용)에 유리. PostgreSQL 15는 Prisma 완전 지원.

### TSD-04: Secrets Manager (DB 자격증명)
- **결정**: Secrets Manager → ECS Task Definition secrets 직접 참조
- **대안**: Parameter Store SecureString, 환경변수 하드코딩
- **근거**: CDK가 자동으로 비밀번호 생성/관리. ECS Task Definition의 `secrets` 필드로 런타임 주입 — 코드나 Parameter Store에 평문/암호화 불문 DB URL 저장 불필요. Parameter Store SecureString 대비 자동 로테이션 지원(미사용이지만 구조적으로 올바름).

### TSD-05: CloudFront OAC (Origin Access Control)
- **결정**: OAC 사용
- **대안**: OAI (Origin Access Identity, 구형)
- **근거**: AWS가 OAI를 deprecated 예정으로 OAC 사용 권장. sigv4 서명으로 보안 강화. CDK `S3Origin` + `OriginAccessIdentity` 대신 `S3BucketOrigin.withOriginAccessControl()` 사용.

### TSD-06: SSM Session Manager (DB 직접 접근)
- **결정**: ECS Exec + SSM Session Manager
- **대안**: Bastion Host (EC2), VPN
- **근거**: 추가 EC2 비용 없음. ECS Exec으로 실행 중인 컨테이너에 직접 접속해 `psql` 실행 가능. Bastion Host 대비 관리 오버헤드 없음. ECS Service에 `enableExecuteCommand: true` 설정 + Task Role에 `ssmmessages:*` 4개 권한 추가 필요.

### TSD-07: Prisma migrate deploy (컨테이너 시작 시 자동 실행)
- **결정**: Dockerfile entrypoint에 마이그레이션 포함
- **대안**: 별도 마이그레이션 태스크, 수동 실행
- **근거**: demo에서 가장 단순한 방식. 배포 한 번으로 마이그레이션 + 앱 시작이 자동화됨. 마이그레이션 실패 시 컨테이너가 시작되지 않아 즉시 감지 가능.

---

## 3. 미사용 기술 및 이유

| 기술 | 미사용 이유 |
|------|------------|
| AWS WAF | demo 규모에서 불필요, 비용 추가 |
| AWS Certificate Manager (ACM) | HTTP만 사용 (demo), 도메인 없음 |
| Route 53 | 도메인 없음, ALB DNS 직접 사용 |
| CloudWatch Alarms / SNS | demo에서 알림 불필요 |
| ECS Auto Scaling | 태스크 1개 고정, demo 트래픽 수준 |
| Aurora Read Replica | demo 규모에서 불필요 |
| AWS Backup | demo 데이터는 재생성 가능 |
| GitHub Actions CI/CD | 로컬 cdk deploy로 충분 |
| Amazon SES | Cognito 기본 이메일 사용 (MVP) |
| VPC Flow Logs | demo에서 불필요, CloudWatch 비용 추가 |

---

## 4. CDK 패키지 의존성

```json
{
  "dependencies": {
    "aws-cdk-lib": "^2.x",
    "constructs": "^10.x"
  },
  "devDependencies": {
    "aws-cdk": "^2.x",
    "typescript": "^5.x",
    "@types/node": "^20.x",
    "ts-node": "^10.x"
  }
}
```

**사용 CDK 모듈** (`aws-cdk-lib` 내):
- `aws_ec2` — VPC, 서브넷, 보안 그룹, NAT Gateway
- `aws_rds` — Aurora Serverless v2
- `aws_cognito` — User Pool, App Client
- `aws_s3` — S3 버킷
- `aws_cloudfront`, `aws_cloudfront_origins` — CloudFront + OAC
- `aws_ecs` — ECS 클러스터, Task Definition, Fargate 서비스 (저수준 직접 구성)
- `aws_ecr` — ECR 레포지토리
- `aws_elasticloadbalancingv2` — ALB, 리스너, 타겟 그룹
- `aws_iam` — Task Role, Task Execution Role
- `aws_logs` — CloudWatch Logs 그룹
- `aws_ssm` — Parameter Store
- `aws_secretsmanager` — Secrets Manager 참조

> **`aws_ecs_patterns` 미사용**: ALB, ECS Service, Task Definition을 각각 저수준으로 직접 구성합니다. `minimumHealthyPercent: 0`, `enableExecuteCommand: true` 등 세부 설정을 정확히 제어하기 위함입니다.

---

## 5. 배포 전제 조건

| 항목 | 요구사항 |
|------|----------|
| AWS CLI | v2, 자격증명 설정 완료 (`aws configure`) |
| CDK CLI | `npm install -g aws-cdk` |
| Node.js | 20.x LTS |
| CDK Bootstrap | `cdk bootstrap aws://{account}/{region}` (최초 1회) |
| Docker | ECR 이미지 빌드/push용 |
