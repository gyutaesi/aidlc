# Unit 1: Infrastructure — NFR Requirements Plan

> **Unit**: Infrastructure (AWS CDK TypeScript)  
> **작성일**: 2026-05-20  
> **단계**: CONSTRUCTION PHASE — NFR Requirements

---

## 실행 체크리스트

- [x] Step 1: Functional Design 분석
- [x] Step 2: NFR 질문 생성 및 답변 수집
- [x] Step 3: NFR Requirements 작성 (`nfr-requirements.md`)
- [x] Step 4: Tech Stack Decisions 작성 (`tech-stack-decisions.md`)

---

## 질문 목록

demo 용도 + Functional Design 결정사항을 기반으로 인프라 NFR을 확정합니다.

---

### ⚡ 성능 / 가용성

**Q1. demo 시연 중 예상 동시 접속자 수**  
시연 시 최대 몇 명이 동시에 접속할 것으로 예상하나요?

A) 1~3명 (개인 데모, 혼자 또는 소수 리뷰어)  
B) 5~10명 (팀 데모, 여러 명이 동시 접속)  
C) 10명 이상

[Answer]: A

> **추천: A** — demo는 발표자 본인 + 소수 리뷰어 구조가 일반적입니다. 1~3명 동시 접속이면 ECS 태스크 1개, Aurora 0.5 ACU로 전혀 문제없습니다. 이 규모에서 인프라 병목은 발생하지 않습니다.

---

**Q2. Aurora 콜드 스타트 허용 여부**  
Min ACU 0.5로 설정 시 장시간 미사용 후 첫 쿼리에 수초 지연이 생길 수 있습니다. demo 시연 전 warm-up을 직접 하실 건가요?

A) 직접 warm-up 할게 (시연 전 미리 접속해서 준비)  
B) 콜드 스타트 없도록 Min ACU를 1로 올려줘 (월 ~$15 추가)

[Answer]: A

> **추천: A** — demo 시연 전 브라우저로 한 번 접속해두는 것은 30초면 충분합니다. Min ACU를 1로 올리면 월 ~$15 추가 비용이 발생하는데, warm-up 한 번으로 해결되는 문제에 비용을 쓸 필요가 없습니다. 시연 체크리스트에 "시연 5분 전 앱 접속 확인" 항목을 추가하면 됩니다.

---

**Q3. ECS 태스크 시작 시간 허용 범위**  
태스크가 재시작될 때(배포, 장애 복구 등) 서비스 복구까지 얼마나 기다릴 수 있나요?

A) 수분 이내면 OK (demo 특성상 허용)  
B) 1분 이내여야 함

[Answer]: A

> **추천: A** — demo에서 태스크 재시작이 필요한 상황(배포, 장애)은 시연 중에 발생하지 않도록 사전에 배포를 완료해두는 것이 맞습니다. Fargate 태스크 시작은 보통 30~60초이므로 "수분 이내" 기준으로 충분합니다.

---

### 🔒 보안

**Q4. VPC 외부에서 DB 직접 접근 필요 여부**  
개발/디버깅 목적으로 로컬 머신에서 Aurora에 직접 접속(예: DBeaver, psql)이 필요한가요?

A) 필요 없음 (ECS 통해서만 접근, 현재 설계 유지)  
B) 필요함 → Bastion Host 또는 SSM Session Manager 터널링 추가 필요

[Answer]: B

> **추천: B** — 개발 중 DB 내용을 직접 확인하거나 Prisma 마이그레이션 문제를 디버깅할 때 로컬에서 Aurora에 직접 접속할 수 있으면 매우 편리합니다. Bastion Host는 EC2 비용이 추가되므로, **SSM Session Manager 포트 포워딩** 방식을 권장합니다 — EC2 없이 ECS 태스크에 SSM으로 터널링해서 `psql`로 접속 가능하고 추가 비용이 없습니다.

---

**Q5. CloudWatch Logs 접근 범위**  
ECS 컨테이너 로그(CloudWatch Logs)에 접근할 수 있는 사람은?

A) AWS 계정 소유자만 (현재 설계 유지)  
B) 팀원도 접근 가능하도록 IAM 사용자/역할 추가 필요

[Answer]: A

