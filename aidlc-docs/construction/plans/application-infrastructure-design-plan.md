# Unit 2 (Application) — Infrastructure Design Plan

> **Unit**: Application (Next.js 앱)  
> **단계**: Construction Phase — Infrastructure Design  
> **작성일**: 2026-05-20

---

## 실행 체크리스트

- [x] Step 1: 설계 아티팩트 분석 완료
- [x] Step 2: 미결 사항 질문 및 답변 수집
- [x] Step 3: Infrastructure Design 산출물 생성 (infrastructure-design.md)
- [x] Step 4: Deployment Architecture 산출물 생성 (deployment-architecture.md)

---

## 이미 확정된 인프라 결정 사항

아래 항목들은 요구사항/NFR에서 이미 결정됨 — 질문 불필요:

- **컨테이너**: ECS/Fargate + ECR
- **DB**: Aurora PostgreSQL Serverless v2
- **인증**: Amazon Cognito User Pool
- **스토리지**: S3 + CloudFront (OAC)
- **네트워크**: VPC + ALB + HTTPS
- **설정 관리**: AWS Parameter Store
- **로컬 개발**: Docker Compose (PostgreSQL만)
- **로그**: CloudWatch Logs

---

## 질문 파일

`aidlc-docs/construction/plans/application-infrastructure-design-questions.md`

---

## 산출물 위치

```
aidlc-docs/construction/application/infrastructure-design/
├── infrastructure-design.md
└── deployment-architecture.md
```
