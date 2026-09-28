#!/bin/bash
set -e

echo "==> Running Prisma migrations..."
npx prisma migrate deploy --schema backend/prisma/schema.prisma

echo "==> Running Prisma seed..."
npx prisma db seed --schema backend/prisma/schema.prisma

echo "==> Starting AVOCARD backend..."
exec "$@"
