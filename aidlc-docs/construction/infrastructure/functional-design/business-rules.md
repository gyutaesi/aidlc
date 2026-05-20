# Unit 1: Infrastructure — Business Rules

> **작성일**: 2026-05-20  
> **용도**: Demo

---

## 1. 네트워킹 규칙

### BR-NET-01: 보안 그룹 최소 권한 원칙
- ALB 보안 그룹은 인터넷(0.0.0.0/0)에서 HTTP(80)만 허용
- ECS 보안 그룹은 ALB 보안 그룹 소스에서 포트 3000만 허용 (IP 범위 아님)
- DB 보안 그룹은 ECS 보안 그룹 소스에서 포트 5432만 허용
- 어떤 보안 그룹도 인바운드 SSH(22) 허용 금지

### BR-NET-02: Private 서브넷 격리
- Aurora와 ECS는 반드시 Private 서브넷에 배치
- ALB만 Public 서브넷에 배치
- ECS 태스크에 퍼블릭 IP 자동 할당 금지 (`assignPublicIp: false`)

### BR-NET-03: NAT Gateway 단일화 (demo)
- NAT Gateway는 1개만 생성 (첫 번째 AZ)
- Private 서브넷 라우팅 테이블은 모두 동일 NAT Gateway를 가리킴

---

## 2. 데이터베이스 규칙

### BR-DB-01: 자격증명 관리
- DB 비밀번호는 CDK가 Secrets Manager에 자동 생성 (수동 설정 금지)
- 비밀번호는 코드, 환경변수 파일, Parameter Store에 평문/암호화 불문 저장 금지
- ECS Task Definition의 `secrets` 필드에서 Secrets Manager ARN을 직접 참조
- ECS 에이전트가 태스크 시작 시 Secrets Manager 값을 읽어 `DATABASE_URL` 환경변수로 주입
- DB URL 형식: `postgresql://moaring_admin:{password}@{endpoint}:5432/moaring` (ECS 런타임에 조합)

### BR-DB-02: 연결 문자열 구성
- DB URL 형식: `postgresql://{user}:{password}@{endpoint}:5432/moaring`
- 데이터베이스명: `moaring` (고정)
- DB URL은 ECS Task Definition에서 Secrets Manager를 통해 런타임 주입 (Parameter Store 미사용)
- 연결 풀 설정은 애플리케이션(Prisma) 레벨에서 관리

### BR-DB-03: Demo 삭제 정책
- 모든 스택의 삭제 정책은 `RemovalPolicy.DESTROY`
- Aurora 클러스터 삭제 시 스냅샷 생성 안 함 (`skipFinalSnapshot: true`)
- `cdk destroy` 한 번으로 모든 리소스 정리 가능해야 함

### BR-DB-04: 네트워크 접근
- Aurora는 퍼블릭 접근 비활성화 (`publiclyAccessible: false`)
- VPC 외부에서 직접 DB 접근 불가 (ECS를 통해서만 접근)

---

## 3. 인증 규칙

### BR-AUTH-01: Cognito User Pool 불변성
- User Pool은 한번 생성 후 일부 설정 변경 불가 (로그인 식별자, MFA 정책 등)
- CDK 업데이트 시 User Pool 교체(replace)가 발생하면 기존 사용자 데이터 손실
- User Pool 설정 변경 시 반드시 `cdk diff`로 교체 여부 확인 후 진행

### BR-AUTH-02: App Client Secret 없음
- App Client는 `generateSecret: false` (SPA, Chrome Extension에서 직접 호출)
- Client Secret이 있으면 브라우저/Extension에서 호출 불가

### BR-AUTH-03: 토큰 만료 정책
- Access Token: 1시간 (NFR-02-3 준수)
- Refresh Token: 30일
- ID Token: 1시간
- 이 값은 CDK 코드에 상수로 정의 (환경변수 아님)

---

## 4. 스토리지 규칙

### BR-S3-01: 퍼블릭 접근 차단
- S3 버킷은 `blockPublicAccess: BlockPublicAccess.BLOCK_ALL`
- 모든 객체 접근은 CloudFront OAC를 통해서만 허용
- Pre-signed URL은 서버(ECS)에서만 생성 가능

### BR-S3-02: CORS 설정
- 허용 메서드: `PUT`, `GET`
- 허용 오리진: `*` (demo — 운영 시 도메인 제한 필요)
- 허용 헤더: `*`
- Pre-signed URL 업로드(PUT)가 브라우저에서 직접 동작하기 위해 필요

