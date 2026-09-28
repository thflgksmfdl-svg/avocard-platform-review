#!/bin/bash
set -e

echo "==> Running Prisma migrations..."
npx prisma migrate deploy --schema backend/prisma/schema.prisma

echo "==> Running Prisma seed..."
(cd backend && npx prisma db seed)

if [ -n "$REVIEW_ACCOUNT_EMAIL" ] && [ -n "$REVIEW_ACCOUNT_PASSWORD" ]; then
  echo "==> Ensuring temporary review account..."
  (cd backend && npx tsx prisma/create-review-account.ts "$REVIEW_ACCOUNT_EMAIL" "$REVIEW_ACCOUNT_PASSWORD")
fi

echo "==> Starting AVOCARD backend..."
exec "$@"
