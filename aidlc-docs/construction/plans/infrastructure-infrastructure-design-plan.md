# Unit 1: Infrastructure — Infrastructure Design Plan

> **Unit**: Infrastructure (AWS CDK TypeScript)  
> **작성일**: 2026-05-20  
> **단계**: CONSTRUCTION PHASE — Infrastructure Design

---

## 실행 체크리스트

- [x] Step 1: 설계 아티팩트 분석
- [x] Step 2: 질문 생성 및 답변 수집
- [x] Step 3: Infrastructure Design 작성 (`infrastructure-design.md`)
- [x] Step 4: Deployment Architecture 작성 (`deployment-architecture.md`)

---

## 질문 목록

Functional Design + NFR Design에서 대부분 확정되었습니다.
아래 미결 항목만 확인합니다.

---

### 🚀 배포 환경

**Q1. AWS 계정 및 리전 설정 방식**  
CDK 배포 시 AWS 계정/리전을 어떻게 지정할까요?

A) `cdk.json`의 `context`에 계정 ID와 리전 명시  
B) 환경변수 `CDK_DEFAULT_ACCOUNT`, `CDK_DEFAULT_REGION` 사용 (로컬 AWS CLI 프로파일 기반)  
C) `bin/moaring.ts`에 하드코딩

[Answer]: B

> **추천: B** — AWS CLI 프로파일(`aws configure`)에서 자동으로 읽어오므로 코드에 계정 ID를 노출하지 않아도 됩니다. 팀원이 다른 계정에 배포할 때도 코드 수정 없이 가능합니다.

---

**Q2. CDK Bootstrap 스택 관리**  
`cdk bootstrap`은 최초 1회 수동 실행으로 처리할까요?

A) 수동 실행 (배포 가이드에 명시)  
B) CDK 코드에 Bootstrap 자동화 포함

[Answer]: A

> **추천: A** — Bootstrap은 AWS 계정당 리전당 1회만 필요합니다. 코드에 포함하면 오히려 복잡해집니다. `infra/README.md`에 `cdk bootstrap aws://{account}/ap-northeast-2` 명령을 명시하면 충분합니다.

---

### 🗄️ 데이터베이스

**Q3. Aurora 초기 DB 생성**  
Aurora 클러스터 생성 후 `moaring` 데이터베이스는 어떻게 생성할까요?

A) CDK `DatabaseCluster`의 `defaultDatabaseName` 속성으로 자동 생성  
B) 배포 후 수동으로 `CREATE DATABASE moaring` 실행

[Answer]: A

> **추천: A** — CDK `DatabaseCluster`에 `defaultDatabaseName: 'moaring'`을 지정하면 클러스터 생성 시 자동으로 DB가 만들어집니다. 수동 작업 불필요.

---

### 🔗 DATABASE_URL Secret 생성 방식

**Q4. DATABASE_URL Secret 생성 타이밍**  
NFR Design에서 결정한 대로 DATABASE_URL 전체 문자열을 별도 Secrets Manager Secret으로 저장해야 합니다.  
CDK synth 시점에 Aurora 엔드포인트와 비밀번호가 확정되지 않는 문제를 어떻게 해결할까요?

A) CDK Custom Resource (Lambda)로 배포 시점에 자동 생성  
B) `cdk deploy` 후 수동으로 AWS CLI로 Secret 값 입력, 이후 ECS 재배포  
C) 앱 컨테이너 시작 시 환경변수(`DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`)를 각각 주입하고 앱 코드에서 URL 조합 (Secret 조합 문제 우회)

[Answer]: C

> **추천: C** — demo에서 가장 단순한 방식입니다. Custom Resource(Lambda)는 CDK 코드 복잡도를 크게 높이고, 수동 입력(B)은 배포 절차가 번거롭습니다. C 방식은 ECS Task Definition에서 각 필드를 개별 환경변수로 주입하고 앱 코드(`lib/prisma.ts`)에서 URL을 조합합니다. Secrets Manager의 JSON 필드를 각각 꺼낼 수 있어 CDK 표준 방식으로 처리 가능합니다.

---

### 🌐 네트워킹

**Q5. VPC 서브넷 CIDR 자동 할당**  
CDK `Vpc` construct의 서브넷 CIDR을 자동 할당할까요, 수동 지정할까요?

A) CDK 자동 할당 (`subnetConfiguration`에 `cidrMask`만 지정)  
B) 수동 지정 (Functional Design의 `10.0.0.0/24` 등 명시)

[Answer]: A

> **추천: A** — CDK가 VPC CIDR(`10.0.0.0/16`) 내에서 서브넷을 자동으로 균등 분배합니다. 수동 지정은 AZ 추가 시 충돌 위험이 있고, demo에서 특정 CIDR이 필요한 이유가 없습니다.

---

### 📊 모니터링

**Q6. CloudWatch Logs 로그 그룹 생성 방식**  
ECS 컨테이너 로그 그룹(`/ecs/moaring`)을 어떻게 생성할까요?

A) CDK에서 명시적으로 `LogGroup` 리소스 생성 (보존 기간 7일, DESTROY 정책)  
B) ECS가 자동 생성 (보존 기간 무제한, 삭제 정책 없음)

[Answer]: A

> **추천: A** — CDK에서 명시적으로 생성해야 보존 기간(7일)과 삭제 정책(DESTROY)을 제어할 수 있습니다. B는 `cdk destroy` 후에도 로그 그룹이 남아 비용이 계속 발생합니다.
