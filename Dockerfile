# AVOCARD platform — single-container review/staging image.
# Builds the admin SPA (same-origin, relative API base) and the Fastify
# backend, then runs the backend in REVIEW_MODE serving the admin build as
# static files. Not intended as the eventual production deployment shape —
# this exists to give an external reviewer one HTTPS URL without exposing
# source, .env files, or the database port. See platform/README.md.

FROM node:20-slim AS build
WORKDIR /app

# Install system dependencies required by Prisma.
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Install all workspace deps once (dev deps included — needed for tsc/vite build).
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY admin/package.json admin/package.json
RUN npm install

COPY backend backend
COPY admin admin

# Admin: same-origin build (backend serves this dist/ itself in REVIEW_MODE).
RUN npm run build -w admin -- --mode review

# Backend: Prisma client generation only needs the schema, not a live DB.
RUN npx prisma generate --schema backend/prisma/schema.prisma
RUN npm run build -w backend

FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Install system dependencies required by Prisma at runtime.
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/backend/package.json backend/package.json
RUN npm install --omit=dev --workspace=backend

COPY --from=build /app/backend/dist backend/dist
COPY --from=build /app/backend/prisma backend/prisma
COPY --from=build /app/node_modules/.prisma node_modules/.prisma
COPY --from=build /app/admin/dist admin-dist

EXPOSE 4000
# ADMIN_STATIC_DIR points at the copied admin build; REVIEW_MODE and all
# secrets (DATABASE_URL, ADMIN_SESSION_SECRET, SHOPIFY_AUTH_MODE, ...) are
# set as environment variables in the hosting platform, never baked in here.
ENV ADMIN_STATIC_DIR=/app/admin-dist

# Entrypoint: run migrations and seed before starting the server.
COPY --from=build /app/backend/prisma/migrations backend/prisma/migrations
RUN mkdir -p /app/backend/prisma
COPY --from=build /app/backend/prisma/schema.prisma backend/prisma/schema.prisma

COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh
ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "backend/dist/server.js"]
