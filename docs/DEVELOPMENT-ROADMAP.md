# Lankamenus — Prioritized Development Roadmap

This roadmap completes the application per [ARCHITECTURE.md](./ARCHITECTURE.md) and [MISSING-FEATURES-AND-ENDPOINTS.md](./MISSING-FEATURES-AND-ENDPOINTS.md). Work is ordered by dependency and impact: **foundation → core browsing (menus) → location → admin → search → auth → optional features → production hardening**.

---

## Phase 0 — Foundation & quick fixes

**Goal:** Stable API, safe config, and one critical bug fix. Unblocks all later work.

| # | Task | Scope | Notes |
|---|------|--------|--------|
| 0.1 | Fix `DELETE /restaurants/:id` | API | Call `RestaurantsService.delete(id)`; return 204. Handle Prisma P2025 (not found) with 404. |
| 0.2 | Add `.env.example` | Repo | Document `DATABASE_URL`, `JWT_SECRET`, `PORT` in `services/api`. |
| 0.3 | Env validation at startup | API | Require `JWT_SECRET`, `DATABASE_URL`, `PORT` (e.g. Joi or class-validator); fail fast if missing. Remove hardcoded `'supersecret'` fallback. |
| 0.4 | Global `ValidationPipe` + DTOs | API | Enable `ValidationPipe`; add class-validator to auth DTOs (register/login) and search DTO. |
| 0.5 | `GET /health` | API | Simple 200 + `{ "status": "ok" }`; optional DB ping for readiness. |

**Exit criteria:** DELETE works; env validated; health check and validation in place.

---

## Phase 1 — Menus (data model + read APIs)

**Goal:** Users can browse restaurant menus. Menu-centric experience is possible.

| # | Task | Scope | Notes |
|---|------|--------|--------|
| 1.1 | Prisma: add `menus`, `menu_sections`, `menu_items` | API | Relations to `restaurants`. Fields per MISSING-FEATURES-AND-ENDPOINTS.md. Run migration. |
| 1.2 | Menus module (read-only) | API | `GET /restaurants/:restaurantId/menus` (list); `GET /menus/:id` or `GET /restaurants/:restaurantId/menus/:id` (one with sections + items). Public. |
| 1.3 | Web: restaurant detail + menu view | Web | Add `/restaurants/[id]`; fetch restaurant + menus; show menu with sections and items. |
| 1.4 | Mobile: menu view from details | Mobile | On restaurant details, show menus (list or single active); drill into menu with sections/items. |

**Exit criteria:** End users can open a restaurant and see its menu(s) on web and mobile.

---

## Phase 2 — Sri Lanka reference data & location

**Goal:** Location-based discovery: filter by district/city and “near me” (when geom is available).

| # | Task | Scope | Notes |
|---|------|--------|--------|
| 2.1 | `GET /districts` (and optionally `GET /cities`) | API | Static list of Sri Lankan districts (and cities if needed). Public. Use for filters. |
| 2.2 | Extend `GET /restaurants` with location params | API | Add `lat`, `lng`, `radius_km`; filter/order by distance using `restaurants.geom`. Return distance in response when provided. Optional: clamp/reject coords outside Sri Lanka. |
| 2.3 | Populate / maintain `restaurants.geom` | API / data | Ensure new/updated restaurants can set lat/lng and write to `geom`. Migration or script for existing rows if needed. |
| 2.4 | Web: location filters + “near me” | Web | District/city dropdowns from `/districts`; optional “use my location” for lat/lng + radius. |
| 2.5 | Mobile: location filters + “near me” | Mobile | Same as web; use device location for “near me”. |

**Exit criteria:** Users can find restaurants by area (district/city) and by “near me” on web and mobile.

---

## Phase 3 — Admin: restaurant & menu CRUD

**Goal:** Admins can create and manage restaurants and menus.

