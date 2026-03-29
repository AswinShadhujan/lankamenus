# API image — pnpm workspace root (services/api only in workspace)
FROM node:18-alpine

WORKDIR /app

RUN apk add --no-cache libc6-compat openssl

RUN corepack enable && corepack prepare pnpm@8.15.9 --activate

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY services/api/package.json ./services/api/

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm --filter api exec prisma generate
RUN pnpm --filter api build

WORKDIR /app/services/api

EXPOSE 3000

ENV NODE_ENV=production

CMD ["node", "dist/main.js"]
