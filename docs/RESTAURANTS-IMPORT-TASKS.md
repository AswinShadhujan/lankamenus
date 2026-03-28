# Restaurants import (Google Places) — implementation tasks in order

How the import should be implemented in this project, with tasks in dependency order.

---

## Context

- **API:** NestJS in `services/api`; Prisma; `RestaurantsService` creates/updates restaurants and then calls `setGeomFromLatLng`, `searchService.indexRestaurant`, and `invalidateRestaurantCache`.
- **Existing script:** `scripts/backfill-restaurant-geom.ts` uses `ts-node -r dotenv/config` and `PrismaClient` directly.
- **Import flow:** Fetch places from Google Places API (Colombo) → validate → upsert by `google_place_id` → set geom, re-index search, invalidate cache. Store `photo_reference` (not a URL with API key); build photo URL server-side when needed.

---

## Tasks in order

### 1. Prisma schema — add Google Places fields

**Goal:** Extend `restaurants` with fields for Google data without breaking existing rows.

**File:** `services/api/prisma/schema.prisma`

- Add to `restaurants` (all optional for non-destructive migration):
  - `google_place_id  String?   @unique @map("google_place_id")`
  - `latitude         Float?    @map("latitude")`
  - `longitude        Float?    @map("longitude")`
  - `rating           Float?    @map("rating")`
  - `photo_reference  String?   @map("photo_reference")` (store reference; build URL server-side)
  - `category         String?   @map("category")` (e.g. first of `types`)
  - `updated_at       DateTime? @updatedAt @map("updated_at")`
- Reuse existing `address_line1` for Google vicinity/formatted_address (no new `address` column).
- Do **not** add a second `created_at` (already exists as `created_at`).

**Then:**

- Create migration: `cd services/api && pnpm exec prisma migrate dev --name add_google_places_fields`
- Ensure migration only adds columns (no drops). Run `pnpm exec prisma generate`.

**Deliverable:** Migration applied; Prisma client includes new fields.

---

### 2. Env and config — API key

**Goal:** Load and validate Google API key for the import.

**Files:**

- `services/api/src/config/env.validation.ts`  
  - Add `GOOGLE_PLACES_API_KEY: Joi.string().optional().allow('')` (optional so the app starts without it; required only when running the import).
- `services/api/.env.example`  
  - Add a line: `# GOOGLE_PLACES_API_KEY=...` (optional, for import script).

**Deliverable:** ConfigService can read `GOOGLE_PLACES_API_KEY`; app does not require it at startup.

---

### 3. Google Places integration — service

**Goal:** One place that talks to Google Places API (Nearby Search, Place Details, Photo) with rate limiting and no key in logs.

**Files to create:**

- `services/api/src/integrations/google/google-places.service.ts`
  - Methods:
    - `nearbySearch(lat, lng, radiusMeters, options?: { pageToken?: string })` → typed response (results + next_page_token).
    - `getPlaceDetails(placeId)` → place details (for address_components, etc.).
    - `getPhotoUrl(photoReference, maxWidth?)` → returns a URL built with the API key (for server-side use only; do not log or expose key).
  - Use `ConfigService.get('GOOGLE_PLACES_API_KEY')`; if missing, methods throw or return empty as appropriate.
  - Use HTTP client (e.g. `axios` or Nest `HttpService`); add delays (e.g. 2s after using next_page_token, 100–200ms between details/photo) to respect rate limits.
- `services/api/src/integrations/google/google.module.ts`  
  - Provide `GooglePlacesService`; import `ConfigModule`. Export the service so other modules can use it.

**Deliverable:** GooglePlacesService can fetch nearby places, place details, and a server-side photo URL.

---

### 4. Restaurant import — domain logic (upsert + geom + search + cache)

**Goal:** One method that “imports” a single Google place into the DB and keeps geom, search index, and cache in sync.

**Option A (recommended):** Add a method on `RestaurantsService` that performs upsert and then reuses existing post-write logic.

**File:** `services/api/src/restaurants/restaurants.service.ts`

- Add something like:
  - `upsertFromGooglePlace(data: { googlePlaceId: string; name: string; addressLine1?: string; city?: string; district?: string; latitude: number; longitude: number; rating?: number; photoReference?: string; category?: string })`.
- Implementation:
  - Validate: `name`, `latitude`, `longitude`, `googlePlaceId` present; lat/lng in valid ranges.
  - `prisma.restaurants.upsert` where `google_place_id` is the unique key: create or update `name_default`, `address_line1`, `city`, `district`, `latitude`, `longitude`, `rating`, `photo_reference`, `category`, `cuisine_tags: []` (or minimal default).
  - After upsert: call `setGeomFromLatLng(restaurant.id, lat, lng)`, then `searchService.indexRestaurant(restaurant.id)`, then `invalidateRestaurantCache(restaurant.id)` (same as create/update).
