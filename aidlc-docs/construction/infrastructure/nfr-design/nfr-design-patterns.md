# Unit 1: Infrastructure — NFR Design Patterns

> **작성일**: 2026-05-20  
> **용도**: Demo

---

## 1. 복원력 패턴 (Resilience)

### RP-01: ECS 태스크 자동 교체 (기본 패턴)

**적용 대상**: ECS Fargate Service  
**패턴**: ALB 헬스체크 기반 자동 태스크 교체

```
[ALB 헬스체크] GET /api/health
      │
      ├─ 200 OK → 정상, 트래픽 유지
      │
      └─ 실패 (3회 연속, 30초 간격)
            │
            └─► ECS Service: 태스크 중단 → 새 태스크 시작
                  └─► 새 태스크 헬스체크 통과 후 트래픽 재개
```

**설정값**:
| 항목 | 값 |
|------|-----|
| 헬스체크 경로 | `GET /api/health` |
| 정상 임계값 | 2회 연속 성공 |
| 비정상 임계값 | 3회 연속 실패 |
| 헬스체크 간격 | 30초 |
| 헬스체크 유예 기간 | 60초 (태스크 시작 후 안정화 시간) |

---

### RP-02: Aurora 연결 풀 재시도 (Prisma 레벨)

**적용 대상**: ECS Task Definition 환경변수 (`DATABASE_URL`)  
**패턴**: Prisma connection pool 파라미터로 일시적 연결 실패 대응

```
DATABASE_URL=postgresql://user:pass@host:5432/moaring
             ?connection_limit=5
             &pool_timeout=10
             &connect_timeout=10
```

**파라미터 설명**:
| 파라미터 | 값 | 설명 |
|----------|-----|------|
| `connection_limit` | 5 | 최대 동시 DB 연결 수 (ECS 태스크 1개 기준) |
| `pool_timeout` | 10 | 연결 풀에서 연결 대기 최대 시간(초) |
| `connect_timeout` | 10 | DB 연결 시도 타임아웃(초) |

> Aurora Serverless v2 스케일업 중 일시적 연결 지연(수초)을 `pool_timeout`으로 흡수합니다.  
> 이 파라미터는 CDK ConfigStack에서 `DATABASE_URL` 구성 시 포함합니다.

---

### RP-03: Prisma migrate 실패 시 컨테이너 시작 중단

**적용 대상**: Dockerfile entrypoint  
**패턴**: 마이그레이션 실패 → 컨테이너 즉시 종료 → ECS가 재시작 시도

```dockerfile
# entrypoint.sh
#!/bin/sh
set -e  # 명령 실패 시 즉시 종료

echo "Running database migrations..."
npx prisma migrate deploy

echo "Starting application..."
exec node server.js
```

**동작 흐름**:
```
ECS 태스크 시작
    │
    ├─ prisma migrate deploy 성공 → node server.js 시작
    │
    └─ prisma migrate deploy 실패
          │
          └─► 컨테이너 종료 (exit code != 0)
                └─► ECS Service: 태스크 재시작 시도
                      └─► CloudWatch Logs에서 실패 원인 확인
```

---

## 2. 확장성 패턴 (Scalability)

### SP-01: CDK 설정 상수 분리 (`lib/config.ts`)

**적용 대상**: 모든 CDK 스택  
**패턴**: 스펙 변경 가능한 값을 단일 파일로 분리

```typescript
// infra/lib/config.ts
export const Config = {
  // 환경
  env: 'prod',
  region: 'ap-northeast-2',

  // Aurora
  aurora: {
    minAcu: 0.5,
    maxAcu: 4,
    backupRetentionDays: 1,
  },

  // ECS
  ecs: {
    cpu: 512,
    memoryLimitMiB: 1024,
    desiredCount: 1,
    minHealthyPercent: 0,
    maxHealthyPercent: 200,
  },

  // CloudFront (숫자만 저장, 스택에서 cdk.Duration으로 감쌈)
  cloudfront: {
    defaultTtlDays: 1,
    maxTtlDays: 365,
  },

  // ECR
  ecr: {
    maxImageCount: 5,
  },

  // Cognito (숫자만 저장, 스택에서 cdk.Duration으로 감쌈)
  cognito: {
    accessTokenValidityMinutes: 60,
    refreshTokenValidityDays: 30,
    idTokenValidityMinutes: 60,
  },

  // 태그
  tags: {
    Project: 'moaring',
    Environment: 'prod',
    ManagedBy: 'cdk',
  },
} as const
```

**효과**: 스펙 변경 시 `config.ts` 한 파일만 수정 후 `cdk deploy --all` 실행.

> `cdk.Duration` 같은 CDK 타입은 각 스택에서 감싸서 사용합니다:  
> ```typescript
> // StorageStack에서
> defaultTtl: cdk.Duration.days(Config.cloudfront.defaultTtlDays)
> // AuthStack에서
> accessTokenValidity: cdk.Duration.minutes(Config.cognito.accessTokenValidityMinutes)
> ```

---

## 3. 성능 패턴 (Performance)

### PP-01: CloudFront 압축 활성화

**적용 대상**: CloudFront Distribution  
**패턴**: Gzip/Brotli 자동 압축

```typescript
// StorageStack
new cloudfront.Distribution(this, 'Distribution', {
  defaultBehavior: {
    compress: true,  // Gzip/Brotli 자동 압축 (기본값 true)
    // ...
  },
})
```

