# Deployment and secrets

This document describes how to run the Lankamenus API, web app, and mobile app in production, which environment variables and secrets to set, and how CI/CD is configured.

---

## API (NestJS)

### Running in production

From the API package:

```bash
cd services/api
pnpm install --frozen-lockfile
pnpm run build
pnpm run start:prod
```

Or run the built output directly:

```bash
node dist/main.js
```

**Required:** `PORT`, `DATABASE_URL`, and `JWT_SECRET` must be set (see [Environment variables](#api-environment-variables) below). The API will not start without them (env validation runs at bootstrap).

### Database: PostGIS is required

Migrations run `CREATE EXTENSION postgis` and the `restaurants.geom` column uses **geography** (see `prisma/migrations`). **Railway’s default “PostgreSQL” plugin does not include PostGIS**, so `prisma migrate deploy` fails with `extension "postgis" is not available`.

**On Railway, use a PostGIS-enabled database instead of the plain Postgres template**, for example:

1. In your Railway project, add a database from the **[PostGIS template](https://railway.com/template/postgis)** (or another Postgres image that ships PostGIS).
2. Copy the new service’s **`DATABASE_URL`** (or `POSTGRES_URL`) into your API service variables as **`DATABASE_URL`** (keep `?schema=public` if you use it).
3. Apply migrations from `services/api` with **`DATABASE_URL`** set to that PostGIS database:
   - **Brand-new empty database** (you never ran Prisma migrations on it — no `_prisma_migrations` table): run **`pnpm run prisma:migrate`** only. Do **not** run `prisma:migrate:resolve-initial-failed`; Prisma will error with *“database without migrations table”* if you try.
   - **Database that already had a failed migration** (**P3009** / **P3018** and `_prisma_migrations` exists): run **`pnpm run prisma:migrate:resolve-initial-failed`**, then **`pnpm run prisma:migrate`** (or **`pnpm run prisma:migrate:recover-from-p3009`** once).

After switching to PostGIS, redeploy the API so `preDeployCommand` can apply migrations successfully.

### Prisma production runbook

From `services/api`, use these commands in production order:

```bash
pnpm run prisma:migrate
pnpm run prisma:generate
```

Optional one-time seed (for bootstrapping empty environments):

```bash
pnpm run prisma:seed
```

Notes:

- `prisma:migrate` runs `prisma migrate deploy` (safe for production).
- `prisma:generate` ensures Prisma Client matches the deployed schema.
- `prisma:seed` inserts sample restaurant/menu/menu-item data and is idempotent for the seeded restaurant slug.

### API environment variables

See `services/api/.env.example` for a template. Summary:

| Variable | Required | Description | Example (no real secrets) |
|---------|----------|-------------|---------------------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string | `postgresql://user:pass@host:5432/dbname?schema=public` |
| `PORT` | Yes (default 3001) | HTTP port | `3001` |
| `JWT_SECRET` | Yes | Secret for signing JWTs (min 16 chars) | Long random string |
| `CORS_ORIGINS` | No | Comma-separated allowed origins | `https://yourapp.com,https://admin.yourapp.com` |
| `REDIS_URL` | No | Redis for caching/sessions | `redis://localhost:6379` or `rediss://...` |
| `MEILISEARCH_HOST` | No | Meilisearch URL for search | `http://localhost:7700` |
| `MEILISEARCH_API_KEY` | No | Meilisearch API key | Optional |
| `NODE_ENV` | No | `production` for prod logging/behavior | `production` |

**CORS:** In production, set `CORS_ORIGINS` to the exact origins of your web and mobile clients. If unset, the API defaults to localhost dev origins only.

---

## Web (Next.js)

### Build and run

```bash
cd apps/web
pnpm install --frozen-lockfile
pnpm run build
pnpm run start
```

Set **`NEXT_PUBLIC_API_URL`** to your production API URL **before** running `pnpm run build`, so the client is built with the correct API base URL.

### Railway (this monorepo)

The repo root is **not** the Next.js app: `next` lives under **`apps/web`**. If Railway’s **Root Directory** is left at `/`, the build uses the root `package.json` (no `next`) and fails with *“No Next.js version detected”*.

1. Create a **separate Railway service** for the web app (do not reuse the API Dockerfile service).
2. **Settings → Root Directory:** set to **`apps/web`** (the folder that contains the web `package.json` and `pnpm-lock.yaml`).
3. **Variables:** add **`NEXT_PUBLIC_API_URL`** = your public API URL (e.g. `https://…up.railway.app`). It must be present at **build** time.
4. If this service still picks up the repo-root **`railway.json`** (API uses **`DOCKERFILE`**), override the web service **Builder** to **Nixpacks** in the dashboard. This repo also ships **`apps/web/railway.json`** with **`NIXPACKS`** for that layout when Railway reads config from the service root.

The **`url.parse()` DEP0169** message during install usually comes from Node/tooling dependencies; it does not mean the Next.js build failed by itself.

For full details on client-side API URL configuration, see [docs/API-URL-ENV.md](API-URL-ENV.md).

| App | Env var | Production |
|-----|---------|------------|
| Web | `NEXT_PUBLIC_API_URL` | Set to deployed API URL before build |

---

## Mobile (Expo)

### Production build

- **EAS Build:** Use [Expo Application Services](https://docs.expo.dev/build/introduction/) and set `EXPO_PUBLIC_API_URL` in your EAS secrets or environment.
- **Export:** From `apps/mobile`, run `pnpm exec expo export` (or equivalent); set `EXPO_PUBLIC_API_URL` to the production API URL in `.env` or your build config before exporting.

See `apps/mobile/.env.example` and [docs/API-URL-ENV.md](API-URL-ENV.md) for dev vs production API URL setup.

| App | Env var | Production |
|-----|---------|------------|
| Mobile | `EXPO_PUBLIC_API_URL` | Set to deployed API URL for production builds |

---

## CI/CD

### Pipeline location and behavior

- **Workflow:** [`.github/workflows/ci.yml`](../.github/workflows/ci.yml)
- **Triggers:** Push and pull requests to `main` and `master`.
- **Steps:**
  1. Checkout, install pnpm and Node 20, cache pnpm store.
  2. **API:** Install deps, lint, unit tests, run Prisma migrations against a Postgres service container, e2e tests, build.
  3. **Web:** Install deps, build (with `NEXT_PUBLIC_API_URL` set to a placeholder for CI).

### Secrets for CI

The current CI job does **not** require GitHub Secrets for normal runs:

- **E2E:** Uses a Postgres **service container** and in-workflow env (`DATABASE_URL`, `JWT_SECRET`, `E2E_DATABASE_READY=1`). No repository secrets are needed for e2e.

### Secrets for deployment

When you add deploy steps (e.g. deploy to a host or run e2e against an external DB), use **GitHub Secrets** (or your platform’s secret store) for:

| Secret | When to use | Description |
|--------|-------------|-------------|
| `DATABASE_URL` | Deploy or e2e against real DB | Production (or test) PostgreSQL URL |
| `JWT_SECRET` | Deploy | Production JWT signing secret |

Do not commit these values. Reference them in the workflow as `${{ secrets.DATABASE_URL }}` and `${{ secrets.JWT_SECRET }}` (or equivalent).

---

## Summary

- **API:** `PORT`, `DATABASE_URL`, `JWT_SECRET` required; set `CORS_ORIGINS` in prod. See `services/api/.env.example`.
- **Web:** Set `NEXT_PUBLIC_API_URL` before build; see [API-URL-ENV.md](API-URL-ENV.md).
- **Mobile:** Set `EXPO_PUBLIC_API_URL` for production builds; see [API-URL-ENV.md](API-URL-ENV.md) and `apps/mobile/.env.example`.
- **CI:** `.github/workflows/ci.yml` runs lint, unit tests, e2e (with service Postgres), and builds. Use GitHub Secrets for `DATABASE_URL` and `JWT_SECRET` in deploy (or external e2e) steps.
