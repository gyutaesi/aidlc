# Unit 1: Infrastructure — Code Generation Plan

> **Unit**: Infrastructure (AWS CDK TypeScript)  
> **작성일**: 2026-05-20  
> **코드 위치**: `/Users/gyutae/workspace/ai-dlc/infra/`  
> **문서 위치**: `aidlc-docs/construction/infrastructure/code/`

---

## Unit 컨텍스트

- **담당 FR**: FR-01-1~4 (Cognito 프로비저닝), 인프라 전반
- **기술 스택**: AWS CDK v2 TypeScript
- **의존성**: 없음 (Unit 1은 독립적)
- **Unit 2 제공**: Aurora 엔드포인트, Cognito Pool ID/Client ID, S3 버킷명, CloudFront 도메인 (Parameter Store 경유)

---

## 실행 체크리스트

### PART 1: 프로젝트 구조 설정

- [x] **Step 1**: `infra/` 디렉토리 초기화 — `cdk init` 없이 수동 구조 생성
  - `infra/bin/moaring.ts` (CDK App 진입점)
  - `infra/lib/config.ts` (설정 상수)
  - `infra/package.json`
  - `infra/tsconfig.json`
  - `infra/cdk.json`
  - `infra/.gitignore`

### PART 2: 공통 설정

- [x] **Step 2**: `infra/lib/config.ts` — 모든 스택에서 참조하는 설정 상수

### PART 3: CDK 스택 생성

- [x] **Step 3**: `infra/lib/network-stack.ts` — VPC, 서브넷, 보안 그룹, NAT Gateway
- [x] **Step 4**: `infra/lib/database-stack.ts` — Aurora PostgreSQL Serverless v2
- [x] **Step 5**: `infra/lib/auth-stack.ts` — Cognito User Pool + App Client
- [x] **Step 6**: `infra/lib/storage-stack.ts` — S3 버킷 + CloudFront
- [x] **Step 7**: `infra/lib/app-stack.ts` — ECR + ECS Cluster + Task Definition + ALB + Fargate Service
- [x] **Step 8**: `infra/lib/config-stack.ts` — Parameter Store 파라미터 저장

### PART 4: CDK App 진입점

- [x] **Step 9**: `infra/bin/moaring.ts` — 스택 인스턴스화 및 의존성 연결

### PART 5: 배포 문서

- [x] **Step 10**: `infra/README.md` — 배포 가이드 (Bootstrap, deploy, destroy 절차)
- [x] **Step 11**: `aidlc-docs/construction/infrastructure/code/code-summary.md` — 코드 요약 문서

---

## 생성 파일 목록

```
infra/
├── bin/
│   └── moaring.ts
├── lib/
│   ├── config.ts
│   ├── network-stack.ts
│   ├── database-stack.ts
│   ├── auth-stack.ts
│   ├── storage-stack.ts
│   ├── app-stack.ts
│   └── config-stack.ts
├── package.json
├── tsconfig.json
├── cdk.json
├── .gitignore
└── README.md

aidlc-docs/construction/infrastructure/code/
└── code-summary.md
```

**총 13개 파일**
