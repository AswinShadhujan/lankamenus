FROM node:18-alpine

WORKDIR /app

# Install required libs for Prisma (IMPORTANT)
RUN apk add --no-cache openssl libc6-compat

# Enable pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy workspace files
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./

# Copy API package.json + prisma schema + prisma config BEFORE install
COPY services/api/package.json ./services/api/
COPY services/api/prisma ./services/api/prisma
COPY services/api/prisma.config.ts ./services/api/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy full project
COPY . .

# Generate Prisma client
RUN pnpm --filter api exec prisma generate

# Build API
RUN pnpm --filter api build

# Move into API folder
WORKDIR /app/services/api

EXPOSE 3000

ENV NODE_ENV=production

CMD ["node", "dist/main.js"]
