FROM node:26-alpine AS base
WORKDIR /app
RUN apk add --no-cache openssl

# Install dependencies and build the app
FROM base AS deps
COPY package.json ./
COPY prisma ./prisma
RUN npm install

# Rebuild Prisma Client
RUN npx prisma generate

# --- Build the SvelteKit app ---
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/prisma ./prisma
COPY . .

RUN npm run build

# --- Production image ---
FROM node:26-alpine AS runner

WORKDIR /app
RUN apk add --no-cache openssl

ENV NODE_ENV=production
ENV PORT=3000

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 sveltekit
RUN chown -R sveltekit:nodejs /app

COPY --from=build --chown=sveltekit:nodejs /app/build ./build
COPY --from=build --chown=sveltekit:nodejs /app/package.json ./
COPY --from=deps --chown=sveltekit:nodejs /app/node_modules ./node_modules
COPY --from=deps --chown=sveltekit:nodejs /app/prisma ./prisma

USER sveltekit
EXPOSE 3000
CMD ["node", "build"]

