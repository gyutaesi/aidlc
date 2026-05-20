#!/bin/bash
set -e

# ─────────────────────────────────────────────────────────
# moaring 전체 배포 스크립트
# 사용법: ./scripts/deploy.sh [step]
#   step: all | infra | app | extension-config
# ─────────────────────────────────────────────────────────

REGION="us-east-1"
PROJECT="moaring"
CLUSTER_NAME="${PROJECT}-cluster"
SERVICE_NAME="${PROJECT}-service"
ECR_REPO_NAME="${PROJECT}-app"
ALB_NAME="${PROJECT}-alb"
AUTH_STACK="${PROJECT}-prod-auth"

STEP=${1:-all}

echo "🚀 moaring 배포 시작 (step: $STEP)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# AWS 자격증명 확인
echo "📋 AWS 자격증명 확인..."
aws sts get-caller-identity --region $REGION || {
  echo "❌ AWS 자격증명이 설정되지 않았습니다."
  echo "   aws configure 또는 환경변수를 설정해주세요."
  exit 1
}
echo ""

# ─────────────────────────────────────────────────────────
# Step 1: CDK 인프라 배포
# ─────────────────────────────────────────────────────────
deploy_infra() {
  echo "📦 Step 1: CDK 인프라 배포"
  echo "─────────────────────────────────────────────────────"
  
  cd infra
  npm install
  
  # CDK Bootstrap (최초 1회 — 이미 되어있으면 스킵)
  echo "  → CDK Bootstrap 확인..."
  ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
  npx cdk bootstrap aws://$ACCOUNT/$REGION 2>/dev/null || true
  
  # 전체 스택 배포
  echo "  → 전체 스택 배포 중... (약 15-20분 소요)"
  npx cdk deploy --all --require-approval never
  
  cd ..
  echo "✅ 인프라 배포 완료"
  echo ""
}

# ─────────────────────────────────────────────────────────
# Step 2: Next.js 앱 빌드 & 배포
# ─────────────────────────────────────────────────────────
deploy_app() {
  echo "🐳 Step 2: Next.js 앱 빌드 & 배포"
  echo "─────────────────────────────────────────────────────"
  
  # ECR URI 확인
  ECR_URI=$(aws ecr describe-repositories --repository-names $ECR_REPO_NAME \
    --region $REGION --query 'repositories[0].repositoryUri' --output text)
  echo "  → ECR URI: $ECR_URI"
  
  # Docker 로그인
  echo "  → ECR 로그인..."
  aws ecr get-login-password --region $REGION | \
    docker login --username AWS --password-stdin $ECR_URI
  
  # 이미지 빌드
  GIT_SHA=$(git rev-parse --short HEAD)
  echo "  → Docker 이미지 빌드 (tag: $GIT_SHA)..."
  docker build --platform linux/amd64 -t $ECR_REPO_NAME .
  
  # 태그 & Push
  docker tag $ECR_REPO_NAME:latest $ECR_URI:$GIT_SHA
  docker tag $ECR_REPO_NAME:latest $ECR_URI:latest
  
  echo "  → ECR Push..."
  docker push $ECR_URI:$GIT_SHA
  docker push $ECR_URI:latest
  
  # ECS 서비스 업데이트
  echo "  → ECS 서비스 업데이트 (desired-count: 1)..."
  aws ecs update-service \
    --cluster $CLUSTER_NAME \
    --service $SERVICE_NAME \
    --desired-count 1 \
    --force-new-deployment \
    --region $REGION > /dev/null
  
  echo "  → 서비스 안정화 대기 중..."
  aws ecs wait services-stable \
    --cluster $CLUSTER_NAME \
    --services $SERVICE_NAME \
    --region $REGION
  
  echo "✅ 앱 배포 완료"
  echo ""
}

