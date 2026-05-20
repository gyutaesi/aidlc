# Unit 1: Infrastructure — Domain Entities

> **작성일**: 2026-05-20  
> **용도**: Demo  
> **설명**: CDK 스택 및 AWS 리소스 엔티티 정의

---

## 1. CDK 스택 엔티티

### NetworkStack
```typescript
interface NetworkStackProps extends StackProps {
  // 입력 없음 (독립 스택)
}

// 출력 (다른 스택에 전달)
interface NetworkStackOutputs {
  vpc: ec2.Vpc
  privateSubnets: ec2.ISubnet[]
  publicSubnets: ec2.ISubnet[]
  albSg: ec2.SecurityGroup      // ALB 보안 그룹
  ecsSg: ec2.SecurityGroup      // ECS 태스크 보안 그룹
  dbSg: ec2.SecurityGroup       // Aurora 보안 그룹
}
```

**VPC 구성**:
| 속성 | 값 |
|------|-----|
| CIDR | `10.0.0.0/16` |
| AZ 수 | 2 |
| Public 서브넷 | 2개 (`10.0.0.0/24`, `10.0.1.0/24`) |
| Private 서브넷 | 2개 (`10.0.2.0/24`, `10.0.3.0/24`) |
| NAT Gateway | 1개 (첫 번째 AZ) |
| DNS 호스트명 | 활성화 |

---

### DatabaseStack
```typescript
interface DatabaseStackProps extends StackProps {
  vpc: ec2.Vpc
  dbSg: ec2.SecurityGroup
  privateSubnets: ec2.ISubnet[]
}

interface DatabaseStackOutputs {
  cluster: rds.DatabaseCluster
  dbSecret: secretsmanager.ISecret   // Secrets Manager 자격증명
  clusterEndpoint: string            // 호스트명
}
```

**Aurora 클러스터 구성**:
| 속성 | 값 |
|------|-----|
| 엔진 | Aurora PostgreSQL 15.x |
| 인스턴스 타입 | Serverless v2 |
| Min ACU | 0.5 |
| Max ACU | 4 |
| 인스턴스 수 | 1 (Writer only) |
| DB명 | `moaring` |
| 사용자명 | `moaring_admin` |
| 백업 보존 | 1일 |
| 삭제 정책 | `DESTROY` |
| 최종 스냅샷 | 없음 |

---

### AuthStack
```typescript
interface AuthStackProps extends StackProps {
  // 입력 없음 (독립 스택)
}

interface AuthStackOutputs {
  userPool: cognito.UserPool
  userPoolClient: cognito.UserPoolClient
  userPoolId: string
  userPoolClientId: string
}
```

**Cognito User Pool 구성**:
| 속성 | 값 |
|------|-----|
| 로그인 식별자 | 이메일 |
| 이메일 인증 | 필수 |
| 이메일 발신 | Cognito 기본 (MVP) |
| MFA | 없음 |
| 비밀번호 최소 길이 | 8자 |
| 비밀번호 요구사항 | 대문자, 소문자, 숫자 필수 |
| 삭제 정책 | `DESTROY` |

**App Client 구성**:
| 속성 | 값 |
|------|-----|
| Client Secret | 없음 |
| 인증 플로우 | `USER_PASSWORD_AUTH`, `REFRESH_TOKEN_AUTH` |
| Access Token 만료 | 60분 |
| ID Token 만료 | 60분 |
| Refresh Token 만료 | 30일 |

---

### StorageStack
```typescript
interface StorageStackProps extends StackProps {
  // 입력 없음 (독립 스택)
}

interface StorageStackOutputs {
  bucket: s3.Bucket
  distribution: cloudfront.Distribution
  bucketName: string
  distributionDomain: string
}
```

**S3 버킷 구성**:
| 속성 | 값 |
|------|-----|
| 버킷명 | `moaring-storage-{account}-{region}` |
| 퍼블릭 접근 | 전체 차단 |
| 버전 관리 | 비활성화 (demo) |
| 암호화 | S3 관리 키 (SSE-S3) |
| CORS | PUT/GET 허용, Origin `*` |
| 삭제 정책 | `DESTROY` + `autoDeleteObjects: true` |

**CloudFront 구성**:
| 속성 | 값 |
|------|-----|
| Origin | S3 버킷 (OAC) |
| 기본 TTL | 86400초 (1일) |
| 최대 TTL | 31536000초 (1년) |
| 뷰어 프로토콜 | HTTP and HTTPS |
| 가격 등급 | `PRICE_CLASS_100` |
| 압축 | 활성화 |

---

### AppStack
```typescript
interface AppStackProps extends StackProps {
  vpc: ec2.Vpc
  publicSubnets: ec2.ISubnet[]
  privateSubnets: ec2.ISubnet[]
  albSg: ec2.SecurityGroup
  ecsSg: ec2.SecurityGroup
  dbSecret: secretsmanager.ISecret
  userPool: cognito.UserPool
  userPoolClient: cognito.UserPoolClient
  bucket: s3.Bucket
  distribution: cloudfront.Distribution
}

interface AppStackOutputs {
  ecrRepository: ecr.Repository
  cluster: ecs.Cluster
  service: ecs.FargateService
  alb: elbv2.ApplicationLoadBalancer
  albDnsName: string
}
```

