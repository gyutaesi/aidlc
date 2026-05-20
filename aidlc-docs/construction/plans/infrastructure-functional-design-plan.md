# Unit 1: Infrastructure — Functional Design Plan

> **Unit**: Infrastructure (AWS CDK TypeScript)  
> **작성일**: 2026-05-20  
> **단계**: CONSTRUCTION PHASE — Functional Design

---

## 실행 체크리스트

- [x] Step 1: Unit 컨텍스트 분석
- [x] Step 2: 질문 생성 및 답변 수집
- [x] Step 3: 비즈니스 로직 모델 작성 (`business-logic-model.md`)
- [x] Step 4: 비즈니스 규칙 작성 (`business-rules.md`)
- [x] Step 5: 도메인 엔티티 작성 (`domain-entities.md`)

---

## 질문 목록

인프라 설계의 세부 결정을 위해 아래 질문에 답변해 주세요.

---

### 🌐 네트워킹 / VPC

**Q1. VPC CIDR 및 서브넷 구성**  
VPC와 서브넷 구성을 어떻게 할까요?

A) `10.0.0.0/16` VPC, Public 서브넷 2개(ALB) + Private 서브넷 2개(ECS, Aurora), 2 AZ  
B) `10.0.0.0/16` VPC, Public 서브넷 2개(ALB) + Private 서브넷 4개(ECS 2개, Aurora 2개), 2 AZ  
C) 직접 지정 (CIDR, AZ 수, 서브넷 구성 명시)

[Answer]: A

> **추천: A** *(demo 용도 반영)* — demo라면 Public 2개 + Private 2개(ECS+Aurora 공유)로 충분합니다. 서브넷 분리는 운영 환경에서 의미 있는 보안 강화이지만, demo에서는 CDK 코드 복잡도만 늘어납니다. 2 AZ는 Aurora 클러스터 최소 요구사항이므로 유지합니다.

---

**Q2. NAT Gateway**  
Private 서브넷의 아웃바운드 인터넷 접근(ECS → ECR pull, OG fetch 등)을 위한 NAT Gateway 구성은?

A) NAT Gateway 1개 (단일 AZ, 비용 절감 — MVP 권장)  
B) NAT Gateway 2개 (AZ별 고가용성)  
C) NAT Instance (비용 절감, 관리 부담 증가)

[Answer]: A

> **추천: A** *(demo 용도 반영, 변경 없음)* — demo에서도 ECS가 ECR에서 이미지를 pull하고 OG fetch를 해야 하므로 NAT Gateway는 필요합니다. 단, 1개로 충분합니다. NAT Gateway 자체가 월 ~$32로 demo 인프라에서 가장 큰 고정 비용 항목입니다. 비용이 부담된다면 ECS를 Public 서브넷에 직접 배치하는 방식(보안 그룹으로 제어)도 demo에서는 현실적인 대안입니다.

---

### 🗄️ Aurora PostgreSQL

**Q3. Aurora Serverless v2 ACU 설정**  
Aurora Serverless v2의 최소/최대 ACU를 어떻게 설정할까요?

A) Min 0.5 ACU / Max 4 ACU (MVP 최소 비용)  
B) Min 1 ACU / Max 8 ACU (콜드 스타트 방지 + 적당한 여유)  
C) Min 2 ACU / Max 16 ACU (성능 우선)  
D) 직접 지정

[Answer]: Min 1 ACU / Max 4 ACU

> **추천: A** *(demo 용도 반영, 변경 없음)* — demo에서 Min 0.5 ACU가 최적입니다. 단, demo 특성상 사용하지 않는 시간이 길면 Aurora가 0 ACU로 스케일다운되어 첫 쿼리에 수초 지연이 생길 수 있습니다. demo 시연 직전에 warm-up 쿼리를 한 번 날리는 것을 권장합니다.

---

**Q4. Aurora 멀티 AZ (Read Replica)**  
Aurora 클러스터에 Read Replica를 추가할까요?

A) Writer 인스턴스만 (MVP, 비용 절감)  
B) Writer 1개 + Reader 1개 (읽기 부하 분산)

[Answer]: A

> **추천: A** *(demo 용도 반영, 변경 없음)* — demo에서 Read Replica는 완전히 불필요합니다. 비용 2배에 이점 없음.

---

**Q5. Aurora 백업 보존 기간**  
자동 백업 보존 기간은?

A) 1일 (MVP 최소)  
B) 7일 (권장)  
C) 14일

[Answer]: A

> **추천: A** *(demo 용도 반영)* — demo에서 백업 보존 1일로 충분합니다. 어차피 demo 데이터는 재생성 가능하고, 비용 절감보다 "설정 단순화"가 더 중요합니다. 단, Aurora는 백업 보존 기간을 0으로 설정할 수 없으므로 최솟값인 1일을 사용합니다.