# ─────────────────────────────────────────────────────────
# Step 3: Extension 설정 출력
# ─────────────────────────────────────────────────────────
configure_extension() {
  echo "🧩 Step 3: Chrome Extension 설정"
  echo "─────────────────────────────────────────────────────"
  
  # ALB URL
  ALB_DNS=$(aws elbv2 describe-load-balancers --names $ALB_NAME \
    --region $REGION --query 'LoadBalancers[0].DNSName' --output text)
  
  # Cognito 정보
  USER_POOL_ID=$(aws cloudformation describe-stacks --stack-name $AUTH_STACK \
    --region $REGION --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue" --output text)
  CLIENT_ID=$(aws cloudformation describe-stacks --stack-name $AUTH_STACK \
    --region $REGION --query "Stacks[0].Outputs[?OutputKey=='UserPoolClientId'].OutputValue" --output text)
  COGNITO_DOMAIN=$(aws cloudformation describe-stacks --stack-name $AUTH_STACK \
    --region $REGION --query "Stacks[0].Outputs[?OutputKey=='CognitoDomain'].OutputValue" --output text)
  
  echo ""
  echo "  📝 extension/.env.production 업데이트:"
  echo "  ─────────────────────────────────────────"
  echo "  VITE_USE_MOCK=false"
  echo "  VITE_API_BASE_URL=http://$ALB_DNS"
  echo "  VITE_COGNITO_DOMAIN=$COGNITO_DOMAIN"
  echo "  VITE_COGNITO_CLIENT_ID=$CLIENT_ID"
  echo "  VITE_COGNITO_REGION=$REGION"
  echo "  VITE_WEBAPP_URL=http://$ALB_DNS"
  echo ""
  
  # .env.production 자동 업데이트
  cat > extension/.env.production << EOF
VITE_USE_MOCK=false
VITE_API_BASE_URL=http://$ALB_DNS
VITE_COGNITO_DOMAIN=$COGNITO_DOMAIN
VITE_COGNITO_CLIENT_ID=$CLIENT_ID
VITE_COGNITO_REGION=$REGION
VITE_WEBAPP_URL=http://$ALB_DNS
EOF
  
  echo "  ✅ extension/.env.production 자동 업데이트 완료"
  echo ""
  echo "  🔧 Extension 빌드:"
  echo "     cd extension && npm run build"
  echo ""
  echo "  📌 Chrome에서 로드:"
  echo "     chrome://extensions → 개발자 모드 → 압축해제된 확장 프로그램 로드"
  echo "     → extension/dist 폴더 선택"
  echo ""
  echo "  ⚠️  Extension ID 확인 후 Cognito App Client에 callback URL 추가 필요:"
  echo "     chrome-extension://{EXTENSION_ID}/"
  echo ""
}

# ─────────────────────────────────────────────────────────
# 배포 결과 요약
# ─────────────────────────────────────────────────────────
print_summary() {
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "🎉 moaring 배포 완료!"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  
  ALB_DNS=$(aws elbv2 describe-load-balancers --names $ALB_NAME \
    --region $REGION --query 'LoadBalancers[0].DNSName' --output text 2>/dev/null || echo "N/A")
  
  echo ""
  echo "  🌐 앱 URL:     http://$ALB_DNS"
  echo "  🏥 헬스체크:   http://$ALB_DNS/api/health"
  echo "  📊 ECS 콘솔:   https://$REGION.console.aws.amazon.com/ecs/v2/clusters/$CLUSTER_NAME"
  echo "  📋 로그:       https://$REGION.console.aws.amazon.com/cloudwatch/home?region=$REGION#logsV2:log-groups/log-group/%2Fecs%2Fmoaring"
  echo ""
}

# ─────────────────────────────────────────────────────────
# 실행
# ─────────────────────────────────────────────────────────
case $STEP in
  all)
    deploy_infra
    deploy_app
    configure_extension
    print_summary
    ;;
  infra)
    deploy_infra
    ;;
  app)
    deploy_app
    ;;
  extension-config)
    configure_extension
    ;;
  *)
    echo "사용법: ./scripts/deploy.sh [all|infra|app|extension-config]"
    exit 1
    ;;
esac
