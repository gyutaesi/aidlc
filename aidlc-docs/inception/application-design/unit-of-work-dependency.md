# moaring — Unit of Work Dependency

> **목적**: Unit 간 의존성 관계 및 통합 포인트 정의

---

## 1. 의존성 매트릭스

| Unit | 의존하는 Unit | 의존 유형 | 의존 내용 |
|------|--------------|-----------|-----------|
| **Unit 1: 인프라** | 없음 | — | 독립적 |
| **Unit 2: Next.js 앱** | Unit 1 (배포 시) | 런타임 | ECS, Aurora, Cognito, S3, CloudFront 엔드포인트 |
| **Unit 3: Extension** | Unit 2 | API | moaring REST API (JWT 인증) |

---

## 2. 의존성 방향

```
Unit 1 (인프라)
    |
    | 배포 환경 제공 (ECS, Aurora, Cognito, S3, CloudFront)
    v
Unit 2 (Next.js 앱)
    |
    | REST API 제공 (HTTP + JWT)
    v
Unit 3 (Chrome Extension)
```

---

## 3. 통합 포인트 (Integration Points)

### Unit 1 → Unit 2
| 통합 포인트 | 제공 값 | 전달 방식 |
|-------------|---------|-----------|
| Aurora PostgreSQL | DB 연결 문자열 | AWS Parameter Store → ECS 환경변수 |
| Cognito User Pool | User Pool ID, App Client ID | AWS Parameter Store → ECS 환경변수 |
| S3 버킷 | 버킷명, 리전 | AWS Parameter Store → ECS 환경변수 |
| CloudFront | CDN 도메인 | AWS Parameter Store → ECS 환경변수 |
| ECS | 컨테이너 실행 환경 | Dockerfile → ECR → ECS Task |

### Unit 2 → Unit 3
| 통합 포인트 | 엔드포인트 | 인증 |
|-------------|-----------|------|
| 북마크 저장 | `POST /api/bookmarks` | Cognito JWT |
| 그룹 목록 | `GET /api/groups` | Cognito JWT |
| 최근 저장 목록 | `GET /api/bookmarks/recent` | Cognito JWT |
| 저장된 URL 목록 | `GET /api/bookmarks/urls` | Cognito JWT |
| Cognito 인증 | Cognito Hosted UI / API | — |

---

## 4. 개발 단계별 의존성

### Phase 1: 병렬 개발
```
Unit 1 ──────────────────────────────────────────► (CDK 스택 작성)
Unit 2 ──────────────────────────────────────────► (로컬 Docker Compose)
         의존성 없음 — 각자 독립적으로 개발 가능
```

### Phase 2: Extension 개발 시작 조건
```
Unit 2에서 아래 API 스펙이 확정되면 Unit 3 개발 시작:
- POST /api/bookmarks (Request/Response 타입 정의)
- GET  /api/groups
- GET  /api/bookmarks/recent
- GET  /api/bookmarks/urls

Unit 3는 Mock API로 개발 시작 (실제 서버 불필요)
```

### Phase 3: 통합
```
Unit 2 핵심 API 완성
    → Unit 3 Mock API → 실제 API 교체
    → CORS 설정 확인 (chrome-extension:// origin 허용)
    → Cognito 토큰 흐름 E2E 테스트
```

### Phase 4: 배포
```
Unit 1 CDK 배포 (cdk deploy)
    → Aurora, Cognito, S3, CloudFront, ECS 프로비저닝
    → Parameter Store에 설정값 저장
    → Unit 2 Docker 빌드 → ECR push → ECS 배포
    → Unit 3 Extension 빌드 → Developer mode 로드 → 테스트
```

---

## 5. 공유 타입 정의

Unit 2와 Unit 3가 공유하는 API 타입은 루트 레벨 `types/` 디렉토리에 정의합니다:

```
(루트)/
└── types/
    └── api.ts    # 공유 Request/Response 타입
```

```typescript
// types/api.ts — Unit 2와 Unit 3가 공유
export interface CreateBookmarkRequest {
  url: string
  title?: string
  description?: string
  memo?: string
  tagNames?: string[]
  groupId?: string
}

export interface BookmarkResponse {
  id: string
  url: string
  title: string
  description: string | null
  thumbnailUrl: string | null
  memo: string | null
  tags: string[]
  createdAt: string
}

export interface GroupResponse {
  id: string
  name: string
  emoji: string
  position: number
}
```

---

## 6. 리스크 및 완화 방안

| 리스크 | 영향 Unit | 완화 방안 |
|--------|-----------|-----------|
| Aurora Serverless v2 콜드 스타트 | Unit 2 | 최소 ACU 설정으로 콜드 스타트 방지 |
| Cognito MV3 Extension 인증 제약 | Unit 3 | `chrome.identity` 대신 Cognito Hosted UI 팝업 방식 사용 |
| CORS 설정 누락 | Unit 2, 3 | `chrome-extension://` origin을 Next.js CORS 설정에 명시 |
| API 스펙 변경으로 Extension 재작업 | Unit 3 | Phase 2 시작 전 핵심 API 타입을 `types/api.ts`에 확정 |
| CDK 배포 실패 | Unit 1, 2 | 스택별 독립 배포, 롤백 전략 문서화 |
