# Phase 4 — Code Review

Review of the Phase 4 implementation (Search over menus) for **security**, **validation gaps**, **error handling**, and **missing tests**.

---

## 1. Security

| # | Issue | Severity | Location | Recommendation |
|---|--------|----------|----------|----------------|
| 1 | **Search endpoint is public** | OK | RestaurantsController | `GET /restaurants` is `@Public()`; no auth required. Intended for browsing. Good. |
| 2 | **Query param `q` not used in raw SQL** | OK | RestaurantsService.search | `q` is only passed into Prisma `where` (e.g. `contains: q, mode: 'insensitive'`). Prisma uses parameterized queries; no SQL injection from `q`. |
| 3 | **No rate limiting on search** | Medium | GET /restaurants | Public search can be hammered; may stress DB with complex `OR` + nested relations. Add throttling (e.g. Phase 8 `@nestjs/throttler`) for production. |
| 4 | **Search result content** | OK | SELECT_RESTAURANT | Response shape unchanged; no menu item text or raw HTML in search response. No new data exposure. |
| 5 | **Web/Mobile: search in URL params** | Low | apps/web page.tsx, apps/mobile index | `q` sent as query param; axios/fetch encode it. No client-side injection into DOM from `q` (value is in controlled input). Display of results uses existing restaurant fields. |

---

## 2. Validation gaps

| # | Issue | Severity | Location | Recommendation |
|---|--------|----------|----------|----------------|
| 1 | **`q` length and type** | OK | SearchRestaurantsDto | `@IsOptional() @IsString() @MaxLength(200)`; ValidationPipe runs before service. Good. |
| 2 | **Empty/whitespace `q`** | OK | RestaurantsService.search | `const q = dto.q.trim(); if (q)` prevents adding `where.OR` for blank or whitespace-only query. No wasted query. |
| 3 | **`cuisine` / `city` / `district`** | OK | SearchRestaurantsDto | Existing `@MaxLength(100)` (city, district), optional string (cuisine). No change in Phase 4. |
| 4 | **Very long `q` in URL** | Low | General | 200 chars is already large for a search box. Optional: trim to first 200 chars in service as defense-in-depth if DTO is bypassed. |

---

## 3. Error handling

| # | Issue | Severity | Location | Recommendation |
|---|--------|----------|----------|----------------|
| 1 | **Search: no try/catch** | Medium | RestaurantsService.search | Prisma/DB errors (connection, timeout) propagate. Same as rest of app; global exception filter (Phase 8) should map to stable JSON and avoid leaking stack. |
| 2 | **Complex `where` and timeouts** | Low | RestaurantsService.search | Nested `menus.some.menu_sections.some.menu_items.OR` can be heavy on large datasets. Consider query timeout or moving to Meilisearch (Phase 5) for scale. |
| 3 | **Web: search API failure** | OK | apps/web page.tsx | `fetchRestaurants` catch sets `fetchError` and shows “Failed to load restaurants. Please try again.” + Retry. Good. |
| 4 | **Mobile: search API failure** | OK | apps/mobile index.tsx | catch sets `fetchError` and shows message; user can tap “Apply Filters” to retry. Good. |

---

## 4. Missing tests

| # | Gap | Severity | Recommendation |
|---|-----|----------|----------------|
| 1 | **Search with `q`: where includes menu clause** | High | Add test: `service.search({ q: 'kottu' })` and assert the `where` passed to `prisma.restaurants.count`/`findMany` includes an `OR` entry with `menus.some.menu_sections.some.menu_items` (name/description contains). E.g. spy on `findMany` and check first call’s `where.OR`. |
| 2 | **Search with `q` returns results** | Medium | Add test: mock `$transaction` to return `[1, [mockRestaurant]]` when `search({ q: 'test' })` is called; assert result shape and that findMany/count were called with a `where` that has `OR` of length 4 (name, city, district, menu items). |
| 3 | **Search with empty/whitespace `q`** | Low | Add test: `search({ q: '   ' })` does not add `where.OR` (findMany/count receive `where` without `OR`), or assert same behavior as no `q`. |
| 4 | **Search with `q` + other filters** | Low | Add test: `search({ q: 'rice', district: 'Colombo' })` — assert `where` contains both the text `OR` and `district: { equals: 'Colombo', mode: 'insensitive' }`. |
| 5 | **E2E for GET /restaurants?q=** | Medium | Optional: e2e test that `GET /restaurants?q=kottu` returns 200 and body has `data` array (content depends on seed). |

---

## 5. Summary and priority fixes

**Recommended**

1. **Tests:** Add at least one unit test that verifies when `q` is provided, the `where` passed to Prisma includes the menu-items branch (e.g. spy on `prisma.restaurants.findMany` and assert `where.OR` has four elements, one being the `menus.some...menu_items` clause). Optionally add test for whitespace-only `q` and for `q` combined with district.
2. **Optional:** Document or add a simple test that search with `q` and filters (district, city) combines them correctly.

**Optional**

- Rate limiting on `GET /restaurants` (Phase 8).
- Global exception filter (Phase 8).
- Query timeout or monitoring for slow search (Phase 5/8).

**Checklist**

| Category       | Finding |
|----------------|---------|
| Security       | No injection; search is public by design; no rate limit. |
| Validation     | `q` validated (optional string, max 200); empty/whitespace handled in service. |
| Error handling | No new error paths; Prisma errors propagate; clients show error and retry. |
| Tests          | No test that search with `q` builds the menu-inclusive `where` or returns correct shape. |
