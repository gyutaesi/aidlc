# Unit 1: Infrastructure — NFR Requirements

> **작성일**: 2026-05-20  
> **용도**: Demo  
> **리전**: ap-northeast-2 (서울)

---

## 1. 성능 요구사항

| ID | 요구사항 | 기준값 | 비고 |
|----|----------|--------|------|
| NFR-PERF-01 | 동시 접속자 수 | 최대 3명 | demo 시연 기준 |
| NFR-PERF-02 | ECS 태스크 복구 시간 | 수분 이내 허용 | demo 특성상 허용 |
| NFR-PERF-03 | Aurora 콜드 스타트 | 허용 (warm-up으로 대응) | 시연 5분 전 앱 접속으로 해결 |
| NFR-PERF-04 | ALB → ECS 응답 | 헬스체크 30초 간격, 정상 임계값 2회 | 기존 Functional Design 유지 |

**Aurora 콜드 스타트 대응 절차**:
- 시연 5분 전 브라우저로 앱에 접속
- 첫 페이지 로딩 확인 후 시연 시작
- Min ACU 0.5 유지 (비용 절감 우선)

---

## 2. 가용성 요구사항

| ID | 요구사항 | 기준값 | 비고 |
|----|----------|--------|------|
| NFR-AVAIL-01 | 목표 가용성 | Best-effort | demo 수준, SLA 없음 |
| NFR-AVAIL-02 | ECS 태스크 수 | 1개 고정 | Auto Scaling 없음 |
| NFR-AVAIL-03 | 배포 중 다운타임 | 허용 (수십 초) | minimumHealthyPercent: 0 |
| NFR-AVAIL-04 | Aurora 다중 AZ | 미적용 | Writer 1개만 |
| NFR-AVAIL-05 | 운영 기간 | 1~3개월 | 이후 cdk destroy |

---

## 3. 보안 요구사항

| ID | 요구사항 | 구현 방식 |
|----|----------|-----------|
| NFR-SEC-01 | DB 자격증명 보호 | Secrets Manager 자동 생성, ECS Task Definition secrets로 주입 |
| NFR-SEC-02 | DB 네트워크 격리 | Private 서브넷, 보안 그룹으로 ECS에서만 접근 |
| NFR-SEC-03 | DB 직접 접근 (개발용) | SSM Session Manager 포트 포워딩 (Bastion Host 없음) |
| NFR-SEC-04 | S3 퍼블릭 접근 차단 | Block Public Access 전체 활성화, CloudFront OAC만 허용 |
| NFR-SEC-05 | HTTPS | CloudFront는 HTTP/HTTPS 모두 허용 (demo), ALB는 HTTP(80)만 |
| NFR-SEC-06 | IAM 최소 권한 | Task Role / Task Execution Role 분리, 리소스별 ARN 지정 |
| NFR-SEC-07 | 로그 접근 | AWS 계정 소유자만 (CloudWatch Logs) |
| NFR-SEC-08 | ECS Exec 권한 | Task Role에 ssmmessages 권한 추가 (DB 직접 접근용) |

**SSM Session Manager DB 접근 방법** (개발/디버깅용):
```bash
# ECS Exec으로 실행 중인 컨테이너에 접속
aws ecs execute-command \
  --cluster moaring-cluster \
  --task {task-id} \
  --container moaring-app \
  --interactive \
  --command "/bin/sh"

# 컨테이너 내부에서 psql 실행
psql $DATABASE_URL
```

> **ECS Exec 활성화 필수 설정**:
> - ECS Service: `enableExecuteCommand: true`
> - Task Role에 아래 권한 추가:
>   ```
>   ssmmessages:CreateControlChannel
>   ssmmessages:CreateDataChannel
>   ssmmessages:OpenControlChannel
>   ssmmessages:OpenDataChannel
>   ```

---

## 4. 운영 요구사항

| ID | 요구사항 | 구현 방식 |
|----|----------|-----------|
| NFR-OPS-01 | CDK 배포 방식 | 로컬 머신에서 직접 실행 (`cdk deploy --all`) |
| NFR-OPS-02 | DB 마이그레이션 | 컨테이너 시작 시 자동 실행 (entrypoint에 포함) |
| NFR-OPS-03 | 모니터링 | CloudWatch 기본 메트릭만 (알림 없음) |
| NFR-OPS-04 | 로그 | CloudWatch Logs, 보존 7일 |
| NFR-OPS-05 | 인프라 정리 | `cdk destroy --all` 한 번으로 전체 삭제 |

**DB 마이그레이션 자동화 방식**:
- Dockerfile entrypoint: `prisma migrate deploy && node server.js`
- ECS 태스크 시작 시 자동 실행
- 마이그레이션 실패 시 컨테이너 시작 안 됨 → CloudWatch Logs에서 확인

---

## 5. 비용 요구사항

| ID | 요구사항 | 기준값 |
|----|----------|--------|
| NFR-COST-01 | 목표 월 비용 | ~$81/월 이하 |
| NFR-COST-02 | 운영 기간 | 1~3개월 |
| NFR-COST-03 | 미사용 시 | cdk destroy로 전체 삭제 (비용 0) |

**예상 월 비용 상세**:

| 서비스 | 스펙 | 예상 월 비용 |
|--------|------|------------|
| ECS Fargate | 512 CPU / 1024 MB, 1태스크, 24시간 | ~$15 |
| Aurora Serverless v2 | Min 0.5 ACU 상시, ap-northeast-2 ($0.12/ACU-hr) | ~$43 |
| NAT Gateway | 1개, 데이터 전송 최소 | ~$32 |
| ALB | 1개, 트래픽 최소 | ~$16 |
| CloudFront + S3 | 소량 트래픽 | ~$2 |
| CloudWatch Logs | 7일 보존 | ~$1 |
| **합계** | | **~$109/월** |

> NAT Gateway가 전체 비용의 약 30%를 차지합니다. 비용 절감이 필요하면 ECS를 Public 서브넷에 배치하고 NAT Gateway를 제거하는 방식도 가능합니다 (보안 그룹으로 접근 제어).  
> Aurora는 실제 사용 패턴(간헐적 접속)에 따라 0.5 ACU 이하로 내려가는 시간이 있어 실제 비용은 이보다 낮을 수 있습니다.

---

## 6. 유지보수 요구사항

| ID | 요구사항 | 구현 방식 |
|----|----------|-----------|
| NFR-MAINT-01 | CDK 코드 언어 | TypeScript (타입 안전, 기존 스택과 일관성) |
| NFR-MAINT-02 | 스택 간 참조 | CDK 객체 직접 전달 (CloudFormation Export 미사용) |
| NFR-MAINT-03 | 리소스 태그 | Project/Environment/ManagedBy 공통 태그 |
| NFR-MAINT-04 | 환경 구성 | prod 단일 환경, 로컬은 Docker Compose |