| # | Task | Scope | Notes |
|---|------|--------|--------|
| 3.1 | `POST /restaurants`, `PATCH /restaurants/:id` | API | Admin-only. Body: name, city, district, address, cuisine_tags, price_level, veg_friendly, halal_certified, optional lat/lng. |
| 3.2 | Menus write APIs | API | Admin: `POST /restaurants/:id/menus`, `PATCH /menus/:id`, `DELETE /menus/:id`. Sections: POST/PATCH/DELETE under menu. Items: POST/PATCH/DELETE under menu (or section). |
| 3.3 | Admin UI: restaurants | Web (or dedicated admin app) | List restaurants; create/edit form; delete. Use district/city from Phase 2. Auth: admin login + token. |
| 3.4 | Admin UI: menus | Web | Per restaurant: create/edit/delete menu; manage sections and items (name, description, price, veg, order). |

**Exit criteria:** Admin can create and edit restaurants and full menus (sections + items) via UI.

---

## Phase 4 — Search over menus

**Goal:** Search includes menu content (dish names, descriptions).

| # | Task | Scope | Notes |
|---|------|--------|--------|
| 4.1 | Extend search to menu content | API | In `GET /restaurants` (or new `GET /search`), when `q` is present, also search `menu_items.name` and `menu_items.description`; return restaurants that match. Keep existing filters. |
| 4.2 | Web: search UI | Web | Search box and filters (city, district, cuisine, etc.) wired to extended endpoint. |
| 4.3 | Mobile: search UI | Mobile | Same: search + filters; optional “search in menu” emphasis. |

**Exit criteria:** Users can find restaurants and menus by typing dish or restaurant name on web and mobile.

---

## Phase 5 — Meilisearch & Redis (infrastructure)

**Goal:** Use the existing Docker services for full-text search (Meilisearch) and caching/sessions (Redis). Optional but improves scale and UX.

| # | Task | Scope | Notes |
|---|------|--------|--------|
| 5.1 | **Meilisearch**: Connect API to Meilisearch | API | Add Meilisearch client; configure index(es) for restaurants and menu items (searchable attributes: name, description, city, district, cuisine_tags). |
| 5.2 | **Meilisearch**: Index sync | API | On restaurant/menu/menu_item create/update/delete, update Meilisearch index (e.g. queue or inline). Ensure index reflects DB. |
| 5.3 | **Meilisearch**: Search endpoint | API | Add or extend search to query Meilisearch (e.g. `GET /search?q=...` or extend `GET /restaurants?q=...`) and return results from Meilisearch with optional DB enrichment. |
| 5.4 | **Redis**: Connect API to Redis | API | Add Redis client (e.g. `ioredis` or Nest cache module). Env: `REDIS_URL` or host/port. Use for caching or session store. |
| 5.5 | **Redis**: Caching strategy | API | Cache hot reads (e.g. `GET /restaurants/:id`, `GET /menus/:id`, or list by district) with TTL; invalidate on admin create/update/delete. Optional: use Redis for rate-limiting state. |
| 5.6 | **Redis**: Sessions (optional) | API | If moving from JWT-in-memory to server-side sessions, store session data in Redis; document in deploy/secrets. |

**Exit criteria:** Search can be powered by Meilisearch; Redis is used for caching (and optionally sessions). Docker Compose services are used by the app.

---

## Phase 6 — Auth for end users

**Goal:** Optional login for end users; foundation for favourites and personalized features.

| # | Task | Scope | Notes |
|---|------|--------|--------|
| 6.1 | `GET /auth/me` | API | Return current user (id, email, name, role). JWT required. |
| 6.2 | Web: login / register UI | Web | Pages and token storage; send `Authorization` on API calls when logged in. |
| 6.3 | Mobile: login / register UI | Mobile | Same; use secure storage (e.g. expo-secure-store) for token; send `Authorization`. |
| 6.4 | Optional: profile or account screen | Web + Mobile | Show user info; logout. |

**Exit criteria:** End users and admins can log in on web and mobile; API knows current user.

---

