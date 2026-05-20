# Unit 2 (Application) — Infrastructure Design 질문

> **목적**: 인프라 설계 미결 사항 확인  
> **작성일**: 2026-05-20  
> **답변 방법**: 각 `[Answer]:` 태그 뒤에 답변을 작성해 주세요

---

> ### 📌 추천 답변 안내
>
> 각 질문 아래에 **추천 답변**과 **사유**를 함께 표기했습니다.

---

## 섹션 1: 컨테이너 & 컴퓨트

**Q1. ECS 태스크 CPU/메모리 사양**  
Next.js 앱 컨테이너의 초기 리소스 사양은?

A) 0.25 vCPU / 512MB (최소 사양, 월 ~$10)  
B) 0.5 vCPU / 1GB (소규모 적합, 월 ~$18)  
C) 1 vCPU / 2GB (여유 있는 사양, 월 ~$35)

> **추천: B**  
> Next.js SSR은 메모리를 적당히 사용합니다. 0.5 vCPU / 1GB는 개인/팀 1~10명 규모에서 충분하고, 필요 시 태스크 수를 늘려 수평 확장할 수 있습니다. 0.25 vCPU(A)는 SSR 렌더링 시 CPU 병목이 생길 수 있습니다.

[Answer]: B

---

**Q2. ECS 태스크 수 (초기)**  
초기 배포 시 실행할 태스크 수는?

A) 1개 (MVP, 비용 최소화)  
B) 2개 (최소 고가용성, ALB 로드밸런싱)  
C) Auto Scaling (최소 1, 최대 3)

> **추천: A**  
> MVP 규모(개인/팀 1~10명)에서 태스크 1개로 충분합니다. 고가용성이 필요하면 나중에 2개로 늘리면 됩니다. 비용 최소화가 우선입니다.

[Answer]: A

---

**Q3. Dockerfile — Node.js 베이스 이미지**  
컨테이너 베이스 이미지는?

A) `node:20-alpine` (경량, 보안 취약점 적음, 권장)  
B) `node:20-slim` (Debian 기반, 호환성 좋음)  
C) `node:20` (전체 이미지, 크기 큼)

> **추천: A**  
> Alpine 이미지는 크기가 작아 ECR 저장 비용과 배포 시간이 줄어듭니다. Next.js 15는 Alpine에서 잘 동작합니다.

[Answer]: A

---

## 섹션 2: 데이터베이스

**Q4. Aurora Serverless v2 — 최소/최대 ACU**  
Aurora Serverless v2의 스케일링 범위는?

A) 최소 0.5 ACU / 최대 2 ACU (비용 최소화, 콜드 스타트 있음)  
B) 최소 1 ACU / 최대 4 ACU (콜드 스타트 없음, 안정적)  
C) 최소 2 ACU / 최대 8 ACU (여유 있는 사양)

> **추천: A**  
> MVP 규모에서 0.5 ACU로 시작해도 충분합니다. 최소 0.5 ACU는 비활성 시 거의 비용이 없고, 트래픽 발생 시 자동으로 스케일업됩니다. 콜드 스타트(~수 초)는 MVP에서 허용 가능합니다.

[Answer]: A

---

**Q5. DB 연결 — Prisma Accelerate 또는 직접 연결**  
ECS에서 Aurora에 연결하는 방식은?

A) Prisma 직접 연결 (connection_limit URL 파라미터로 풀 관리)  
B) RDS Proxy 사용 (연결 풀링 프록시, 추가 비용 ~$15/월)  
C) Prisma Accelerate (Prisma 클라우드 서비스, 추가 비용)

> **추천: A**  
> MVP 규모에서 ECS 태스크 1~2개이므로 직접 연결로 충분합니다. `connection_limit=10`으로 설정하면 Aurora Serverless v2의 max_connections를 초과하지 않습니다. RDS Proxy(B)는 연결이 수백 개일 때 유용합니다.

[Answer]: A

---

## 섹션 3: 네트워킹

**Q6. 도메인 및 SSL 인증서**  
커스텀 도메인을 사용하나요?

