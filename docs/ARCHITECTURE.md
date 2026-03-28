# Lankamenus — Architecture & Production Readiness

## 0. Purpose & Users

**Purpose:** Lankamenus lets people **browse restaurant menus** by **location** and **search**. Users find restaurants and view their menus (dishes, categories, etc.) according to where they are or what they’re looking for. The app is **limited to Sri Lanka**: all restaurants and content are within Sri Lanka (e.g. cities like Colombo, Kandy, Galle; districts and local areas).

**User types:**

| Role | Description |
|------|--------------|
| **End users** | Browse restaurants and menus, search and filter by location and query. No login required for browsing; optional auth for favourites, etc. |
| **Admin** | Manage restaurants and menus (create, edit, delete). Requires authentication and admin role. |

The product is **menu-centric**: the main experience is discovering and viewing **menus** of restaurants, not only restaurant metadata. Location (e.g. city, district, or “near me”) and search are the primary ways to find relevant menus.

---

## 1. Architecture Overview

### 1.1 High-Level Structure

```
lankamenus/
├── apps/
│   ├── web/          # Next.js 15 (App Router) — public website
│   └── mobile/       # Expo (React Native) — iOS/Android app
├── services/
│   └── api/          # NestJS REST API — single backend for web + mobile
├── infra/
│   └── docker/       # Docker Compose (PostgreSQL/PostGIS, Meilisearch, Redis)
└── README.md
```

- **Backend**: One NestJS API consumed by both web and mobile.
- **Frontends**: Separate codebases; no shared npm package (types/API contract are duplicated).
- **Data**: PostgreSQL (with PostGIS) via Prisma; optional Meilisearch and Redis in Docker but not used in code yet.

### 1.2 Request Flow

```
[Web (Next.js)]     ──►  GET/POST ...  ──►  [NestJS API]  ──►  [Prisma]  ──►  [PostgreSQL]
[Mobile (Expo)]     ──►  (CORS allows localhost + Expo origins)
```

- Public routes: `GET /restaurants`, `GET /restaurants/:id`, `POST /auth/register`, `POST /auth/login`.
- Protected routes: JWT in `Authorization: Bearer <token>`; admin-only: `DELETE /restaurants/:id` (via `RolesGuard`).

### 1.3 API (`services/api`)

| Concern | Implementation |
|--------|----------------|
| **Framework** | NestJS 11, TypeScript |
| **ORM** | Prisma; schema in `prisma/schema.prisma` |
| **Auth** | JWT (Passport), `JwtAuthGuard` (global), `@Public()`, `RolesGuard`, `Role.USER` / `Role.ADMIN` |
| **Config** | `ConfigModule.forRoot()` (`.env`); no validated env schema |
| **Modules** | `AppModule` → `ConfigModule`, `PrismaModule`, `RestaurantsModule`, `AuthModule` |

**Main routes:**

- `GET /restaurants` — search/filter (q, city, district, cuisine, veg, halal, pricelevel, page, pagesize)
- `GET /restaurants/:id` — one restaurant (public)
- `DELETE /restaurants/:id` — admin only (currently **not** calling the service — see gaps)
- `POST /auth/register` — body: `{ email, password, name? }`
- `POST /auth/login` — body: `{ email, password }` → `{ accessToken, user }`

**Database models (Prisma):**

- `restaurants` — name, city, district, address, cuisine_tags, price_level, veg_friendly, halal_certified, geom (PostGIS), created_at
- `users` — email, password (bcrypt), name, role (default `'user'`); roles used: **end user** (`user`), **admin** (`admin`)
- `spatial_ref_sys` — PostGIS reference (unchanged by app)

**Note:** There are **no menu or menu-item tables** yet. To fulfil the product purpose (browsing menus), the data model and API will need menus (and likely menu items/categories) linked to restaurants.

### 1.4 Web App (`apps/web`)

- **Stack**: Next.js (App Router), React, TypeScript, Axios.
- **Single page**: `src/app/page.tsx` — fetches `GET /restaurants` and lists results.
- **API client**: `src/lib/api.ts` — Axios instance with `baseURL: 'http://localhost:3001'`.
- **Types**: `src/types/restaurant.ts` — `Restaurant` interface aligned with API response.

No auth UI, no env-based API URL, no detail page or search UI.

### 1.5 Mobile App (`apps/mobile`)

- **Stack**: Expo (file-based routing), React Native, TypeScript, Axios.
- **Screens**:
  - **Home** (`(tabs)/index.tsx`): city/cuisine filters, list, navigate to details.
  - **Details** (`(tabs)/details.tsx`): `GET /restaurants/:id`, show one restaurant.
  - **Explore** (`(tabs)/explore.tsx`): still default Expo template (no Lankamenus features).
- **API client**: `src/lib/api.ts` — baseURL `http://10.0.2.2:3001` (Android emulator only).
- **Types**: `src/types/restaurant.ts` — same shape as API.

No auth screens, no token storage or `Authorization` header, no env-based API URL.

### 1.6 Infrastructure

- **Docker Compose** (`infra/docker/`): PostGIS DB, Meilisearch, Redis (all optional from app’s perspective; only DB is used).
- **CORS** (in `main.ts`): allows `localhost:3000`, `localhost:19006`, `127.0.0.1:19006`.
- **No** health-check endpoint, no readiness/liveness used in Compose.

---

## 2. What’s Missing for Production Readiness

### 2.0 Product & Data Model (Core to Purpose)