> **추천: A** — demo는 개인 프로젝트 수준이므로 AWS 계정 소유자만 접근하면 충분합니다. IAM 사용자 추가는 CDK 범위 밖의 작업이고, 팀원이 필요하다면 AWS Console에서 직접 추가하는 것이 더 빠릅니다.

---

### 🛠️ 운영 / 유지보수

**Q6. CDK 배포 실행 환경**  
`cdk deploy`를 어디서 실행할 예정인가요?

A) 로컬 머신에서 직접 실행 (AWS CLI + CDK 설치)  
B) GitHub Actions 등 CI/CD 파이프라인에서 자동 배포

[Answer]: A

> **추천: A** — demo 단계에서 CI/CD 파이프라인 구축은 오버엔지니어링입니다. 로컬에서 `cdk deploy`를 직접 실행하는 것이 가장 빠르고 단순합니다. AWS CLI와 CDK CLI만 설치되어 있으면 됩니다.

---

**Q7. 배포 후 DB 마이그레이션 실행 방식**  
ECS 배포 후 Prisma 마이그레이션(`prisma migrate deploy`)을 어떻게 실행할 예정인가요?

A) 로컬에서 수동 실행 (DB 엔드포인트에 직접 접근 또는 ECS Exec 사용)  
B) ECS Task로 마이그레이션 전용 one-off 태스크 실행  
C) 앱 컨테이너 시작 시 자동 실행 (entrypoint에 migrate 포함)

[Answer]: C

> **추천: C** — demo에서 가장 단순한 방식입니다. `Dockerfile`의 entrypoint에 `prisma migrate deploy && node server.js` 형태로 넣으면 ECS 태스크 시작 시 자동으로 마이그레이션이 실행됩니다. 별도 one-off 태스크 실행이나 로컬 접속 없이 배포 한 번으로 끝납니다. 단, 마이그레이션 실패 시 컨테이너가 시작되지 않으므로 CloudWatch Logs에서 확인해야 합니다.

---

**Q8. 인프라 모니터링 필요 수준**  
demo 기간 동안 인프라 모니터링이 필요한가요?

A) 없음 (CloudWatch 기본 메트릭만, 알림 없음)  
B) 기본 알림 (ECS 태스크 중단, ALB 5xx 급증 시 이메일 알림)

[Answer]: A

> **추천: A** — demo에서 CloudWatch 알림 설정은 SNS 토픽, 알림 구독 등 추가 CDK 코드가 필요합니다. demo 기간 중 문제가 생기면 AWS Console에서 직접 확인하는 것이 더 빠릅니다. CloudWatch 기본 메트릭(CPU, 메모리, ALB 요청 수)은 별도 설정 없이도 Console에서 볼 수 있습니다.

---

### 💰 비용

**Q9. demo 운영 기간**  
인프라를 얼마나 유지할 예정인가요? (비용 예측에 필요)

A) 1~2주 (단기 데모 후 `cdk destroy`)  
B) 1~3개월  
C) 지속 운영 (MVP 이후에도 유지)

[Answer]: B

> **추천: B** — 1~3개월이 현실적인 demo 운영 기간입니다. 예상 월 비용은 아래와 같습니다:
> 
> | 서비스 | 예상 월 비용 |
> |--------|------------|
> | ECS Fargate (512CPU/1GB, 1태스크) | ~$15 |
> | Aurora Serverless v2 (0.5 ACU) | ~$15 |
> | NAT Gateway | ~$32 |
> | ALB | ~$16 |
> | CloudFront + S3 | ~$2 |
> | CloudWatch Logs | ~$1 |
> | **합계** | **~$81/월** |
>
> 사용하지 않을 때는 `cdk destroy`로 전체 삭제하면 비용이 0이 됩니다.

---

**Q10. AWS 리전**  
배포할 AWS 리전은?

A) `ap-northeast-2` (서울, 한국 사용자 기준 최적)  
B) `us-east-1` (버지니아, 일부 서비스 비용 저렴)  
C) 기타 리전 직접 지정

[Answer]: A

> **추천: A** — 한국에서 개발하고 시연하는 demo라면 `ap-northeast-2` (서울)이 최적입니다. 네트워크 레이턴시가 가장 낮고, Aurora Serverless v2와 ECS Fargate 모두 서울 리전에서 지원됩니다.
