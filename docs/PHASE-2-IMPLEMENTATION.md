# Phase 2 — Implementation Guide

How to implement **Phase 2 — Sri Lanka reference data & location** in this project. Tasks are in **dependency order**.

**Goal:** Users can find restaurants by area (district/city) and by “near me” (lat/lng + radius) on web and mobile.

---

## Task order (summary)

| Order | Task | What to do |
|-------|------|------------|
| **1** | 2.1 | Add `GET /districts` (and optionally `GET /cities`) with a static list of Sri Lankan districts. |
| **2** | 2.2 | Extend `GET /restaurants` with `lat`, `lng`, `radius_km`; filter/order by distance using `restaurants.geom`; return distance when provided. |
| **3** | 2.3 | Document how to populate `restaurants.geom` (admin will do it in Phase 3); optional script for existing rows. |
| **4** | 2.4 | Web: district/city filters from `/districts`; optional “Use my location” for near me. |
| **5** | 2.5 | Mobile: district/city filters; “Near me” using device location. |

---

## 2.1 — GET /districts (and optionally GET /cities)

**Goal:** Expose a public list of Sri Lankan districts (and optionally cities) for filters and validation.

**Options**

- **Static JSON** in the API (no DB): one source of truth, no migrations.
- **DB table**: more flexible later (e.g. add more regions); requires migration and seed.

**Recommended for Phase 2:** Static list in code.

**Steps**

1. **Create a locations module** (or add to an existing “reference” module):
   - `services/api/src/locations/locations.controller.ts`
   - `services/api/src/locations/locations.module.ts`
   - Optional: `services/api/src/locations/data/sri-lanka-districts.ts`

2. **Sri Lankan districts list**  
   Use the official 25 districts (e.g. Ampara, Anuradhapura, Badulla, Batticaloa, Colombo, Galle, Gampaha, Hambantota, Jaffna, Kalutara, Kandy, Kegalle, Kilinochchi, Kurunegala, Mannar, Matale, Matara, Monaragala, Mullaitivu, Nuwara Eliya, Polonnaruwa, Puttalam, Ratnapura, Trincomalee, Vavuniya). Export as a constant array of `{ id: string, name: string }` or just `string[]`.

3. **Controller**
   - `@Controller('districts')` or `@Controller('locations')` with `@Get('districts')`
   - `@Public()`
   - Return the static array (e.g. `GET /districts` → `[{ "id": "colombo", "name": "Colombo" }, ...]`).

4. **Optional: cities**  
   If you need cities (e.g. for a second dropdown), either:
   - Static list per district, or
   - Derive from existing data: `GET /restaurants` with a “group by” city/district, or a dedicated `GET /cities` that returns distinct city/district from restaurants (slower, but no static list to maintain).

5. **Register module** in `app.module.ts`.

**Exit criteria:** `GET /districts` returns 200 with an array of Sri Lankan districts. Frontends can use it for dropdowns.

---

## 2.2 — Extend GET /restaurants with location (lat, lng, radius_km)

**Goal:** When `lat`, `lng`, and `radius_km` are provided, filter restaurants by distance from that point (using `restaurants.geom`) and optionally order by distance and return distance in the response.

**Constraints**

- `restaurants.geom` is PostGIS `geography`. Prisma does not support it natively (schema has `Unsupported("geography")`), so use **raw SQL** for the spatial part.
- Use `prisma.$queryRaw` to get restaurant ids (and distance) within radius, then use `prisma.restaurants.findMany({ where: { id: { in: ids } } })` and merge distance, or do a single raw SELECT with the columns you need.

**Steps**

1. **Extend SearchRestaurantsDto** (`services/api/src/restaurants/dto/search-restaurants.dto.ts`):
   - Add optional `lat?: string` (or number via transform)
   - Add optional `lng?: string`
   - Add optional `radius_km?: string`
   - Validate: if any of lat/lng/radius_km is present, all three should be present (or validate each as number in range). Optional: clamp lat/lng to Sri Lanka bounds (e.g. lat 5.9–9.9, lng 79.5–82.0).

2. **RestaurantsService.search**
   - If `lat`, `lng`, and `radius_km` are provided:
     - Parse as numbers; validate (e.g. radius_km 0.1–500, lat/lng in valid ranges). Optional: clamp to Sri Lanka.
     - Use raw SQL with PostGIS. Example (adjust table/column names to match your DB):
       - `ST_DWithin(geom::geography, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography, radius_m)` where `radius_m = radius_km * 1000`.
       - Select `id` and `ST_Distance(geom::geography, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography)` as distance.
     - Use **parameterized** `$queryRaw` (e.g. `Prisma.sql`) to avoid injection; pass lat, lng, radius_m as parameters.
     - Get list of `{ id, distance }` for restaurants within radius.
     - Fetch full restaurant rows by id (Prisma `findMany` with `where: { id: { in: ids } }`), then merge distance and sort by distance.
     - Apply other existing filters (city, district, cuisine, etc.) **after** the spatial filter (e.g. filter the id list by running the same filters in a second query, or combine in raw SQL for better performance).
   - If lat/lng/radius_km are **not** provided, keep current behavior (no distance filter/order, no distance in response).
   - When distance is computed, include it in each item of the response (e.g. `distance_km: number`).