## Phase 7 — Optional enhancements

**Goal:** Favourites and UX polish.

| # | Task | Scope | Notes |
|---|------|--------|--------|
| 7.1 | Favourites model + APIs | API | Table `favourites` (user_id, restaurant_id); `GET /users/me/favourites`, `POST/DELETE` favourite. |
| 7.2 | Web & mobile: favourites UI | Web + Mobile | “Save” restaurant; “My favourites” list; remove favourite. |
| 7.3 | Mobile: repurpose Explore tab | Mobile | Replace template with e.g. “Featured” or “By district” or categories. |
| 7.4 | Web: metadata & branding | Web | Title, description, OG tags for Lankamenus; remove “Create Next App” defaults. |
| 7.5 | API base URL from env | Web + Mobile | `NEXT_PUBLIC_API_URL` and `EXPO_PUBLIC_API_URL`; document for prod. |

**Exit criteria:** Favourites work; Explore is useful; branding and env-based API URLs in place.

---

## Phase 8 — Production readiness

**Goal:** Safe, observable, and deployable.

| # | Task | Scope | Notes |
|---|------|--------|--------|
| 8.1 | Global exception filter | API | Map Prisma errors (e.g. P2025) and 500s to stable JSON; no stack traces in response. |
| 8.2 | Security: Helmet + rate limiting | API | Add Helmet; add `@nestjs/throttler` (or equivalent). Stricter CORS for prod. |
| 8.3 | Logging | API | Structured logging (e.g. Nest Logger or Pino) for requests, errors, auth failures. |
| 8.4 | Tests | API | Unit tests for services (restaurants, menus, auth); e2e for main endpoints. |
| 8.5 | CI/CD | Repo | Pipeline (e.g. GitHub Actions): install, lint, test API, build web and mobile. |
| 8.6 | Deployment & secrets doc | Docs | How to run API (e.g. `node dist/main`), Next.js, Expo in prod; where to set `DATABASE_URL`, `JWT_SECRET`, `REDIS_URL`, Meilisearch URL/key, API URLs. |

**Exit criteria:** API is hardened; tests and CI run; deployment and secrets are documented.

---

## Visual summary

```
Phase 0  Foundation (fix DELETE, validation, env, health)
    ↓
Phase 1  Menus (schema + read APIs + web/mobile menu view)
    ↓
Phase 2  Location (districts/cities API + “near me” + UI filters)
    ↓
Phase 3  Admin (restaurant + menu CRUD API + admin UI)
    ↓
Phase 4  Search (menu content in search + search UI)
    ↓
Phase 5  Meilisearch & Redis (full-text search index + caching/sessions)
    ↓
Phase 6  Auth (GET /auth/me + login/register UI web + mobile)
    ↓
Phase 7  Optional (favourites, Explore tab, branding, API URL env)
    ↓
Phase 8  Production (exception filter, Helmet, throttle, logging, tests, CI/CD, deploy doc)
```

---

## Priority overview

| Priority | Phase | Rationale |
|----------|--------|-----------|
| **P0** | 0 | Required for correctness and safety before building more. |
| **P1** | 1 | Delivers core value: browsing menus. |
| **P1** | 2 | Location is part of the product promise (Sri Lanka, “by location”). |
| **P1** | 3 | Admins must be able to add and maintain restaurants and menus. |
| **P2** | 4 | Search over menus improves discovery. |
| **P2** | 5 | Meilisearch & Redis: better search and caching (Docker services already in repo). |
| **P2** | 6 | Auth enables optional personalization and admin UI. |
| **P3** | 7 | Favourites and polish improve retention and branding. |
| **P1** | 8 | Needed before production launch. |

Phases 0–3 deliver a **minimal complete product**: browse menus by location, search, and full admin management. Phase 4 adds search UI; Phase 5 integrates **Meilisearch** (full-text search) and **Redis** (caching, optional sessions). Phases 6–8 add auth, optional features, and production hardening.
