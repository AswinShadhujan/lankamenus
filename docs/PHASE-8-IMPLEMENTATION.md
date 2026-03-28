# Phase 8 — Production readiness: implementation guide

**Goal (from roadmap):** Safe, observable, and deployable. API is hardened; tests and CI run; deployment and secrets are documented.

**Current state:**

- **API:** ValidationPipe and CORS (fixed origins) in `main.ts`. No global exception filter; some services catch Prisma P2025 and throw NotFoundException. No Helmet, no rate limiting. Nest Logger used ad hoc; no request/error middleware. Unit tests for services and controllers (Jest); e2e exists (`test/app.e2e-spec.ts`) but only asserts GET / returns "Hello World!" and does not apply ValidationPipe/CORS to the test app. No CI/CD. `.env.example` documents API env; `docs/API-URL-ENV.md` documents client API URLs.
- **Repo:** Monorepo with `services/api`, `apps/web`, `apps/mobile`. No `.github/workflows` yet.

---

## Tasks in order

### 8.1 — Global exception filter (API)

**Scope:** API only.

- Add an **exception filter** (e.g. `src/common/filters/http-exception.filter.ts` or `src/filters/all-exceptions.filter.ts`) that:
  - Catches all exceptions (or at least `HttpException` and unknown errors).
  - For **Prisma** errors: if `PrismaClientKnownRequestError` with code `P2025` (record not found), return **404** with a stable body (e.g. `{ statusCode: 404, message: 'Resource not found' }`). Optionally map other Prisma codes (e.g. P2002 → 409) if not already handled in services.
  - For **Nest `HttpException`** (and subclasses like `NotFoundException`, `UnauthorizedException`): return the exception’s status and a stable JSON body (e.g. `{ statusCode, message }`). Do not include `error` stack or internal details.
  - For **unknown errors** (500): return **500** with a generic message (e.g. `Internal server error`). **Do not** send stack traces or error details in the response. Log the full error (and stack) server-side only.
- Register the filter **globally** in `main.ts` (e.g. `app.useGlobalFilters(new AllExceptionsFilter(...))`). If the filter needs Nest’s `HttpAdapterHost` or Logger, inject them.
- Ensure the filter runs after the framework has serialized the request (so you can read status and send a consistent JSON response). Use `ArgumentsHost`, `HttpAdapterHost.getHttpAdapter()`, and `reply.status().json(...)` (or Express `res.status().json(...)`).
- **Optional:** In non-production (e.g. `NODE_ENV !== 'production'`), you may include a non-stack `error` field in 500 responses for debugging; in production never expose stacks.

**Why first:** So every unhandled or rethrown error returns stable JSON and no stack traces before you add more surface (Helmet, throttle, logging).

---

### 8.2 — Security: Helmet + rate limiting (API)

**Scope:** API only.

- **Helmet:** Add the `helmet` package and use it in `main.ts` (e.g. `app.use(helmet())`) to set secure HTTP headers. If you need to allow specific cross-origin or CSP for your frontends, configure Helmet accordingly (e.g. disable or tune `contentSecurityPolicy` so web/mobile can call the API).
- **Rate limiting:** Add `@nestjs/throttler`. Register `ThrottlerModule` in `AppModule` (e.g. default ttl 60s, limit 100 requests per ttl per IP). Use `ThrottlerGuard` as a global guard or register it in the root module. Mark public/expensive routes with appropriate limits if needed (e.g. `@SkipThrottle()` for health, or higher limit for auth). Document that login/register are rate-limited to mitigate brute force.
- **CORS:** Keep existing `enableCors()` for dev origins. For production, add allowed origins via env (e.g. `CORS_ORIGINS`) and use that in `main.ts` so you don’t use `*` in prod. Document in deployment doc.

**Why this order:** Hardening the API after errors are under control (8.1).

---

### 8.3 — Logging (API)

**Scope:** API only.

