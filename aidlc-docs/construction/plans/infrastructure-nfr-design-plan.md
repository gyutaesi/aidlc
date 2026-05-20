# Unit 1: Infrastructure — NFR Design Plan

> **Unit**: Infrastructure (AWS CDK TypeScript)  
> **작성일**: 2026-05-20  
> **단계**: CONSTRUCTION PHASE — NFR Design

---

## 실행 체크리스트

- [x] Step 1: NFR Requirements 분석
- [x] Step 2: NFR 디자인 질문 생성 및 답변 수집
- [x] Step 3: NFR Design Patterns 작성 (`nfr-design-patterns.md`)
- [x] Step 4: Logical Components 작성 (`logical-components.md`)

---

## 질문 목록

지금까지 결정된 내용(demo, 저수준 CDK, ECS Fargate, Aurora Serverless v2)을 바탕으로
패턴 적용 수준을 확정합니다.

---

### 🔄 복원력 패턴 (Resilience)

**Q1. ECS 태스크 장애 시 자동 복구 방식**  
ECS 서비스가 태스크 장애를 감지하면 어떻게 처리할까요?

A) ECS 서비스 기본 동작 유지 — 헬스체크 실패 시 태스크 자동 교체 (현재 설계 유지)  
B) 추가 복원력 패턴 적용 (Circuit Breaker, Retry 등)

[Answer]: A

> **추천: A** — demo에서 ECS 서비스의 기본 태스크 교체 동작으로 충분합니다. ALB 헬스체크 실패 → ECS가 태스크 중단 → 새 태스크 시작의 흐름이 자동으로 처리됩니다. Circuit Breaker 등 추가 패턴은 demo에 과잉입니다.

---

**Q2. Aurora 연결 실패 시 앱 레벨 재시도**  
DB 연결 실패 시 Prisma 레벨에서 재시도 설정이 필요한가요?

A) Prisma 기본 동작 유지 (연결 실패 시 에러 반환)  
B) Prisma connection pool 재시도 설정 추가 (`connection_limit`, `pool_timeout`)

[Answer]: B

> **추천: B** — Aurora Serverless v2가 스케일업 중일 때 일시적 연결 실패가 발생할 수 있습니다. Prisma의 `DATABASE_URL`에 `connection_limit=5&pool_timeout=10` 파라미터를 추가하는 것만으로 충분합니다. CDK 코드 변경 없이 환경변수 수준에서 처리됩니다.

---

### 📈 확장성 패턴 (Scalability)

**Q3. CDK 스택 파라미터화 수준**  
향후 스펙 변경(ACU, CPU/Memory 등)을 위해 CDK 코드를 파라미터화할까요?

A) 하드코딩 (demo 단순화 우선)  
B) CDK Context 또는 상수 파일로 주요 값 분리

[Answer]: B

> **추천: B** — `lib/config.ts` 파일에 ACU, CPU, Memory, 태스크 수 등을 상수로 분리하면 코드 한 곳만 수정해서 재배포할 수 있습니다. 하드코딩 대비 코드량 차이가 거의 없고, 나중에 스펙을 올릴 때 훨씬 편합니다.

---

### ⚡ 성능 패턴 (Performance)

**Q4. CloudFront 압축 설정**  
CloudFront에서 응답 압축(Gzip/Brotli)을 활성화할까요?

A) 활성화 (기본값, 추가 비용 없음)  
B) 비활성화

[Answer]: A

> **추천: A** — CloudFront 압축은 기본값이 활성화이고 추가 비용이 없습니다. 이미지 외 텍스트 응답(JSON, HTML)의 전송 크기를 줄여 demo 시연 속도에 도움이 됩니다.

---

**Q5. ECS 컨테이너 로그 레벨**  
CloudWatch Logs에 기록할 로그 레벨은?

A) `info` (기본, 주요 요청/응답 기록)  
B) `debug` (상세 로그, 디버깅 용이하지만 로그 양 많음)  
C) 환경변수로 제어 (`LOG_LEVEL=info`, 필요 시 변경)

[Answer]: C

> **추천: C** — `LOG_LEVEL` 환경변수로 제어하면 재배포 없이 Parameter Store 값만 바꿔서 로그 레벨을 조정할 수 있습니다. 평상시 `info`, 디버깅 시 `debug`로 전환 가능합니다.

---

### 🔒 보안 패턴 (Security)

**Q6. S3 Pre-signed URL 만료 시간**  
업로드용 Pre-signed URL의 만료 시간은?

A) 5분 (짧고 안전)  
B) 15분 (업로드 시간 여유)  
C) 1시간

[Answer]: A

> **추천: A** — Pre-signed URL은 발급 즉시 사용하는 구조이므로 5분이면 충분합니다. 만료 시간이 길수록 URL 유출 시 위험이 커집니다. 이 값은 StorageService(앱 코드)에서 설정하지만, 인프라 설계 문서에 명시해두면 앱 개발자가 참조할 수 있습니다.

---

**Q7. ECS 태스크 네트워크 아웃바운드 제한**  
ECS 보안 그룹의 아웃바운드 규칙을 제한할까요?

A) 아웃바운드 전체 허용 (0.0.0.0/0) — 기본값, demo 단순화  
B) 아웃바운드를 필요한 대상만 허용 (Aurora 5432, ECR/S3 HTTPS 443 등)

[Answer]: A

> **추천: A** — demo에서 아웃바운드 제한은 설정 복잡도만 높입니다. ECS가 ECR, S3, Cognito, Secrets Manager, Parameter Store 등 다양한 AWS 서비스에 접근해야 하는데, 각 서비스의 IP 범위를 모두 열거하는 것은 번거롭습니다. 인바운드는 이미 최소 권한으로 제어되어 있습니다.
