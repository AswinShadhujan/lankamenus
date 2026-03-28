# Prisma database layer — production readiness audit

Audit of the Prisma schema, query patterns, indexing, N+1 risk, pagination, and validation. Recommendations focus on correctness, performance, and scalability.

---

## 1. Schema correctness

### 1.1 ✅ Strengths

- **Primary keys:** All main tables use `Int @id @default(autoincrement())`.
- **Foreign keys:** All relations use explicit `@relation(fields, references)`. Cascades are set where appropriate: `menus` → `restaurants`, `menu_sections` → `menus`, `menu_items` → `menu_sections`, `favourites` → `users` and `restaurants` (all `onDelete: Cascade`).
- **Uniques:** `users.email` is `@unique`; `favourites` has `@@unique([user_id, restaurant_id])`, preventing duplicate favourites and supporting idempotent add.
- **Types:** `price_level` is `@db.SmallInt`; `price` is `Decimal(10,2)`; `cuisine_tags` is `String[]`; `geom` is `Unsupported("geography")` for PostGIS.
- **Nullability:** Optional fields (city, district, description, etc.) are correctly optional; required fields are non-optional.

### 1.2 ⚠️ Gaps and recommendations

- **Check constraints:** The schema comments say *"This table contains check constraints and requires additional setup for migrations"* for `restaurants` and `spatial_ref_sys`. If the DB enforces e.g. `price_level IN (1,2,3,4)` or `price >= 0`, ensure migrations and Prisma are in sync (see [Prisma check constraints](https://pris.ly/d/check-constraints)). Document any raw SQL used to add checks.
- **`users.role`:** Stored as `String @default("user")` with no enum. Application code uses roles (e.g. in guards). Consider a Prisma `enum` or at least document allowed values and add app-side validation so invalid roles are rejected before write.
- **String lengths:** Prisma does not enforce `@db.VarChar(n)` on most fields; max lengths are enforced only in DTOs (e.g. `MaxLength(200)` on `name_default`). This is acceptable; ensure all write paths go through validated DTOs and that schema `@db.VarChar` matches DTO limits where you care (e.g. email 255).
- **`spatial_ref_sys`:** Read-only PostGIS system table; no app writes. No change needed.

---

## 2. Relation integrity

### 2.1 ✅ Strengths

- **Cascades:** Deleting a restaurant deletes its menus, sections, and items, and related favourites. Deleting a user deletes their favourites. No orphaned rows.
- **Referential integrity:** All FKs are defined in the schema; Prisma and the DB enforce them.
- **Menu tree consistency:** Section and item operations validate `menu_id` / `menu_section_id` and `menuId` in the path (e.g. `findFirst({ where: { id: sectionId, menu_id: menuId } })`) so cross-menu misuse is rejected.

### 2.2 ⚠️ Minor

- **Optional improvement:** For `menu_items.menu_section_id`, if the app ever moves items between sections, ensure the section belongs to the same menu (already enforced in `updateItem` via DTO and `findFirst` check).

---

## 3. Indexing for search and queries

### 3.1 Current state

- **Explicit indexes in schema/migrations:** Only the unique index on `favourites(user_id, restaurant_id)` is present. There are **no** `@@index` directives in the Prisma schema for:
  - `restaurants`: city, district, cuisine_tags, name_default, geom
  - `menus`: restaurant_id
  - `menu_sections`: menu_id (and sort_order for ordered loads)
  - `menu_items`: menu_section_id (and sort_order)
- **PostgreSQL:** Foreign keys do **not** auto-create indexes on the referencing column. So `menus.restaurant_id`, `menu_sections.menu_id`, and `menu_items.menu_section_id` are not indexed unless added explicitly.
- **Spatial:** `restaurants.geom` is used in raw SQL with `ST_DWithin` / `ST_Distance`. Without a GIST index on `geom`, these queries will do full table scans.

### 3.2 Query patterns that need indexing

| Query / pattern | Table(s) | Recommended index |
|-----------------|----------|--------------------|
| Restaurant search by `city` (equals, case-insensitive) | restaurants | `@@index([city])` or composite with other filters |
| Restaurant search by `district` | restaurants | `@@index([district])` |
| Restaurant search by `cuisine_tags` (hasSome) | restaurants | GIN index on `cuisine_tags` (Prisma: `@@index([cuisine_tags], type: Gin)`) |
| Restaurant search by `price_level` (in list) | restaurants | `@@index([price_level])` |
| “Near me” / spatial | restaurants | GIST on `geom` (requires raw SQL in migration: `CREATE INDEX ... ON restaurants USING GIST(geom)`) |
| Text search on name/city/district (ILIKE) | restaurants | Optional: pg_trgm GIN for `name_default`, `city`, `district` (raw migration) |
| List menus by restaurant | menus | `@@index([restaurant_id])` |
| List sections by menu (ordered) | menu_sections | `@@index([menu_id])` or `@@index([menu_id, sort_order])` |
| List items by section (ordered) | menu_items | `@@index([menu_section_id])` or `@@index([menu_section_id, sort_order])` |
| Favourites by user | favourites | Covered by `@@unique([user_id, restaurant_id])` (leftmost column = user_id) |
| User by email | users | Covered by `@unique` on email |

### 3.3 Recommended actions

1. **Add to `schema.prisma`** (then `prisma migrate dev`):
   - `menus`: `@@index([restaurant_id])`
   - `menu_sections`: `@@index([menu_id])` (or composite with `sort_order` if you want index-only ordering)
   - `menu_items`: `@@index([menu_section_id])`
   - `restaurants`: `@@index([city])`, `@@index([district])`, `@@index([price_level])`, and if supported: `@@index([cuisine_tags], type: Gin)` (check Prisma version for GIN).
2. **Spatial index (raw SQL):** Prisma does not generate GIST indexes. Run the SQL in `prisma/migrations/README-SPATIAL-INDEX.md` (e.g. `CREATE INDEX CONCURRENTLY IF NOT EXISTS restaurants_geom_idx ON restaurants USING GIST(geom);`) so `ST_DWithin`/`ST_Distance` use the index.
3. **Optional:** For heavy text search without Meilisearch, add trigram indexes (raw SQL) on `name_default`, `city`, `district` for ILIKE.

---

## 4. N+1 query issues

### 4.1 Current usage — no critical N+1

- **RestaurantsService.search:** Single `$transaction` with `count` + `findMany`; no loop over results that triggers extra queries. When location is used, a raw query returns ids and distances; then one `findMany` by id. No N+1.
- **RestaurantsService.findOne / create / update / delete:** Single queries or one find after write. No N+1.
- **MenusService.findByRestaurant:** One `findUnique(restaurant)` then one `findMany(menus)`. Two queries total, not N+1.
- **MenusService.findOne:** One `findUnique` with nested `include` (sections + items). Single query. No N+1.
- **MenusService** (createSection, updateSection, createItem, updateItem, deleteSection, deleteItem): Each operation does one or two reads (to resolve menu/restaurant) then one write. Not N+1.
- **FavouritesService.findAllByUserId:** One `findMany` with `include: { restaurant: true }`. Single query. No N+1.
- **SearchService.buildRestaurantDocument:** One `findUnique` with nested `include`. Single query. No N+1.
- **AuthService:** Single `findUnique` by email or id. No N+1.

### 4.2 Recommendation

- Keep loading relations via `include`/`select` in a single query where you need them. If you later add “list all restaurants with menu count” or “list menus with item count”, use a single query with `_count` or aggregated includes rather than looping and calling `findMany` per parent.

---

## 5. Missing pagination

### 5.1 Paginated

- **Restaurant search:** `page` and `pagesize` (capped at 100); `skip`/`take` applied in the main branch. When results are sorted by distance or by Meilisearch order, the code fetches a larger set then slices in memory (see scalability below).

### 5.2 Not paginated

- **MenusService.findByRestaurant:** Returns all menus for a restaurant. For typical usage (few menus per restaurant) this is fine. If a restaurant could have hundreds of menus, add `skip`/`take` and a total count.
- **MenusService.findOne (full menu):** Returns the whole menu tree (sections + items). Acceptable for normal menu sizes; consider pagination or “lazy load sections” only if menus become very large.
- **FavouritesService.findAllByUserId:** Returns all favourite restaurants for a user with no limit. If users can have thousands of favourites, this can become slow and memory-heavy. **Recommendation:** Add pagination (e.g. `page`, `pagesize`) and return `{ data, total, page, pagesize }`.

### 5.3 Recommendation

- Add pagination to **favourites list** (e.g. `page`, `pagesize`, default page size 20–50). Keep total count for the current user for UI.

---

## 6. Data validation gaps

### 6.1 Aligned with schema

- **Restaurants:** Create/Update DTOs validate `name_default` length, `cuisine_tags` (array size 20), `price_level` 1–4, lat/lng ranges. Matches schema and usage.
- **Menu items:** Name/description/price/currency/sort_order validated; price ≥ 0. Matches `Decimal(10,2)` and usage.
- **Menu sections:** Name, sort_order ≥ 0. Consistent with schema.
- **Auth:** Email/password validated in DTOs; password hashed before write. No plain-text password in DB.

### 6.2 Gaps and recommendations

- **users.email:** No `MaxLength` in auth DTOs; Prisma `String` defaults to 255 in DB. Add `@MaxLength(255)` (or match your DB) on login/register DTOs to avoid truncation or errors.
- **users.role:** Not set by client in register (defaults in DB). If an admin endpoint can set role, validate against an allow list (e.g. `user | admin`) so invalid values are never written.
- **cuisine_tags elements:** DTOs use `@IsString({ each: true })` and `@ArrayMaxSize(20)`. Consider `@MaxLength(50)` per tag so a single tag cannot be overly long.
- **menu name / section name:** Create/update DTOs have `@MaxLength(200)`. Schema has no explicit length; ensure DB column length is at least 200 or document truncation.
- **Decimal price:** Prisma type is `Decimal(10,2)`; DTO validates `@Min(0)`. Negative prices are rejected. For very large prices, consider a max (e.g. 9999999.99) if you want to enforce it in the app.

---

## 7. Scalability improvements

### 7.1 Restaurant search

- **Location + distance:** When `hasLocation && distanceById.size > 0`, the code fetches **all** matching rows in the radius, then sorts by distance in memory and slices for the page. For large result sets (e.g. 10k+ in radius), this uses more memory and CPU than necessary.
  - **Improvement:** Use a single raw SQL query that orders by `ST_Distance(...)` and applies `LIMIT` and `OFFSET` (and returns total count via a window or a second count query). That way the DB does the sort and only returns one page.
- **Meilisearch + location:** When using Meilisearch with location, the code fetches all candidate ids in the radius (or all Meili ids), then loads full rows and sorts/slices. Consider a cap (e.g. max 2000 ids) and document that “near me” search is best-effort beyond that.
- **Caching:** List and entity caching (Redis) is in place; cache key includes search params. For scalability, consider shorter TTLs for list cache or cache invalidation on any restaurant/menu change (already done for entity and list pattern).

### 7.2 Favourites

- **Pagination:** Add `page`/`pagesize` to `findAllByUserId` so response size and query cost are bounded as user favourites grow.
- **Index:** The unique index on `(user_id, restaurant_id)` supports “list by user” and “add/remove” efficiently. If you add “restaurant is favourited by current user” for many restaurants in one request, consider a single query that returns favourite restaurant ids for the user and merge in app, rather than one query per restaurant.

### 7.3 Menus

- **Large menus:** If a single menu can have hundreds of sections or thousands of items, consider:
  - Paginating sections (or sections + items) in the “get full menu” endpoint, or
  - Returning sections with item counts first and loading items per section on demand.
- **Search index:** Meilisearch indexing on restaurant/menu changes is done inline (sync). For bulk updates, consider a queue (e.g. job queue) so indexing does not block the request.

### 7.4 General

- **Connection pooling:** Use PgBouncer or Prisma’s connection pool in production so many concurrent requests do not exhaust DB connections.
- **Read replicas:** For read-heavy search and list endpoints, consider routing read-only Prisma client to a replica and writes to the primary (Prisma doesn’t support this out of the box; would require two clients or middleware).
- **Monitoring:** Add slow-query logging and metrics (e.g. Prisma query duration) to catch regressions and missing indexes in production.

---

## 8. Summary table

| Area | Status | Priority actions |
|------|--------|-------------------|
| Schema correctness | Good | Document check constraints; consider enum for `users.role`. |
| Relation integrity | Good | No change required. |
| Indexing | Gaps | Add indexes on FK columns (menus, menu_sections, menu_items); add GIST on `restaurants.geom`; add indexes on restaurants (city, district, price_level, optionally cuisine_tags GIN). |
| N+1 | Good | No N+1 found; keep using single-query includes. |
| Pagination | Partial | Add pagination to favourites list; consider DB-level pagination for location search. |
| Data validation | Good | Add email max length and optional per-tag length for cuisine_tags; validate role if writable. |
| Scalability | Partial | Paginate location search in DB; cap or document large radius/Meili result sets; add favourites pagination; consider queue for search indexing. |

---

## 9. Suggested next steps (in order)

1. **High:** Add Prisma indexes for `menus(restaurant_id)`, `menu_sections(menu_id)`, `menu_items(menu_section_id)`, and a raw migration for `restaurants_geom_idx` (GIST on `geom`).
2. **High:** Add pagination to `FavouritesService.findAllByUserId` and to the API that exposes it.
3. **Medium:** Add `@@index` on `restaurants` for `city`, `district`, `price_level`; add GIN on `cuisine_tags` if supported.
4. **Medium:** Refactor location-based search to use a single raw SQL query with `ORDER BY distance LIMIT/OFFSET` (and optional total count) to avoid loading full result sets into memory.
5. **Low:** Add `@MaxLength(255)` for email in auth DTOs; optional `@MaxLength(50)` per cuisine tag; document or enforce `users.role` allow list if writable.
6. **Low:** Document check constraints and any raw SQL used in migrations; consider job queue for Meilisearch indexing under heavy write load.