- Add **structured logging** for:
  - **Requests:** Log method, URL, status code, and optionally response time (e.g. middleware or interceptor). Use Nest Logger or a logger like Pino; output JSON in production if your host aggregates logs.
  - **Errors:** Already recommended in 8.1 (log full error and stack server-side when returning 500). Ensure the exception filter logs every caught exception (at least 500s and optionally 4xx).
  - **Auth failures:** Log failed login attempts (e.g. in `AuthService.login` when credentials are invalid) and optionally 401 responses (without logging tokens). This helps with security auditing.
- **Implementation:** Either use Nest’s built-in Logger (and a simple request-scoped logger or middleware) or integrate Pino (e.g. `nestjs-pino`). Avoid logging request bodies that may contain passwords; log only that “login failed” or “invalid credentials” for auth.

**Why after 8.2:** So you can log 401/throttle responses and have a consistent error-logging story from 8.1.

---

### 8.4 — Tests (API)

**Scope:** API tests (unit already present; e2e to be extended).

- **Unit tests:** You already have unit tests for services (restaurants, menus, auth, favourites, search, cache, locations) and controllers. In 8.4, **review** that critical paths are covered and add any missing unit tests for new or changed behaviour from Phase 8 (e.g. exception filter does not need a unit test if it’s thin; throttler/Helmet are integration concerns).
- **E2E:** Update or add e2e tests so that:
  - The e2e app is created with the same pipes and filters as production (e2e bootstrap in `test/app.e2e-spec.ts` or a shared `test/utils/bootstrap.ts`). Apply ValidationPipe and the global exception filter so that e2e behaves like prod.
  - At least these flows are covered (against the real app module, with a test DB or in-memory where applicable):
    - **GET /health** returns 200 and `{ status: 'ok' }`.
    - **GET /restaurants** (public) returns 200 and a list (or empty list).
    - **POST /auth/login** with invalid credentials returns 401.
    - Optionally: **GET /restaurants/:id** for a non-existent id returns 404 (if you have a test DB with known data, or create then delete).
  - Fix or remove the existing e2e test that expects GET / to return "Hello World!" if the root route still does; otherwise align the test with the actual root response.
- Run e2e in CI (see 8.5). E2e may require a real database; document in README or CI that `DATABASE_URL` (and optionally `JWT_SECRET`) must be set for e2e, or use a separate e2e config with an in-memory/sqlite if you introduce one.

**Why this order:** E2e gives confidence that the hardened app (8.1–8.3) behaves correctly; CI then runs both unit and e2e.

---

### 8.5 — CI/CD (Repo)

**Scope:** Repository root; GitHub Actions (or equivalent).

- Add a **pipeline** (e.g. `.github/workflows/ci.yml`) that:
  1. **Checkout** the repo.
  2. **Install** dependencies (use pnpm if the repo uses pnpm: e.g. `pnpm install -r` or per-package in a monorepo).
  3. **Lint:** Run lint for API (e.g. `pnpm --filter api lint` or `cd services/api && pnpm lint`). Optionally lint web and mobile.
  4. **Test API:** Run unit tests (e.g. `pnpm --filter api test` or `cd services/api && pnpm test`). Use the same Jest config (e.g. `maxWorkers: 1` if needed for stability).
  5. **E2E (optional but recommended):** Run API e2e if feasible (e.g. start a test Postgres in a service container, set `DATABASE_URL` and `JWT_SECRET`, then `pnpm --filter api test:e2e`). If e2e is slow or flaky, run it on a schedule or only on main branch; document in the workflow.
  6. **Build:** Build the API (`pnpm --filter api build`), build the web app (`pnpm --filter web build` or `cd apps/web && pnpm build`), and optionally build the mobile app (e.g. `cd apps/mobile && pnpm exec expo export` or EAS build; mobile build can be optional or on a separate workflow).
- **Caching:** Cache pnpm store (and optionally node_modules) to speed up runs.
- **Secrets:** Do not commit secrets; use GitHub Secrets (or equivalent) for `DATABASE_URL`, `JWT_SECRET`, etc., when running e2e or deploy steps. Document required secrets in the deployment doc (8.6).