### BR-S3-03: 객체 경로 규칙
- 경로 형식: `users/{userId}/{type}/{uuid}.{ext}`
- 이 규칙은 애플리케이션(StorageService) 레벨에서 강제
- CDK는 버킷만 생성, 경로 규칙은 앱 코드 책임

### BR-S3-04: CloudFront OAC
- S3 버킷 정책은 CloudFront OAC Principal만 허용
- OAC 서명 방식: `sigv4` (OAI 대신 OAC 사용 — AWS 최신 권장)

---

## 5. 컨테이너 규칙

### BR-ECS-01: 이미지 태그 정책
- ECR 이미지는 반드시 태그를 사용 (`latest` 태그 단독 사용 금지)
- 권장 태그 형식: `{git-commit-sha}` 또는 `{YYYY-MM-DD-HHmm}`
- ECS Task Definition은 특정 이미지 태그를 명시 (latest 참조 금지)

### BR-ECS-02: 환경변수 주입
- DB 자격증명(`DATABASE_URL`)은 ECS Task Definition `secrets` 필드 → Secrets Manager ARN 직접 참조
- 비민감 정보(버킷명, Cognito ID, 리전 등)는 Parameter Store → ECS `environment` 필드로 주입
- 컨테이너 이미지에 환경변수 하드코딩 금지

### BR-ECS-05: 태스크 1개 환경 배포 설정
- `minimumHealthyPercent: 0` 필수 설정 (기본값 100%이면 태스크 1개 환경에서 Rolling update 불가)
- `maximumPercent: 200` (새 태스크 먼저 시작 후 구 태스크 종료)
- 배포 중 짧은 다운타임 허용 (demo 환경)

### BR-ECS-03: 헬스체크
- ALB 헬스체크: `GET /api/health` → HTTP 200 응답 필수
- 헬스체크 실패 시 ALB가 해당 태스크로 트래픽 전송 중단
- ECS 서비스는 헬스체크 실패 태스크를 자동 교체

### BR-ECS-04: Task Role / Task Execution Role 분리
- **Task Execution Role** (ECS 에이전트 사용):
  - `ecr:GetAuthorizationToken`, `ecr:BatchGetImage`, `ecr:GetDownloadUrlForLayer` — ECR 이미지 pull
  - `logs:CreateLogStream`, `logs:PutLogEvents` — CloudWatch Logs 쓰기
  - `secretsmanager:GetSecretValue` — DB 자격증명 조회
- **Task Role** (앱 코드 사용):
  - `ssm:GetParameters`, `ssm:GetParameter`: `/moaring/prod/*` 경로만
  - `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject`: 해당 버킷 ARN만
  - `ssmmessages:CreateControlChannel`, `ssmmessages:CreateDataChannel`, `ssmmessages:OpenControlChannel`, `ssmmessages:OpenDataChannel`: `*` (ECS Exec 활성화용)
- 두 Role을 혼용하거나 단일 Role로 합치지 않음

---

## 6. Parameter Store 규칙

### BR-PS-01: 경로 규칙
- 모든 파라미터 경로: `/moaring/{env}/{key}` 형식
- 현재 환경: `prod`
- 키 이름: kebab-case (예: `db-url`, `cognito-user-pool-id`)

### BR-PS-02: 타입 분류
- SecureString: 해당 없음 (DB 자격증명은 Secrets Manager 직접 사용)
- String (평문): `cognito-user-pool-id`, `cognito-client-id`, `s3-bucket-name`, `cloudfront-domain`, `aws-region`

### BR-PS-03: CDK에서 값 저장
- ConfigStack에서 다른 스택의 출력값을 읽어 Parameter Store에 저장
- CDK 배포 완료 후 Parameter Store 값이 자동으로 최신 상태 유지

---

## 7. CDK 코드 규칙

### BR-CDK-01: 스택 간 참조
- 스택 간 리소스 참조는 CDK 객체 직접 전달 방식만 사용
- `Fn.importValue` / CloudFormation Export 사용 금지

### BR-CDK-02: 하드코딩 금지
- AWS 계정 ID, 리전은 CDK 환경 변수(`process.env.CDK_DEFAULT_ACCOUNT`, `CDK_DEFAULT_REGION`)에서 읽기
- 리소스 이름에 계정 ID 직접 삽입 금지

### BR-CDK-03: 태그 정책
- 모든 스택에 공통 태그 적용:
  - `Project`: `moaring`
  - `Environment`: `prod`
  - `ManagedBy`: `cdk`