**효과**: JSON API 응답, HTML 등 텍스트 콘텐츠 전송 크기 60~80% 감소.

---

### PP-02: 로그 레벨 환경변수 제어

**적용 대상**: ECS Task Definition 환경변수 + Parameter Store  
**패턴**: 재배포 없이 로그 레벨 동적 변경

```
Parameter Store: /moaring/prod/log-level = "info"
      │
      └─► ECS Task 시작 시 LOG_LEVEL=info 환경변수로 주입
            └─► 앱 코드: process.env.LOG_LEVEL 참조
```

**운영 절차**:
```bash
# 디버깅 필요 시 — 재배포 없이 로그 레벨 변경
aws ssm put-parameter \
  --name "/moaring/prod/log-level" \
  --value "debug" \
  --overwrite

# 새 태스크 강제 시작 (로그 레벨 반영)
aws ecs update-service \
  --cluster moaring-cluster \
  --service moaring-service \
  --force-new-deployment
```

> Parameter Store 값 변경만으로는 실행 중인 태스크에 즉시 반영되지 않습니다.  
> `force-new-deployment`로 새 태스크를 시작해야 합니다.

---

## 4. 보안 패턴 (Security)

### SEP-01: S3 Pre-signed URL 단기 만료

**적용 대상**: StorageService (앱 코드) — 인프라 설계 가이드  
**패턴**: 업로드용 Pre-signed URL 5분 만료

```typescript
// StorageService (앱 코드 참조용)
const command = new PutObjectCommand({
  Bucket: process.env.S3_BUCKET_NAME,
  Key: `users/${userId}/${type}/${uuid}.${ext}`,
})
const uploadUrl = await getSignedUrl(s3Client, command, {
  expiresIn: 300,  // 5분 (300초)
})
```

**보안 원칙**:
- Pre-signed URL은 발급 즉시 클라이언트에 전달하고 서버에 저장하지 않음
- URL 만료 후 재업로드 시 새 Pre-signed URL 재발급
- S3 버킷 자체는 퍼블릭 접근 차단 유지

---

### SEP-02: 보안 그룹 체인 (최소 인바운드 원칙)

**적용 대상**: NetworkStack 보안 그룹  
**패턴**: 소스 IP 범위 대신 보안 그룹 ID를 소스로 사용

```
인터넷 (0.0.0.0/0)
    │ HTTP:80
    ▼
[alb-sg]
    │ TCP:3000 (소스: alb-sg)
    ▼
[ecs-sg]
    │ TCP:5432 (소스: ecs-sg)
    ▼
[db-sg]
```

**효과**: IP 범위 변경 없이 보안 그룹 멤버십으로 접근 제어. ECS 태스크 IP가 바뀌어도 규칙 수정 불필요.

---

### SEP-03: ECS Exec 활성화 (개발용 DB 접근)

**적용 대상**: ECS Service + Task Role  
**패턴**: SSM Session Manager를 통한 컨테이너 직접 접속

> ⚠️ **전제 조건**: ECS Exec은 컨테이너 이미지 안에 SSM Agent가 설치되어 있어야 동작합니다.  
> `node:alpine` 같은 경량 이미지에는 SSM Agent가 없으므로 ECS Exec이 동작하지 않습니다.  
> Next.js Dockerfile은 `node:20-slim` (Debian 기반) 또는 `amazonlinux` 베이스 이미지를 사용하거나,  
> alpine 기반이라면 `apk add --no-cache aws-ssm-agent` 로 SSM Agent를 직접 설치해야 합니다.  
> **권장**: `node:20-slim` 베이스 이미지 사용 (SSM Agent 설치 가능, alpine 대비 이미지 크기 적당)

```typescript
// AppStack
const service = new ecs.FargateService(this, 'Service', {
  // ...
  enableExecuteCommand: true,  // ECS Exec 활성화
})

// Task Role에 ssmmessages 권한 추가
taskRole.addToPolicy(new iam.PolicyStatement({
  actions: [
    'ssmmessages:CreateControlChannel',
    'ssmmessages:CreateDataChannel',
    'ssmmessages:OpenControlChannel',
    'ssmmessages:OpenDataChannel',
  ],
  resources: ['*'],
}))
```

---

## 5. 패턴 적용 요약

| 패턴 ID | 패턴명 | 적용 위치 | 복잡도 |
|---------|--------|-----------|--------|
| RP-01 | ECS 태스크 자동 교체 | ALB + ECS Service | 낮음 (기본 동작) |
| RP-02 | Aurora 연결 풀 재시도 | DATABASE_URL 파라미터 | 낮음 (URL 파라미터) |
| RP-03 | 마이그레이션 실패 중단 | Dockerfile entrypoint | 낮음 (set -e) |
| SP-01 | CDK 설정 상수 분리 | lib/config.ts | 낮음 |
| PP-01 | CloudFront 압축 | CloudFront Distribution | 없음 (기본값) |
| PP-02 | 로그 레벨 환경변수 | Parameter Store + ECS | 낮음 |
| SEP-01 | Pre-signed URL 단기 만료 | StorageService (앱 코드) | 없음 |
| SEP-02 | 보안 그룹 체인 | NetworkStack | 낮음 |
| SEP-03 | ECS Exec 활성화 | AppStack | 낮음 |
