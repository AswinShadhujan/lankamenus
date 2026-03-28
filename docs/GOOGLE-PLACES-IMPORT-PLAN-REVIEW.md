# Google Places restaurant import — plan review

Your plan is **sound and production-viable**. Below are alignment notes with the existing codebase and **production-grade refinements** you can adopt.

---

## Part 1 — Prisma schema updates

### Align with existing schema

- **`created_at`** — Already exists as `created_at` on `restaurants`. Do **not** add `createdAt` again.
- **Naming** — Current schema uses **snake_case** for DB columns (`name_default`, `address_line1`, `created_at`). For new fields, use Prisma `@map("snake_case")` so the DB stays consistent, e.g.:
  - `googlePlaceId` → `@map("google_place_id")`
  - `photoUrl` → `@map("photo_url")`
- **`address` vs `address_line1`** — You already have `address_line1`. Either:
  - **Option A:** Map Google “vicinity” / “formatted_address” into **`address_line1`** and do **not** add a separate `address` column, or
  - **Option B:** Add `address` as a separate field if you want both (e.g. “vicinity” in `address`, full “formatted_address” in `address_line1`). Avoid duplicating the same value in two columns.
- **`latitude` / `longitude`** — Adding them is useful for the importer and for simple queries. **Important:** Keep **`geom`** in sync so “near me” search still works. After each insert/update from Google, set `geom` from lat/lng (same as existing `setGeomFromLatLng` in `RestaurantsService`).
- **Non-destructive migration** — Add all new fields as **optional** (`String?`, `Float?`) or with `@default(...)` so existing rows stay valid. No drops, no renames of existing columns.

### Suggested field list (no duplicates)

| Your plan      | Action |
|----------------|--------|
| googlePlaceId  | Add `String? @unique @map("google_place_id")` |
| address        | Use existing `address_line1` or add `String?` and map Google vicinity there |
| latitude       | Add `Float?` (optional so existing rows are valid) |
| longitude      | Add `Float?` |
| rating         | Add `Float?` |
| photoUrl       | Add `String? @map("photo_url")` (see photo security below) |
| category       | Add `String?` (e.g. first of `types`) |
| createdAt      | **Skip** — already `created_at` |
| updatedAt      | Add `DateTime? @updatedAt @map("updated_at")` |

Migration name: `add_google_places_fields` is fine.

---

## Part 2 — Google Places importer

### Production refinements

1. **Photo URL and API key**
   - **Do not** store a URL that contains the API key (e.g. Places Photo request URL) in the DB or send it to the client.
   - **Preferred:** Store **`photo_reference`** (and optionally `width`) in the DB. Build the photo URL **server-side** when serving the API (e.g. in a controller or service) using the key from env. Then the key never leaves the server.
   - **Alternative:** Store a **signed or proxy URL** that your backend serves without exposing the key. Either way, avoid `photoUrl` containing the key.

2. **Duplicate handling**
   - Use **upsert** keyed by `google_place_id` instead of “skip if exists.” That way:
     - First run: inserts.
     - Later runs: updates rating, photo, address, etc., so data stays fresh.
   - If you prefer “skip if exists,” that’s fine for a one-off seed; document the choice.

3. **Geom sync**
   - After each insert/update that has lat/lng, set `geom` (e.g. call the same logic as `setGeomFromLatLng` in `RestaurantsService`, or run the same raw SQL). Otherwise “near me” search will not see the new/updated rows.

4. **Search index**
   - If you use Meilisearch, after creating/updating restaurants, call `searchService.indexRestaurant(id)` (and invalidate list cache) so search and list APIs stay in sync. Your existing services already do this for create/update.

5. **City / district**
   - For “Colombo, Sri Lanka,” you can set `city` (e.g. `"Colombo"`) and optionally `district` from the response (e.g. from `address_components` or a single value) so filters and existing indexes work.

---

## Part 3 — Import script

### Production refinements

1. **Rate limiting**
   - **Nearby Search:** Google allows a limited number of requests per second. Use a delay (e.g. **≥ 2 seconds** between pages when using `next_page_token`; Google often requires this).
   - Add a small delay between each Place Details or Photo request (e.g. 100–200 ms) to avoid hitting rate limits.

2. **Pagination**
   - Handle `next_page_token`: wait **at least 2 seconds** before the next request, then call the same endpoint with `pagetoken=...`. Loop until no more token.

3. **Idempotency**
   - Use **upsert** (e.g. `prisma.restaurants.upsert` where `google_place_id` is the unique key) so re-running the script is safe and updates existing rows.

4. **Logging**
   - Use a logger; log progress (e.g. “Page 3”, “Imported 50 so far”), errors per place (with place_id), and a final summary (created / updated / skipped / failed).