**ECR 레포지토리**:
| 속성 | 값 |
|------|-----|
| 레포지토리명 | `moaring-app` |
| 이미지 보존 | 최신 5개 |
| 이미지 스캔 | 비활성화 (demo) |
| 삭제 정책 | `DESTROY` |

**ECS 클러스터**:
| 속성 | 값 |
|------|-----|
| 클러스터명 | `moaring-cluster` |
| Container Insights | 비활성화 (demo) |

**Task Definition**:
| 속성 | 값 |
|------|-----|
| CPU | 512 |
| Memory | 1024 MB |
| 네트워크 모드 | `awsvpc` |
| 컨테이너명 | `moaring-app` |
| 컨테이너 포트 | 3000 |
| 로그 드라이버 | `awslogs` |
| 로그 그룹 | `/ecs/moaring` |
| 로그 보존 | 7일 |

**ECS Service**:
| 속성 | 값 |
|------|-----|
| 서비스명 | `moaring-service` |
| 태스크 수 | 1 (고정) |
| 배포 방식 | Rolling update |
| minimumHealthyPercent | 0 (태스크 1개 환경 배포 필수 설정) |
| maximumPercent | 200 |
| 헬스체크 유예 | 60초 |
| 퍼블릭 IP | 없음 |

**ALB**:
| 속성 | 값 |
|------|-----|
| 이름 | `moaring-alb` |
| 스킴 | Internet-facing |
| 리스너 포트 | HTTP 80 |
| 타겟 포트 | 3000 |
| 헬스체크 경로 | `/api/health` |
| 헬스체크 정상 임계값 | 2회 |
| 헬스체크 비정상 임계값 | 3회 |
| 헬스체크 간격 | 30초 |

**IAM Task Execution Role 권한** (ECS 에이전트 사용 — CDK가 자동 생성):
| 서비스 | 액션 | 리소스 |
|--------|------|--------|
| ECR | `ecr:GetAuthorizationToken` | `*` |
| ECR | `ecr:BatchGetImage`, `ecr:GetDownloadUrlForLayer` | `{repo-arn}` |
| Logs | `logs:CreateLogStream`, `logs:PutLogEvents` | `/ecs/moaring` |
| Secrets Manager | `secretsmanager:GetSecretValue` | `{dbSecret-arn}` |

**IAM Task Role 권한** (앱 코드 사용):
| 서비스 | 액션 | 리소스 |
|--------|------|--------|
| SSM | `ssm:GetParameters`, `ssm:GetParameter` | `/moaring/prod/*` |
| S3 | `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject` | `{bucket-arn}/*` |
| SSM Messages | `ssmmessages:CreateControlChannel`, `ssmmessages:CreateDataChannel`, `ssmmessages:OpenControlChannel`, `ssmmessages:OpenDataChannel` | `*` (ECS Exec용) |

---

### ConfigStack
```typescript
interface ConfigStackProps extends StackProps {
  cluster: rds.DatabaseCluster
  dbSecret: secretsmanager.ISecret   // AppStack에서 Task Definition secrets로 직접 참조
  userPool: cognito.UserPool
  userPoolClient: cognito.UserPoolClient
  bucket: s3.Bucket
  distribution: cloudfront.Distribution
  region: string
}
```

**Parameter Store 엔티티** (비민감 설정값만 — DB 자격증명은 Secrets Manager 직접 사용):

| 파라미터명 | 타입 | 설명 |
|-----------|------|------|
| `/moaring/prod/cognito-user-pool-id` | String | Cognito User Pool ID |
| `/moaring/prod/cognito-client-id` | String | App Client ID |
| `/moaring/prod/s3-bucket-name` | String | S3 버킷명 |
| `/moaring/prod/cloudfront-domain` | String | CloudFront 도메인 (https:// 포함) |
| `/moaring/prod/aws-region` | String | 배포 리전 (예: `ap-northeast-2`) |

---

## 2. 리소스 네이밍 규칙

| 리소스 | 네이밍 패턴 | 예시 |
|--------|------------|------|
| VPC | `moaring-vpc` | `moaring-vpc` |
| 보안 그룹 | `moaring-{role}-sg` | `moaring-alb-sg` |
| Aurora 클러스터 | `moaring-db` | `moaring-db` |
| Cognito User Pool | `moaring-user-pool` | `moaring-user-pool` |
| S3 버킷 | `moaring-storage-{account}-{region}` | `moaring-storage-123456789-ap-northeast-2` |
| ECR 레포지토리 | `moaring-app` | `moaring-app` |
| ECS 클러스터 | `moaring-cluster` | `moaring-cluster` |
| ECS 서비스 | `moaring-service` | `moaring-service` |
| ALB | `moaring-alb` | `moaring-alb` |
| CloudWatch 로그 그룹 | `/ecs/moaring` | `/ecs/moaring` |

---

## 3. 리소스 간 의존성 그래프

```
NetworkStack
  └── vpc, albSg, ecsSg, dbSg
        │
        ├──► DatabaseStack
        │      └── cluster, dbSecret
        │
        └──► AppStack ◄── AuthStack (userPool, userPoolClient)
                     ◄── StorageStack (bucket, distribution)
                     └── ecrRepository, cluster, service, alb
                           │
                           └──► ConfigStack
                                  └── Parameter Store (6개 파라미터)
```