3. **Response shape**  
   When location params are used, each restaurant in `data` can include `distance_km` (optional). Document in API or types.

**Security:** Always use parameterized raw queries (Prisma.sql and template literals with parameters) to avoid SQL injection.

**Exit criteria:** `GET /restaurants?lat=6.9&lng=79.9&radius_km=10` returns restaurants within 10 km of (6.9, 79.9), ordered by distance, with distance in the response when geom is set.

---

## 2.3 — Populate / maintain restaurants.geom

**Goal:** Ensure `restaurants.geom` can be set when creating or updating restaurants, and optionally backfill existing rows.

**Note:** Phase 3 will add `POST /restaurants` and `PATCH /restaurants/:id`. In Phase 2 you only need to document or prepare how geom is written.

**Steps**

1. **Document** in code or docs: to set `geom` from lat/lng, use raw SQL or a small helper:
   - PostGIS: `ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography`.
   - Prisma: `$executeRaw` or `$queryRaw` to update `restaurants SET geom = ... WHERE id = ?`, since Prisma doesn’t support geography in normal updates.

2. **Optional: backfill script**  
   If you have existing restaurants with no geom but have lat/lng in another column or CSV, add a one-off script (e.g. `scripts/backfill-geom.ts`) that reads rows and runs the raw update. Not required for Phase 2 if all new data will get geom in Phase 3.

**Exit criteria:** Clear approach (and, if needed, script) for setting and updating `restaurants.geom` from lat/lng.

---

## 2.4 — Web: location filters + “near me”

**Goal:** On the web app, users can filter by district (and optionally city) and use “Use my location” for near-me search.

**Steps**

1. **Fetch districts** on the home or search page: `GET /districts`. Store in state or use in a dropdown.

2. **District (and city) filter**
   - Add a dropdown (or autocomplete) for district, populated from `/districts`.
   - Optional: city dropdown (from `/cities` or derived list).
   - When user selects district/city, call `GET /restaurants?district=...&city=...` (existing params). Update the list.

3. **“Use my location” (near me)**
   - Add a button “Use my location” or “Near me”.
   - Use browser geolocation API: `navigator.geolocation.getCurrentPosition`.
   - On success, get `lat`, `lng`; choose a default `radius_km` (e.g. 5 or 10).
   - Call `GET /restaurants?lat=...&lng=...&radius_km=...`.
   - Display results (with optional distance_km if returned). On error (permission denied or unavailable), show a message.

4. **Combine** with existing search/filters: ensure district/city and near-me play well with existing query params (q, cuisine, etc.).

**Exit criteria:** User can filter by district (and optionally city) and use “Near me” to see restaurants within a radius on web.

---

## 2.5 — Mobile: location filters + “near me”

**Goal:** Same as web: district/city filters and “Near me” using device location.

**Steps**

1. **Fetch districts** (e.g. on home screen load): `GET /districts`. Use in a picker/dropdown or modal.

2. **District (and city) filter**
   - Add UI to select district (and optionally city). On apply, call `GET /restaurants?district=...&city=...` and refresh the list.

3. **“Near me”**
   - Add a button “Near me” (or icon).
   - Use Expo / React Native location: `expo-location` (e.g. `Location.getCurrentPositionAsync`) with appropriate permissions.
   - On success, call `GET /restaurants?lat=...&lng=...&radius_km=...` and show results (optionally with distance).
   - On permission denied or error, show a short message and optionally link to settings.

4. **Permissions**  
   Ensure `app.json` / `Info.plist` / Android manifest include location usage descriptions and permissions for Expo.

**Exit criteria:** User can filter by district/city and use “Near me” on mobile to see restaurants within a radius.

---

## Implementation order checklist

1. **[2.1]** Add locations module (or districts endpoint) with static Sri Lanka districts list; expose `GET /districts`; register module.
2. **[2.2]** Add `lat`, `lng`, `radius_km` to SearchRestaurantsDto; in RestaurantsService.search use raw PostGIS query when provided; return distance when applicable; keep existing behavior when not provided.
3. **[2.3]** Document (and optionally implement) how to set/update `restaurants.geom`; add backfill script only if needed.
4. **[2.4]** Web: districts dropdown, optional city, “Use my location” button calling GET /restaurants with lat/lng/radius_km.
5. **[2.5]** Mobile: districts (and optional city) filter, “Near me” with expo-location, permissions and error handling.

**Exit criteria (from roadmap):** Users can find restaurants by area (district/city) and by “near me” on web and mobile.
