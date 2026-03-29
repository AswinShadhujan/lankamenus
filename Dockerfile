FROM node:18-alpine

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy workspace files
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./

# Copy API package.json + prisma schema EARLY
COPY services/api/package.json ./services/api/
COPY services/api/prisma ./services/api/prisma
COPY services/api/prisma.config.ts ./services/api/

# Install deps (now prisma schema exists)
RUN pnpm install --frozen-lockfile

# Copy rest of code
COPY . .

# Generate Prisma client (safe now)
RUN pnpm --filter api exec prisma generate

# Build API
RUN pnpm --filter api build

WORKDIR /app/services/api

EXPOSE 3000

CMD ["node", "dist/main.js"]
