# NestJS API — production image (npm, Node 18)
#
# Refresh package-lock.json (do not run npm inside a pnpm node_modules tree — npm 11 can crash):
#   .\scripts\refresh-npm-lock.ps1
FROM node:18-alpine

WORKDIR /app

# Prisma engines on Alpine
RUN apk add --no-cache libc6-compat openssl

COPY package*.json ./

# Skip lifecycle scripts until source is present (postinstall runs nest build).
RUN npm ci --ignore-scripts

COPY . .

RUN npx prisma generate
RUN npm run build

EXPOSE 3000

ENV NODE_ENV=production

CMD ["node", "dist/main.js"]
