# Build Instructions — moaring (Unit 2: Next.js App)

## 사전 요구사항

| 항목           | 버전     | 확인 명령                |
| -------------- | -------- | ------------------------ |
| Node.js        | 20.x LTS | `node --version`         |
| npm            | 10.x     | `npm --version`          |
| Docker         | 24.x+    | `docker --version`       |
| Docker Compose | 2.x      | `docker compose version` |
| AWS CLI        | 2.x      | `aws --version`          |

### 필수 환경 변수 (`.env.local`)

```bash
DATABASE_URL=postgresql://moaring:moaring_local@localhost:5432/moaring?connection_limit=5
COGNITO_USER_POOL_ID=us-east-1_xxxxxxxxx
COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
COGNITO_REGION=us-east-1
AWS_S3_BUCKET_NAME=moaring-assets-dev-{account-id}
AWS_CLOUDFRONT_DOMAIN=xxxxxxxxxx.cloudfront.net
AWS_REGION=us-east-1
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## 로컬 개발 빌드

### 1. 의존성 설치

```bash
cd /home/ksg/Projects/aidlc
npm install
```

### 2. 로컬 DB 시작

```bash
docker compose up -d
# 헬스체크 확인
docker compose ps
```

### 3. Prisma 클라이언트 생성 + 마이그레이션

```bash
# Prisma 클라이언트 생성
npx prisma generate

# 마이그레이션 실행 (로컬 개발)
npx prisma migrate dev --name init

# Generated Column 마이그레이션 적용
psql postgresql://moaring:moaring_local@localhost:5432/moaring \
  -f prisma/migrations/add_search_vectors/migration.sql
```

### 4. Next.js 개발 서버 실행

```bash
npm run dev
# → http://localhost:3000
```

### 5. TypeScript 타입 체크

```bash
npx tsc --noEmit
# 에러 없으면 타입 체크 통과
```

### 6. Lint 검사

```bash
npm run lint
# 에러 없으면 통과 (warning은 허용)
```

---

## 프로덕션 빌드

### 1. Next.js 빌드

```bash
npm run build
# .next/standalone/ 디렉토리 생성 확인
```

**성공 출력 예시**:

```
✓ Compiled successfully
✓ Linting and checking validity of types
✓ Collecting page data
✓ Generating static pages
✓ Finalizing page optimization
```

**빌드 산출물**:

- `.next/standalone/` — 실행 가능한 Node.js 서버
- `.next/static/` — 정적 자산
- `.next/standalone/server.js` — 진입점

### 2. Docker 이미지 빌드

```bash
docker build -t moaring/app:latest .
# 이미지 크기 확인 (목표: < 500MB)
docker images moaring/app
```

### 3. Docker 이미지 로컬 실행 테스트

```bash
docker run --rm \
  -p 3000:3000 \
  -e DATABASE_URL="postgresql://..." \
  -e COGNITO_USER_POOL_ID="..." \
  -e COGNITO_CLIENT_ID="..." \
  -e COGNITO_REGION="us-east-1" \
  -e AWS_S3_BUCKET_NAME="..." \
  -e AWS_CLOUDFRONT_DOMAIN="..." \
  -e AWS_REGION="us-east-1" \
  -e NEXT_PUBLIC_APP_URL="http://localhost:3000" \
  moaring/app:latest

# 헬스체크
curl http://localhost:3000/api/health
# 기대 응답: {"status":"ok","timestamp":"..."}
```

### 4. ECR 푸시 (프로덕션 배포 시)

```bash
# ECR 로그인
aws ecr get-login-password --region us-east-1 \
  | docker login --username AWS --password-stdin \
    {account}.dkr.ecr.us-east-1.amazonaws.com

# 태그 지정
docker tag moaring/app:latest \
  {account}.dkr.ecr.us-east-1.amazonaws.com/moaring/app:latest
docker tag moaring/app:latest \
  {account}.dkr.ecr.us-east-1.amazonaws.com/moaring/app:$(git rev-parse --short HEAD)

# 푸시
docker push {account}.dkr.ecr.us-east-1.amazonaws.com/moaring/app:latest
docker push {account}.dkr.ecr.us-east-1.amazonaws.com/moaring/app:$(git rev-parse --short HEAD)
```

---

## 트러블슈팅

### `prisma generate` 실패

```bash
# node_modules 재설치
rm -rf node_modules
npm install
npx prisma generate
```

### TypeScript 에러

```bash
# 타입 에러 상세 확인
npx tsc --noEmit 2>&1 | head -50
```

### Docker 빌드 실패 (Alpine 호환성)

```bash
# cheerio 등 native 모듈 문제 시
# Dockerfile의 deps stage에 추가:
# RUN apk add --no-cache python3 make g++
```

### DB 연결 실패

```bash
# Docker Compose 상태 확인
docker compose ps
docker compose logs postgres

# 연결 테스트
psql postgresql://moaring:moaring_local@localhost:5432/moaring -c "SELECT 1"
```