| Gap | Priority | Notes |
|-----|----------|--------|
| **Menus & menu items** | High | App is for browsing **menus**; current schema only has restaurants. Add models (e.g. `menus`, `menu_items` or `menu_sections`/`items`) and APIs so end users can view restaurant menus. Admin needs CRUD for menus. |
| **Location-based browsing** | High | Purpose includes “by location”. Use `restaurants.geom` and/or city/district for “near me” or area filters; expose in API and UI. Scope is Sri Lanka only (e.g. Sri Lankan districts/cities). |
| **Search over menus** | Medium | Extend search beyond restaurant name/city/cuisine to menu content (e.g. dish names, descriptions) when menu data exists. |

### 2.1 API (NestJS)

| Gap | Priority | Notes |
|-----|----------|--------|
| **DELETE not implemented** | High | `RestaurantsController.deleteRestaurant` returns a message and never calls `RestaurantsService.delete(id)`. Wire it and return 204 or 200. |
| **Input validation** | High | No `ValidationPipe`; no DTO validation (e.g. class-validator). Add global ValidationPipe and validate register/login and search DTOs. |
| **Env validation** | High | `JWT_SECRET` can fall back to `'supersecret'`. Require `JWT_SECRET`, `DATABASE_URL`, `PORT` at startup (e.g. Joi or class-validator in ConfigModule). |
| **Error handling** | High | No global exception filter. Prisma errors (e.g. P2025 on delete) and 500s can leak stack or raw messages. Map to stable HTTP status and safe JSON. |
| **Security** | High | Add Helmet, rate limiting (e.g. `@nestjs/throttler`). Consider stricter CORS (explicit origins in prod). |
| **Logging** | Medium | No structured request/error logging. Add Nest Logger or Pino and log requests, errors, and auth failures. |
| **Health check** | Medium | Add `GET /health` (and optionally DB check) for load balancers and Docker. |
| **Tests** | Medium | Specs are boilerplate (e.g. “should be defined”). Add unit tests for services and e2e for main endpoints (auth, restaurants, delete). |
| **Pagination limits** | Low | Search already caps `pagesize` (e.g. 100); document and consider smaller default for production. |

### 2.2 Database & Migrations

| Gap | Priority | Notes |
|-----|----------|--------|
| **Migrations** | High | Single init migration exists. Establish a migration workflow (e.g. no manual schema drift) and run migrations in CI/deploy. |
| **Secrets** | High | No `.env.example` in repo; document required vars (e.g. `DATABASE_URL`, `JWT_SECRET`, `PORT`). Never commit real `.env`. |

### 2.3 Web App (Next.js)

| Gap | Priority | Notes |
|-----|----------|--------|
| **API base URL** | High | Hardcoded `localhost:3001`. Use `NEXT_PUBLIC_API_URL` (or similar) and fail clearly if missing in prod. |
| **Auth** | High | No login/register UI, no token storage, no `Authorization` header. Needed for any protected or personalized features. |
| **Error & loading** | Medium | Basic loading; no error state or retry. Add error handling and optional retry. |
| **Restaurant detail** | Medium | No route for a single restaurant; add e.g. `/restaurants/[id]` and use `GET /restaurants/:id`. |
| **Search/filters** | Low | No search or filter UI; API supports it. Add query params and wire to `GET /restaurants`. |
| **Metadata** | Low | Layout still “Create Next App”. Set proper title, description, and OG tags for Lankamenus. |

### 2.4 Mobile App (Expo)

| Gap | Priority | Notes |
|-----|----------|--------|
| **API base URL** | High | Hardcoded `10.0.2.2:3001`. Use env (e.g. `EXPO_PUBLIC_API_URL`) and different values for emulator vs prod. |
| **Auth** | High | No login/register, no secure token storage (e.g. expo-secure-store), no `Authorization` header. |
| **Explore tab** | Low | Replace template content with real feature (e.g. featured restaurants, categories) or remove. |

### 2.5 DevOps & Deployment

| Gap | Priority | Notes |
|-----|----------|--------|
| **CI/CD** | High | No GitHub Actions (or other) for test, lint, build. Add pipeline that runs API tests and builds web/mobile. |
| **Monorepo scripts** | Medium | No root `package.json` or workspace; each app is run separately. Optional: root scripts to install, test, and run all apps. |
| **Production build** | Medium | Document how to build and run API (e.g. `node dist/main`), Next.js (e.g. `next build`/`start`), and Expo (EAS Build). |
| **Secrets** | High | No guidance for storing `DATABASE_URL`, `JWT_SECRET`, and API URLs in prod (e.g. env in host or secret manager). |

### 2.6 Optional / Future

- **Meilisearch / Redis**: In Docker but unused; add when you need full-text search or caching/sessions.
- **Shared types**: Consider a small shared package or OpenAPI spec so web and mobile stay in sync with the API.

---

## 3. Summary

- **Purpose**: Users (end users and admins) browse restaurant **menus** by **location** and **search**, **limited to Sri Lanka**. End users browse; admins manage restaurants and menus.
- **Architecture**: One NestJS API serving a Next.js web app and an Expo mobile app, with PostgreSQL/Prisma and optional Docker services (Meilisearch, Redis) defined but not yet used.
- **Production readiness**: To match the product purpose, the largest gaps are **menus and menu items** (data model + API + UI) and **location-based browsing** (use geom/city/district). Then: fix delete implementation; validation, env validation, and security (Helmet, rate limit); error handling and logging; health checks; frontend auth and env-based API URLs; CI/CD and deployment documentation.
