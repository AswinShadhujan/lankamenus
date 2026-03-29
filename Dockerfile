# API image — before `pnpm install`: copy services/api/prisma + prisma.config.ts, and use --ignore-scripts (see root packageManager for pnpm version).
FROM node:18-alpine

WORKDIR /app

# Prisma engines + native deps (bcrypt, etc.) may need compile on Alpine
RUN apk add --no-cache openssl libc6-compat python3 make g++

# Match root package.json "packageManager" (avoids Corepack switching pnpm mid-build)
RUN corepack enable && corepack prepare pnpm@8.15.9 --activate

# Copy workspace files
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./

# Copy API package.json + prisma schema + prisma config BEFORE install
COPY services/api/package.json ./services/api/
COPY services/api/prisma ./services/api/prisma
COPY services/api/prisma.config.ts ./services/api/

# Schema must exist before any prisma generate (postinstall or manual)
RUN test -f services/api/prisma/schema.prisma

# Skip lifecycle scripts during install so a stray postinstall cannot run
# prisma generate before the full tree exists; native modules are rebuilt next.
RUN pnpm install --frozen-lockfile --ignore-scripts

# Copy full project
COPY . .

RUN pnpm rebuild

# Generate Prisma client (explicit; do not rely on install postinstall)
RUN pnpm --filter api exec prisma generate

# Build API
RUN pnpm --filter api build

# Move into API folder
WORKDIR /app/services/api

EXPOSE 3000

ENV NODE_ENV=production

CMD ["node", "dist/main.js"]