---

### 🔐 Cognito

**Q6. Cognito User Pool 비밀번호 정책**  
비밀번호 정책을 어떻게 설정할까요?

A) 최소 8자, 대소문자+숫자 필수 (Cognito 기본)  
B) 최소 8자, 숫자만 필수 (간단)  
C) 최소 12자, 대소문자+숫자+특수문자 필수 (강화)

[Answer]: B

> **추천: A** *(demo 용도 반영, 변경 없음)* — Cognito 기본값. demo라도 비밀번호 정책은 코드 한 줄이므로 기본값 유지가 가장 합리적입니다.

---

**Q7. Cognito MFA 설정**  
MFA(다중 인증)를 적용할까요?

A) MFA 없음 (MVP)  
B) MFA 선택적 (사용자가 설정 가능)  
C) MFA 필수 (TOTP 또는 SMS)

[Answer]: A

> **추천: A** *(demo 용도 반영, 변경 없음)* — demo에서 MFA는 오히려 시연을 방해합니다. 없음이 맞습니다.

---

**Q8. Cognito App Client 토큰 만료 시간**  
요구사항에 Access Token 1시간이 명시되어 있습니다. Refresh Token 만료 시간은?

A) 30일 (Cognito 기본)  
B) 7일  
C) 1일

[Answer]: A

> **추천: A** *(demo 용도 반영, 변경 없음)* — 30일 Refresh Token은 demo 시연 편의성에도 좋습니다. 매번 재로그인 없이 데모 가능합니다.

---

### 🪣 S3 + CloudFront

**Q9. S3 버킷 구성**  
S3 버킷을 몇 개로 구성할까요?

A) 단일 버킷 (이미지/파일 모두 저장, 경로로 구분)  
B) 2개 버킷 (사용자 업로드용 + 정적 자산용 분리)

[Answer]: A

> **추천: A** *(demo 용도 반영, 변경 없음)* — 단일 버킷이 demo에 최적입니다. 설정 단순, CDK 코드 최소화.

---

**Q10. CloudFront 캐시 정책**  
CloudFront 캐시 TTL 설정은?

A) 기본 TTL 86400초(1일), 최대 31536000초(1년) — 정적 자산 위주  
B) 기본 TTL 3600초(1시간), 최대 86400초(1일) — 자주 변경되는 이미지 고려  
C) 직접 지정

[Answer]: A

> **추천: A** *(demo 용도 반영)* — demo에서 이미지 캐시는 길수록 좋습니다. 한번 올린 이미지는 바뀌지 않고, 시연 중 빠른 로딩이 중요합니다. 1일 TTL(B)은 demo에서 불필요한 origin 요청을 늘립니다. 이미지 경로에 UUID가 포함되어 있어 캐시 충돌 걱정도 없습니다.

---

### ⚙️ ECS / Fargate

**Q11. ECS Task CPU/Memory 설정**  
Next.js 앱 컨테이너의 기본 CPU/Memory는?

A) 256 CPU / 512 MB (최소, 비용 절감)  
B) 512 CPU / 1024 MB (MVP 권장)  
C) 1024 CPU / 2048 MB (성능 여유)

[Answer]: B

> **추천: A** *(demo 용도 반영)* — demo라면 256/512도 고려할 수 있지만, Next.js App Router는 SSR 빌드 캐시와 런타임 메모리를 꽤 씁니다. 256/512는 실제로 OOM 위험이 있어 demo 시연 중 컨테이너가 재시작되는 최악의 상황이 생길 수 있습니다. 512/1024는 월 ~$15로 안정성 대비 합리적입니다. demo라도 이 항목은 B 유지를 권장합니다.

---

**Q12. ECS 서비스 태스크 수 (Auto Scaling)**  
ECS 서비스의 최소/최대 태스크 수는?

A) Min 1 / Max 1 (MVP, 비용 최소)  
B) Min 1 / Max 3 (기본 Auto Scaling)  
C) Min 2 / Max 6 (고가용성)

[Answer]: A

> **추천: A** *(demo 용도 반영)* — demo는 Min 1 / Max 1 고정이 맞습니다. Auto Scaling 설정 자체가 CDK 코드를 복잡하게 만들고, demo 트래픽에서 스케일아웃이 필요한 상황은 없습니다. 배포 중 다운타임도 demo에서는 허용 가능합니다.

---

**Q13. ECS 컨테이너 포트 및 헬스체크**  
Next.js 앱이 리스닝할 포트와 ALB 헬스체크 경로는?

A) 포트 3000, 헬스체크 `/api/health`  
B) 포트 3000, 헬스체크 `/`  
C) 포트 8080, 헬스체크 `/api/health`

[Answer]: A

