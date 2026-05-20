# Unit 1: Infrastructure — Business Logic Model

> **작성일**: 2026-05-20  
> **용도**: Demo  
> **기술 스택**: AWS CDK (TypeScript)

---

## 1. 인프라 프로비저닝 흐름

CDK 앱은 `bin/moaring.ts`를 진입점으로 스택을 순서대로 생성하고, 각 스택 객체를 다음 스택에 직접 전달합니다.

```
bin/moaring.ts
    │
    ├─► NetworkStack          (VPC, 서브넷, 보안 그룹, NAT Gateway)
    │       │ vpc, privateSubnets, publicSubnets
    │       ▼
    ├─► DatabaseStack         (Aurora PostgreSQL Serverless v2)
    │       │ cluster, dbSecret
    │       ▼
    ├─► AuthStack             (Cognito User Pool + App Client)
    │       │ userPool, userPoolClient
    │       ▼
    ├─► StorageStack          (S3 + CloudFront)
    │       │ bucket, distribution
    │       ▼
    ├─► AppStack              (ECR + ECS/Fargate + ALB)
    │       │ (모든 이전 스택 참조)
    │       ▼
    └─► ConfigStack           (Parameter Store)
            (모든 스택의 출력값 저장)
```

---

## 2. 스택별 책임 및 로직

### 2.1 NetworkStack

**책임**: 모든 AWS 리소스가 배치될 네트워크 기반 구성

**구성 로직**:
- VPC: `10.0.0.0/16`, 2 AZ
- Public 서브넷 2개: ALB 배치용 (인터넷 게이트웨이 직접 연결)
- Private 서브넷 2개: ECS + Aurora 공용 (NAT Gateway 경유 아웃바운드)
- NAT Gateway: 1개 (단일 AZ, demo 비용 절감)
- 보안 그룹 3개:
  - `alb-sg`: 인바운드 HTTP(80) 허용 (0.0.0.0/0)
  - `ecs-sg`: 인바운드 ALB에서 3000 포트만 허용
  - `db-sg`: 인바운드 ECS에서 5432 포트만 허용

**출력**: `vpc`, `privateSubnets`, `publicSubnets`, `albSg`, `ecsSg`, `dbSg`

---

### 2.2 DatabaseStack

**책임**: Aurora PostgreSQL Serverless v2 클러스터 프로비저닝

**구성 로직**:
- 엔진: Aurora PostgreSQL 15.x
- 인스턴스: Writer 1개 (Serverless v2)
- ACU: Min 0.5 / Max 4
- 서브넷 그룹: NetworkStack의 Private 서브넷
- 보안 그룹: `db-sg`
- 자격증명: Secrets Manager 자동 생성 (username: `moaring_admin`)
- 백업 보존: 1일 (demo)
- 삭제 정책: `DESTROY` (demo — CDK destroy 시 DB도 삭제)

**출력**: `cluster` (엔드포인트, 포트), `dbSecret` (Secrets Manager ARN)

---

### 2.3 AuthStack

**책임**: Cognito User Pool 및 App Client 구성

**구성 로직**:
- User Pool 설정:
  - 로그인 식별자: 이메일
  - 이메일 인증: 필수 (Cognito 기본 이메일, MVP)
  - 비밀번호 정책: 최소 8자, 대소문자+숫자 필수
  - MFA: 없음
  - 자동 검증: 이메일
- App Client 설정:
  - 인증 플로우: `USER_PASSWORD_AUTH`, `REFRESH_TOKEN_AUTH`
  - Access Token 만료: 1시간
  - Refresh Token 만료: 30일
  - ID Token 만료: 1시간
  - Secret 없음 (SPA/Extension에서 직접 호출)

**출력**: `userPool` (ID, ARN), `userPoolClient` (Client ID)

---

### 2.4 StorageStack

**책임**: S3 버킷 + CloudFront CDN 구성

**구성 로직**:
- S3 버킷:
  - 퍼블릭 직접 접근 차단 (Block Public Access 전체 활성화)
  - CORS 설정: `PUT`, `GET` 허용 (Pre-signed URL 업로드용)
  - 삭제 정책: `DESTROY` + `autoDeleteObjects: true` (demo)
- CloudFront:
  - Origin: S3 버킷 (OAC — Origin Access Control)
  - 캐시 정책: 기본 TTL 86400초(1일), 최대 31536000초(1년)
  - 뷰어 프로토콜: HTTP and HTTPS (demo — HTTPS 강제 없음)
  - 가격 등급: `PriceClass.PRICE_CLASS_100` (미국+유럽, 비용 절감)

