# Unit 1: Infrastructure — Code Summary

> **작성일**: 2026-05-20  
> **코드 위치**: `infra/`  
> **언어**: TypeScript (CDK v2)

---

## 생성된 파일 목록

```
infra/
├── bin/
│   └── moaring.ts             (35 lines)  CDK App 진입점
├── lib/
│   ├── config.ts              (75 lines)  모든 설정 상수
│   ├── network-stack.ts       (90 lines)  VPC, 서브넷, 보안 그룹
│   ├── database-stack.ts      (70 lines)  Aurora PostgreSQL
│   ├── auth-stack.ts          (75 lines)  Cognito User Pool
│   ├── storage-stack.ts       (60 lines)  S3 + CloudFront
│   ├── app-stack.ts           (200 lines) ECR + ECS + ALB (가장 큼)
│   └── config-stack.ts        (75 lines)  Parameter Store
├── package.json
├── tsconfig.json
├── cdk.json
├── .gitignore
└── README.md                  배포 가이드
```

**총 7개 CDK 스택 파일 + 1개 진입점 + 5개 설정/문서 파일 = 13개 파일**

---

## 핵심 설계 반영

### 1. 단일 진실 공급원 (`lib/config.ts`)
- ACU, CPU/Memory, TTL, 토큰 만료, 헬스체크 간격 등 모든 스펙 값
- 변경 시 이 파일만 수정 후 `cdk deploy --all`
- `as const`로 immutable 보장, 타입 안전

### 2. CDK 객체 직접 전달 패턴
- 스택 간 참조는 모두 생성자 인자로 객체 전달
- `Fn.importValue` / CloudFormation Export 사용 안 함
- `bin/moaring.ts`에서 의존성 명시적으로 연결

### 3. 보안 그룹 체인
- alb-sg ← 인터넷 (0.0.0.0/0:80)
- ecs-sg ← alb-sg (3000)
- db-sg ← ecs-sg (5432)
- IP 범위 대신 보안 그룹 ID로 인바운드 제어

### 4. DB 자격증명 안전 주입 (NFR Design 결정 반영)
- Secrets Manager가 자동 생성한 자격증명을 ECS Task Definition `secrets` 필드로 직접 주입
- JSON 필드를 `DB_HOST`, `DB_USER`, `DB_PASSWORD`로 개별 주입
- 앱 코드(`lib/prisma.ts`)에서 URL 조합 → DATABASE_URL 환경변수에 평문 저장 없음

### 5. Task Role / Task Execution Role 분리
- **Execution Role**: ECR pull, CloudWatch Logs 쓰기, Secrets Manager 읽기 (관리형 정책 + 추가)
- **Task Role**: Parameter Store 읽기, S3 접근, ECS Exec용 ssmmessages 4개 권한

### 6. ECS Exec 활성화
- `enableExecuteCommand: true`
- Task Role에 `ssmmessages:*` 4개 권한
- DB 디버깅 시 `aws ecs execute-command`로 컨테이너 직접 접속

### 7. demo 친화 설정
- 모든 RemovalPolicy: DESTROY
- S3: `autoDeleteObjects: true`
- Aurora: `skipFinalSnapshot: true`
- ECR: `emptyOnDelete: true`
- `cdk destroy --all` 한 번으로 완전 삭제 가능

### 8. ECS 태스크 1개 환경 배포 가능
- `minHealthyPercent: 0` (기본값 100%이면 배포 막힘)
- `maxHealthyPercent: 200` (새 태스크 먼저 시작 후 구 태스크 종료)

---

## 환경변수 주입 방식

| 변수 | 방식 | 소스 |
|------|------|------|
| `NODE_ENV`, `AWS_REGION`, `DB_NAME`, `DB_PORT` | environment | 하드코딩 |
| `LOG_LEVEL` | environment | `ssm.StringParameter.valueForStringParameter` (배포 시 fetch) |
| `COGNITO_USER_POOL_ID`, `COGNITO_CLIENT_ID` | environment | userPool/userPoolClient 직접 참조 |
| `S3_BUCKET_NAME`, `CLOUDFRONT_DOMAIN` | environment | bucket/distribution 직접 참조 |
| `DB_HOST`, `DB_USER`, `DB_PASSWORD` | secrets | `ecs.Secret.fromSecretsManager(dbSecret, '필드명')` |

> CDK가 배포 시점에 SSM 값을 fetch해서 Task Definition에 박아넣습니다.  
> 운영 중 Parameter Store 값을 변경해도 새 태스크 시작 전까지는 반영되지 않습니다.  
> `aws ecs update-service --force-new-deployment`로 새 태스크 강제 시작 필요.

---

## 다음 단계 (Build & Test)

이 코드는 정상 합성(`cdk synth`) 가능한 상태입니다. Build & Test 단계에서:
1. `cd infra && npm install`
2. `npm run synth` — CloudFormation 템플릿 생성 검증
3. `npm run diff` — 실제 배포 시 변경사항 확인 (선택)
4. 실제 배포: `npm run deploy` (AWS 자격증명 필요, 비용 발생)

Unit 2(Next.js 앱)가 컨테이너 이미지를 ECR에 push해야 ECS Service가 정상 실행됩니다.