> **추천: A** *(demo 용도 반영, 변경 없음)* — 포트 3000, `/api/health` 헬스체크는 demo에서도 동일하게 적용합니다. ALB가 헬스체크를 통과해야 트래픽을 받으므로 필수입니다.

---

### 🔒 ALB / SSL

**Q14. 도메인 및 SSL 인증서**  
ALB에 연결할 도메인과 SSL 인증서 설정은?

A) 도메인 없음 (ALB DNS 직접 사용, HTTP만, MVP 테스트용)  
B) Route 53 도메인 있음 → ACM 인증서 자동 발급  
C) 외부 도메인 (ACM DNS 검증 방식)

[Answer]: A

> **추천: A** *(demo 용도 반영)* — demo라면 도메인 없이 ALB DNS로 HTTP 접근이 가장 빠르고 단순합니다. ACM 인증서 발급과 Route 53 설정은 추가 작업이 필요하고, demo 시연에 HTTPS가 필수는 아닙니다. 단, Chrome Extension에서 API를 호출할 때 HTTP mixed content 이슈가 생길 수 있으므로, Extension 테스트가 중요하다면 B/C를 선택해야 합니다.

> ⚠️ **주의**: Extension이 HTTPS 페이지에서 HTTP API를 호출하면 브라우저가 차단합니다. Extension 기능 데모가 필요하다면 B(Route 53 도메인)를 선택하세요.

---

**Q15. ALB 리스너 구성**  
ALB 리스너를 어떻게 구성할까요?

A) HTTP(80)만 (MVP 테스트용)  
B) HTTP(80) → HTTPS(443) 리다이렉트 + HTTPS(443) 리스너  
C) HTTPS(443)만

[Answer]: A

> **추천: A** *(demo 용도 반영)* — Q14에서 HTTP만 사용하기로 했으므로 HTTP(80) 리스너만 구성합니다. 도메인+SSL을 선택한 경우에만 B로 변경하면 됩니다.

---

### 🗝️ Parameter Store

**Q16. Parameter Store 저장 항목 및 경로 규칙**  
Parameter Store 경로 규칙을 어떻게 할까요?

A) `/moaring/{env}/{key}` 형식 (예: `/moaring/prod/db-url`)  
B) `/moaring/{key}` 형식 (단일 환경)  
C) 직접 지정

[Answer]: A

> **추천: A** *(demo 용도 반영, 변경 없음)* — `/moaring/{env}/{key}` 경로 규칙은 코드 한 줄 차이이므로 demo라도 유지합니다. 나중에 환경 추가 시 경로 재설계 비용이 더 큽니다.

---

**Q17. Parameter Store 파라미터 타입**  
민감 정보(DB URL, Cognito Secret 등)를 SecureString으로 저장할까요?

A) 민감 정보는 SecureString, 나머지는 String  
B) 모두 SecureString  
C) 모두 String (KMS 비용 절감)

[Answer]: A

> **추천: A** *(demo 용도 반영, 변경 없음)* — DB URL 같은 민감 정보는 demo라도 SecureString으로 저장해야 합니다. KMS 비용은 월 $1 미만으로 무시할 수준이고, 실수로 파라미터 값이 노출되는 위험을 막습니다.

---

### 🏗️ CDK 스택 구성

**Q18. CDK 환경(env) 설정**  
CDK 배포 환경을 어떻게 구성할까요?

A) 단일 환경 (prod만, MVP)  
B) dev + prod 2개 환경  
C) dev + staging + prod 3개 환경

[Answer]: A

> **추천: A** *(demo 용도 반영, 변경 없음)* — demo는 prod 단일 환경이 맞습니다. 로컬 개발은 Docker Compose로 완전히 커버됩니다.

---

**Q19. CDK 스택 간 의존성 전달 방식**  
스택 간 리소스 참조(예: VPC ID, DB 엔드포인트)를 어떻게 전달할까요?

A) CDK Stack Output + `Fn.importValue` (CloudFormation Export/Import)  
B) 스택 생성자에서 직접 참조 객체 전달 (CDK 권장 방식)  
C) Parameter Store에서 런타임에 조회

[Answer]: B

> **추천: B** *(demo 용도 반영, 변경 없음)* — CDK 객체 직접 전달은 demo에서도 가장 단순한 방식입니다. CloudFormation Export/Import보다 코드가 훨씬 깔끔합니다.

---

**Q20. ECR 이미지 보존 정책**  
ECR 레포지토리의 이미지 보존 정책은?

A) 최신 5개 이미지만 보존  
B) 최신 10개 이미지만 보존  
C) 보존 정책 없음 (수동 관리)

[Answer]: A

> **추천: A** *(demo 용도 반영, 변경 없음)* — 최신 5개 보존. demo에서도 ECR 이미지가 무한정 쌓이면 스토리지 비용이 발생합니다. LifecycleRule 한 줄로 자동 관리됩니다.
