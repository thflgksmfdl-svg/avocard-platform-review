#!/bin/bash
set -e

echo "==> Running Prisma migrations..."
npx prisma migrate deploy --schema backend/prisma/schema.prisma

echo "==> Running Prisma seed..."
(cd backend && npx prisma db seed)

echo "==> Starting AVOCARD backend..."
exec "$@"