- Ensure `setGeomFromLatLng` and cache invalidation remain private and are not duplicated.

**Option B:** Create a dedicated `RestaurantImportService` that uses `PrismaService`, `SearchService`, and `CacheService`, and performs the same upsert + raw geom update + index + cache invalidation. Prefer Option A if you want to avoid duplicating geom/index/cache logic.

**Deliverable:** One place that, given a Google place payload, upserts a restaurant and keeps geom, Meilisearch, and cache correct.

---

### 5. Import script — CLI entrypoint

**Goal:** A runnable script that fetches places for Colombo, transforms them, and calls the upsert logic (with dry-run and logging).

**Files:**

- `services/api/scripts/import-restaurants.ts` (or `src/scripts/import-restaurants.ts`; keep consistent with existing `scripts/` usage).
  - **Bootstrap Nest** so the script runs inside the app context (e.g. `NestFactory.createApplicationContext(AppModule)`), then get `GooglePlacesService` and `RestaurantsService` (or the service that exposes `upsertFromGooglePlace`).
  - **Flow:**
    1. Read `GOOGLE_PLACES_API_KEY`; exit with clear message if missing.
    2. Parse `--dry-run` from argv if present (no DB writes, no index/cache).
    3. Loop: call Google Places **Nearby Search** for Colombo (e.g. lat/lng for Colombo, radius ~15–20 km). For each page:
       - Wait **≥ 2 seconds** before using `next_page_token` for the next request.
       - For each result: validate name, place_id, and geometry (lat/lng). Optionally fetch Place Details for address_components (city, district) and first photo reference.
       - If not dry-run: call `upsertFromGooglePlace` (or equivalent) with mapped fields; on error log and continue.
       - If dry-run: log what would be imported.
    4. Add a small delay (e.g. 100–200 ms) between each place to avoid rate limits.
    5. Log progress (e.g. “Page N”, “Imported M so far”) and a final summary (created, updated, failed, skipped).
- **package.json** (in `services/api`):
  - Add script: `"import:restaurants": "ts-node -r dotenv/config scripts/import-restaurants.ts"` (adjust path if script lives under `src/`).
  - If the script lives under `src/`, consider using `tsconfig-paths` so Nest bootstrap and imports resolve (e.g. `ts-node -r dotenv/config -r tsconfig-paths/register scripts/import-restaurants.ts`).

**Deliverable:** Running `pnpm import:restaurants` (and optionally `pnpm import:restaurants -- --dry-run`) imports or dry-runs the Colombo area; re-running is idempotent (upsert).

---

### 6. Photo URL for API responses (optional but recommended)

**Goal:** Clients can show a photo without the API key ever being in the DB or sent to the client.

**Options:**

- **A.** Add a controller or endpoint that, given a restaurant id (or photo_reference), returns a redirect (302) to the Google Places Photo URL built server-side with `GOOGLE_PLACES_API_KEY`. Clients use that endpoint as the image `src` (e.g. `GET /restaurants/:id/photo` or `GET /restaurants/photo?reference=...`).
- **B.** Store only `photo_reference`; document that the web/mobile app must call your backend to get a short-lived photo URL; implement the redirect endpoint above.

**Files:** e.g. `RestaurantsController` + a method that uses `GooglePlacesService.getPhotoUrl(photoReference)` and returns `res.redirect(photoUrl)` (or a short-lived signed URL). Ensure the key is never logged or sent to the client.

**Deliverable:** Clients can display restaurant photos via your backend without the key leaking.

---

### 7. Tests and docs (optional)

- **Unit tests:** `GooglePlacesService` (mock HTTP); `RestaurantsService.upsertFromGooglePlace` (mock Prisma, SearchService, Cache; assert geom + index + cache invalidation are called).
- **Docs:** In `docs/` or README, document: how to get a Google API key, set `GOOGLE_PLACES_API_KEY`, run `pnpm import:restaurants`, and what `--dry-run` does.

---

## Summary order

| # | Task | Depends on |
|---|------|------------|
| 1 | Prisma schema + migration `add_google_places_fields` | — |
| 2 | Env validation + .env.example for `GOOGLE_PLACES_API_KEY` | — |
| 3 | GooglePlacesService + GoogleModule (Nearby, Details, Photo URL) | 2 |
| 4 | RestaurantsService.upsertFromGooglePlace (upsert + geom + index + cache) | 1, 3 |
| 5 | Script `import-restaurants.ts` (Nest bootstrap, pagination, rate limit, dry-run) | 3, 4 |
| 6 | Photo redirect endpoint (server-side URL from photo_reference) | 3 |
| 7 | Tests and docs | 1–6 |

Implement in this order; 6 and 7 can be done in parallel after 5 or deferred.