**출력**: `bucket` (이름, ARN), `distribution` (도메인, ID)

---

### 2.5 AppStack

**책임**: ECR 레지스트리 + ECS 클러스터 + Fargate 서비스 + ALB 구성

**구성 로직**:

**ECR**:
- 레포지토리: `moaring-app`
- 이미지 보존: 최신 5개 (LifecycleRule)
- 삭제 정책: `DESTROY` (demo)

**ECS 클러스터**:
- 클러스터명: `moaring-cluster`
- Container Insights: 비활성화 (demo 비용 절감)

**Task Definition**:
- CPU: 512 / Memory: 1024 MB
- 네트워크 모드: `awsvpc`
- 컨테이너 포트: 3000
- 환경변수: Parameter Store에서 ECS Task 시작 시 주입
- 로그: CloudWatch Logs (`/ecs/moaring`, 보존 7일)

**ECS Service**:
- 태스크 수: 1 (고정, Auto Scaling 없음)
- 배포 방식: Rolling update
- `minimumHealthyPercent: 0` (태스크 1개 환경에서 배포 중단 방지 — 기본값 100%면 배포 불가)
- `maximumPercent: 200`
- 헬스체크 유예 기간: 60초

**ALB**:
- 서브넷: Public 서브넷
- 보안 그룹: `alb-sg`
- 리스너: HTTP(80)
- 타겟 그룹: ECS 서비스, 포트 3000
- 헬스체크: `GET /api/health`, 정상 임계값 2회, 간격 30초

**IAM Task Execution Role 권한** (ECS 에이전트가 사용):
- `ecr:GetAuthorizationToken`, `ecr:BatchGetImage`, `ecr:GetDownloadUrlForLayer` — ECR 이미지 pull
- `logs:CreateLogStream`, `logs:PutLogEvents` — CloudWatch Logs 쓰기
- `secretsmanager:GetSecretValue` — DB 자격증명 조회 (Task Definition Secrets 주입용)

**IAM Task Role 권한** (앱 코드가 사용):
- `ssm:GetParameters` — Parameter Store 읽기 (비민감 설정값)
- `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject` — S3 버킷 접근

**출력**: `alb` (DNS명), `ecrRepository` (URI), `ecsService`

---

### 2.6 ConfigStack

**책임**: 모든 스택 출력값을 Parameter Store에 저장하고, DB 자격증명을 ECS Task Definition에 직접 연결

**저장 항목** (Parameter Store — 비민감 설정값만):

| 파라미터 경로 | 타입 | 값 |
|---|---|---|
| `/moaring/prod/cognito-user-pool-id` | String | Cognito User Pool ID |
| `/moaring/prod/cognito-client-id` | String | App Client ID |
| `/moaring/prod/s3-bucket-name` | String | S3 버킷명 |
| `/moaring/prod/cloudfront-domain` | String | CloudFront 도메인 |
| `/moaring/prod/aws-region` | String | 배포 리전 |

> **DB 연결 문자열은 Parameter Store에 저장하지 않습니다.**  
> Secrets Manager가 자동 생성한 DB 자격증명을 ECS Task Definition의 `secrets` 필드에서 직접 참조합니다.  
> ECS 에이전트가 태스크 시작 시 Secrets Manager에서 값을 읽어 `DATABASE_URL` 환경변수로 주입합니다.

---

## 3. 스택 배포 순서

CDK가 의존성을 자동 감지하지만, 명시적 순서는 다음과 같습니다:

```
1. NetworkStack
2. DatabaseStack   (NetworkStack 필요)
3. AuthStack       (독립적이나 논리적 순서)
4. StorageStack    (독립적이나 논리적 순서)
5. AppStack        (Network + Database + Auth + Storage 필요)
6. ConfigStack     (모든 스택 출력값 필요)
```

`cdk deploy --all` 한 번으로 전체 배포 가능.

---

## 4. 로컬 개발 vs 배포 환경 분리

| 항목 | 로컬 개발 | AWS 배포 (demo) |
|------|-----------|-----------------|
| DB | Docker Compose PostgreSQL | Aurora Serverless v2 |
| 인증 | 실제 Cognito (로컬에서도 연결) | 동일 Cognito |
| 파일 저장 | 로컬 파일시스템 또는 실제 S3 | S3 + CloudFront |
| 환경변수 | `.env.local` | Parameter Store → ECS 환경변수 |
| 실행 | `npm run dev` | ECS/Fargate |