A) 커스텀 도메인 사용 (Route 53 + ACM 인증서)  
B) ALB 기본 DNS 사용 (커스텀 도메인 없음, MVP)  
C) CloudFront 기본 도메인 사용 (\*.cloudfront.net)

> **추천: A**  
> 공개 컬렉션 URL(`/c/{slug}`)을 공유하는 서비스 특성상 커스텀 도메인이 있어야 실용적입니다. Route 53 + ACM은 AWS 생태계에서 자연스럽고, ACM 인증서는 무료입니다.

[Answer]: C

---

**Q7. VPC 구성 — 가용 영역(AZ) 수**  
VPC에 몇 개의 AZ를 사용하나요?

A) 2개 AZ (ap-northeast-2a, ap-northeast-2c) — 비용/가용성 균형  
B) 3개 AZ — 더 높은 가용성  
C) 1개 AZ — 비용 최소화 (MVP)

> **추천: A**  
> Aurora Serverless v2는 최소 2개 AZ가 필요합니다. ECS도 2개 AZ에 분산하면 AZ 장애 시 자동 복구됩니다. 3개(B)는 MVP에서 불필요합니다.

[Answer]: C

---

**Q8. AWS 리전**  
배포 리전은?

A) ap-northeast-2 (서울) — 한국 사용자 대상, 낮은 레이턴시  
B) us-east-1 (버지니아) — 글로벌 서비스, 일부 AWS 서비스 먼저 출시  
C) ap-northeast-1 (도쿄)

> **추천: A**  
> 한국어 서비스이고 주 사용자가 한국에 있으므로 서울 리전이 적합합니다.

[Answer]: A

---

## 섹션 4: CI/CD

**Q9. CI/CD 파이프라인**  
배포 자동화를 어떻게 구성하나요?

A) GitHub Actions (Docker 빌드 → ECR push → ECS 배포)  
B) AWS CodePipeline + CodeBuild  
C) 수동 배포 (MVP, 자동화 나중에)

> **추천: A**  
> GitHub Actions는 설정이 간단하고 GitHub 레포와 자연스럽게 통합됩니다. ECR push + ECS 롤링 업데이트를 YAML 파일 하나로 구성할 수 있습니다. CodePipeline(B)은 AWS 콘솔 설정이 복잡합니다.

[Answer]: C

---

**Q10. 배포 전략**  
ECS 서비스 업데이트 시 배포 방식은?

A) Rolling Update (기본값, 다운타임 없음, 추가 비용 없음)  
B) Blue/Green (CodeDeploy 필요, 즉시 롤백 가능, 추가 비용)  
C) Recreate (다운타임 있음, 비용 최소)

> **추천: A**  
> MVP에서 Rolling Update로 충분합니다. ECS가 기본으로 지원하고, 최소 정상 상태 비율(minimumHealthyPercent)을 100%로 설정하면 다운타임 없이 배포됩니다. Blue/Green(B)은 트래픽이 많을 때 유용합니다.

[Answer]: A

---

## 섹션 5: 모니터링

**Q11. CloudWatch 알람**  
어떤 메트릭에 알람을 설정하나요?

A) 없음 (MVP, 로그만 확인)  
B) ECS CPU/메모리 사용률 + ALB 5xx 에러율 알람  
C) 전체 메트릭 알람 (CPU, 메모리, DB, ALB, 에러율)

> **추천: B**  
> 최소한 서비스 장애를 감지할 수 있는 알람은 있어야 합니다. ECS CPU 80% 초과 + ALB 5xx 에러율 5% 초과 알람을 SNS → 이메일로 설정하면 충분합니다. 비용도 거의 없습니다.

[Answer]: A

---

**Q12. 로그 보존 기간**  
CloudWatch Logs 보존 기간은?

A) 7일 (비용 최소화)  
B) 30일 (적절한 보존)  
C) 90일 (장기 보존)

> **추천: B**  
> 30일이면 문제 발생 시 충분히 추적할 수 있고, 비용도 적습니다. 7일(A)은 너무 짧아 주말 이슈를 놓칠 수 있습니다.

[Answer]: A

---