**Why after 8.4:** CI runs the tests you just extended; deployment doc (8.6) will reference the same pipeline and secrets.

---

### 8.6 — Deployment & secrets doc (Docs)

**Scope:** Documentation (and optionally small env example updates).

- Create or update a **deployment and secrets** document (e.g. `docs/DEPLOYMENT.md` or `docs/SEcrets-and-deployment.md`) that covers:
  - **API**
    - How to run in production (e.g. `node dist/main` or `pnpm start:prod` from the API package). Mention that `PORT`, `DATABASE_URL`, and `JWT_SECRET` are required; `REDIS_URL`, `MEILISEARCH_*` are optional.
    - List all env vars: required vs optional, with short descriptions and example values (no real secrets). Reference `services/api/.env.example`.
    - Note that CORS must be configured (e.g. `CORS_ORIGINS`) for the web and mobile origins you use in prod.
  - **Web (Next.js)**
    - Build command (e.g. `pnpm build` in apps/web); run command (e.g. `pnpm start` or `next start`). Set `NEXT_PUBLIC_API_URL` to the production API URL before build.
    - Reference `docs/API-URL-ENV.md` or in-doc table for client env vars.
  - **Mobile (Expo)**
    - How to build for production (e.g. EAS Build or `expo export`). Set `EXPO_PUBLIC_API_URL` to the production API URL. Reference `apps/mobile/.env.example` and `docs/API-URL-ENV.md`.
  - **CI/CD**
    - Where the pipeline is (e.g. `.github/workflows/ci.yml`), what it runs (lint, unit tests, e2e if any, builds), and which secrets are needed for e2e or deploy (e.g. `DATABASE_URL`, `JWT_SECRET`).
- Optionally extend `services/api/.env.example` with `CORS_ORIGINS` and `NODE_ENV` if you use them. Ensure the doc and example files stay in sync.

**Why last:** Pulls together how to run and configure every part of the system and where secrets live, after the app and pipeline are in place.

---

## Summary table

| Order | Task | Scope | Delivers |
|-------|------|--------|----------|
| 8.1 | Global exception filter | API | Prisma P2025 → 404; HttpException → stable JSON; 500 → generic message, no stack in response; log errors server-side. |
| 8.2 | Helmet + rate limiting + CORS | API | Secure headers; throttler on routes; CORS from env for prod. |
| 8.3 | Logging | API | Request logging; error logging in filter; auth failure logging. |
| 8.4 | Tests | API | E2e for health, restaurants, auth; e2e app uses same pipes/filters; unit coverage reviewed. |
| 8.5 | CI/CD | Repo | Workflow: install, lint, test API, build API + web (and optionally mobile). |
| 8.6 | Deployment & secrets doc | Docs | How to run API, web, mobile; env vars and secrets; CI secrets. |

---

## Exit criteria (from roadmap)

- API is hardened (exception filter, Helmet, throttle, logging).
- Tests and CI run (unit + e2e in pipeline).
- Deployment and secrets are documented.

---

## Notes

- **Exception filter:** Prefer a single global filter that handles Prisma, HttpException, and unknown errors so every response is consistent. Some teams use a base `HttpExceptionFilter` and extend it for Prisma.
- **Throttler:** Default limits (e.g. 100 req/60s per IP) are usually enough; tighten for `POST /auth/login` and `POST /auth/register` if needed (e.g. 5/min per IP for login).
- **E2E DB:** If e2e uses a real Postgres, use a separate DB or schema (e.g. `lankamenus_test`) and run migrations in CI before e2e. Alternatively, skip e2e in CI and run it manually or on a schedule until you have a stable test DB setup.
- **Monorepo:** Use pnpm workspaces and `pnpm --filter <package>` (or `pnpm -r run build`) so CI installs once and runs scripts per package.