5. **Dry run**
   - Add an optional `--dry-run` (or env `DRY_RUN=1`) that fetches and validates without writing to the DB. Helps verify API key and parsing.

6. **Error handling**
   - If one place fails (e.g. missing data, photo error), **log and continue**; don’t abort the whole run. Count failures and list them in the summary.

7. **Batch size (optional)**
   - Insert/upsert in batches (e.g. 50) and then refresh geom/search index per batch to balance speed and memory.

---

## Part 4 — Environment variables

- Add `GOOGLE_PLACES_API_KEY` to **env validation** (e.g. Joi: required when running the import script, or optional if the app can run without it). **Never** log or expose the key.
- Use **ConfigService** in the importer (if run inside Nest) or `process.env` in a standalone script; ensure the key is loaded from `.env` (e.g. dotenv in the script if needed).

---

## Part 5 — File structure

Your structure is fine:

- `src/integrations/google/google-places.service.ts` — Encapsulates Places API (Nearby Search, Place Details, Photo). Keeps API key and rate limiting in one place.
- `src/scripts/import-restaurants.ts` — CLI entrypoint.

**Script execution:**

- **Option A (Nest context):** Bootstrap the Nest app in the script, get `PrismaService` + `GooglePlacesService` (and optionally `RestaurantsService` for geom/cache/search), then run the import. Pro: reuses geom/cache/search logic. Con: heavier.
- **Option B (Standalone):** Script uses `PrismaClient` and a small Google client (e.g. axios); after each upsert, run raw SQL to set `geom` and optionally call a small “index this id” helper. Pro: simple, no Nest bootstrap. Con: duplicate geom logic unless you extract it.

Recommendation: **Option A** if you want to reuse `RestaurantsService` (geom, cache, search index); **Option B** if you prefer a minimal script and can duplicate or extract the geom update.

**package.json:**

- `"import:restaurants": "ts-node -r dotenv/config src/scripts/import-restaurants.ts"` so `.env` is loaded when the script runs (or use `node --env-file=.env dist/scripts/import-restaurants.js` if you build first).

---

## Part 6 — Safety checks

Your validations are good:

- Require **name**, **coordinates** (lat/lng), **place_id** before insert/update.
- Use **upsert** keyed by `google_place_id` (or explicit duplicate check) so the script is idempotent.

Add:

- **Validate** lat/lng ranges (e.g. lat -90..90, lng -180..180) and reject or skip invalid rows.
- **Sanitize** strings (trim, max length) to match your schema/DTOs (e.g. `name_default` 200 chars, `address_line1` 500).

---

## Summary: your plan vs production tweaks

| Your plan item              | Verdict | Suggestion |
|----------------------------|--------|------------|
| Add new fields to Prisma   | OK     | No duplicate `created_at`; add `@map` for snake_case; optional lat/lng for non-destructive migration. |
| Migration non-destructive  | OK     | All new columns optional or with defaults. |
| Google Nearby Search       | OK     | Handle pagination + 2s delay for `next_page_token`. |
| Store photo URL            | Risk   | Store `photo_reference` (and width); build URL server-side so API key is never stored or sent to client. |
| Skip duplicates            | OK     | Prefer upsert by `google_place_id` for repeat runs. |
| Rate limit handling        | OK     | Explicit delays (e.g. 2s between pages, 100–200ms between details/photo). |
| CLI script                 | OK     | Load `.env`; add --dry-run; log progress and summary; continue on per-place errors. |
| Integrate with Nest/Prisma | OK     | Use Nest bootstrap + PrismaService (and optionally RestaurantsService) for geom/cache/search, or standalone script + raw geom update. |
| Set geom from lat/lng      | Must   | After each insert/update, set `geom` so “near me” search works. |
| Meilisearch / cache        | Must   | After each create/update, re-index and invalidate list cache (if you use RestaurantsService or equivalent). |

---

## Conclusion

Your plan is **OK for production** with these adjustments:

1. **Schema:** Add only new fields; use `@map` for snake_case; keep new fields optional; do not add a second `created_at`.
2. **Photos:** Store `photo_reference` (and optionally width); build photo URL server-side; never store or expose the API key.
3. **Geom & search:** Keep `geom` in sync from lat/lng and re-index (and invalidate cache) after each create/update.
4. **Script:** Idempotent upsert; rate limits and pagination delays; dry-run; per-place error handling and summary logging.
5. **Env:** Add `GOOGLE_PLACES_API_KEY` to validation and never log it.

If you want, next step can be a concrete implementation (migration + `GooglePlacesService` + import script + env) following this review.
