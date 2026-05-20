#!/bin/sh
set -e

# DATABASE_URL 조합 (ECS 환경변수에서 개별 값을 받아 Prisma가 사용할 URL 생성)
if [ -z "$DATABASE_URL" ] && [ -n "$DB_HOST" ]; then
  export DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}?schema=public"
  echo "DATABASE_URL constructed from individual DB_* env vars"
fi

# Prisma 마이그레이션 실행 (프로덕션 배포 시)
if [ "$RUN_MIGRATIONS" = "true" ]; then
  echo "Running Prisma migrations..."
  npx prisma migrate deploy
  echo "Migrations complete"
fi

# Next.js 서버 시작
exec node server.js
