# syntax=docker/dockerfile:1

# Match CI. For fully reproducible builds, pin the digest as well:
#   docker buildx imagetools inspect node:24-alpine   -> node:24-alpine@sha256:<digest>
ARG NODE_VERSION=24

FROM node:${NODE_VERSION}-alpine AS base
WORKDIR /app
# Needed by the Prisma CLI (db push) on Alpine
RUN apk add --no-cache openssl

# --- All dependencies (incl. dev) + Prisma client generation ---
FROM base AS deps
# Lockfile is required so `npm ci` installs exactly what you tested
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN --mount=type=cache,target=/root/.npm npm ci
RUN npx prisma generate

# --- Build the SvelteKit app ---
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/prisma ./prisma
COPY . .
RUN BETTER_AUTH_SECRET=build-time-placeholder \
    BETTER_AUTH_URL=http://localhost:3000 \
    npm run build

# --- Production-only dependencies (no vite, svelte, tailwind, etc.) ---
FROM base AS prod-deps
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev

# --- Production image ---
FROM base AS runner
ENV NODE_ENV=production \
    PORT=3000

# Use the non-root `node` user that ships with the base image
RUN chown node:node /app

COPY --from=build     --chown=node:node /app/build ./build
COPY --from=build     --chown=node:node /app/package.json ./
COPY --from=build     --chown=node:node /app/prisma.config.ts ./
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
# Schema, seed script and generated client (used by the db-push service)
COPY --from=deps      --chown=node:node /app/prisma ./prisma

USER node
EXPOSE 3000

# 127.0.0.1, not localhost: Alpine resolves localhost to ::1 first
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO /dev/null "http://127.0.0.1:${PORT:-3000}/healthz" || exit 1

CMD ["node", "build"]
