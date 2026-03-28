# Phase 2 — Code Review

Review of the Phase 2 implementation (Sri Lanka reference data, location/near-me search) for **security**, **validation gaps**, **error handling**, and **missing tests**.

---

## 1. Security

| # | Issue | Severity | Location | Recommendation |
|---|--------|----------|----------|----------------|
| 1 | **Raw SQL for location** | OK | RestaurantsService.search | Uses `Prisma.sql` with template parameters for `lat`, `lng`, `radiusM`; values are parsed to numbers in JS before use. Prisma parameterizes the query → no SQL injection. |
| 2 | **GET /districts public** | OK | LocationsController | By design; static list, no PII. No change. |
| 3 | **GET /restaurants public with lat/lng** | OK | RestaurantsController | Browsing by location is intentional. No sensitive data in response. |
| 4 | **Backfill script** | Low | backfill-restaurant-geom.ts | Admin-only script; validates id/lat/lng before raw UPDATE. Safe. |
| 5 | **CORS** | Note | main.ts | Fixed origins (localhost). For production, configure allowed origins via env. |

---

## 2. Validation gaps

| # | Issue | Severity | Location | Recommendation |
|---|--------|----------|----------|----------------|
| 1 | **lat/lng/radius_km as strings only** | Low | SearchRestaurantsDto | DTO has `@IsOptional() @IsString()` only. Service parses and validates ranges (-90/90, -180/180, 0–500 km). Optional: add `@MaxLength(20)` to limit payload size; optional `@Matches(/^-?\d+(\.\d+)?$/)` for numeric strings so invalid format returns 400 before service. |
| 2 | **Sri Lanka bounds not enforced** | Low | RestaurantsService | Product is Sri Lanka–only; lat/lng could be restricted to ~5.9–9.9, 79.5–82.0. Currently any world coords accepted. Optional: reject or clamp to Sri Lanka. |
| 3 | **page / pagesize** | Low | SearchRestaurantsDto | No `@Min`/`@Max` at DTO level. Service clamps (page ≥ 1, pagesize 1–100). Optional: add `@Type(() => Number)` and `@IsInt() @Min(1) @Max(100)` for clearer 400. |
| 4 | **pricelevel** | Low | SearchRestaurantsDto | No format/length validation; service parses to numbers and filters NaN. Optional: constrain array length or element format. |
| 5 | **District/city from frontend** | OK | Web/Mobile | District comes from `/districts` list; city is free text. Backend has MaxLength(100) and case-insensitive match. OK. |

---

## 3. Error handling

| # | Issue | Severity | Location | Recommendation |
|---|--------|----------|----------|----------------|
| 1 | **Partial location params** | OK | RestaurantsService | If only one or two of lat/lng/radius_km sent → `BadRequestException`. Good. |
| 2 | **Invalid numbers** | OK | RestaurantsService | NaN or out-of-range lat/lng/radius → `BadRequestException`. Good. |
| 3 | **Prisma/DB errors** | Medium | RestaurantsService.search | Raw query or findMany can throw (e.g. connection). No try/catch; Nest global filter can return 500. Same as rest of app; consider global exception filter later. |
| 4 | **Web: restaurants list fetch failure** | Medium | apps/web/page.tsx | On `GET /restaurants` failure only `console.error`; loading stops but user sees empty list or previous list. No "Failed to load" message. Add error state and show message + retry. |
| 5 | **Web: districts fetch failure** | Low | apps/web/page.tsx | Districts fail → only console; dropdown stays empty. Optional: show "Could not load districts" or retry. |
| 6 | **Mobile: restaurants fetch failure** | Medium | apps/mobile (tabs)/index.tsx | Same as web: no user-visible error; list can be stale or empty. Add error state and message. |
| 7 | **Mobile: districts fetch failure** | Low | apps/mobile (tabs)/index.tsx | District modal stays empty. Optional: show message. |

---

## 4. Missing tests

| # | Gap | Severity | Recommendation |
|---|-----|----------|----------------|
| 1 | **LocationsController** | High | No spec. Add: GET / returns 200 and array of districts with id/name. |
| 2 | **RestaurantsService.search** | High | Current spec only "should be defined" and does not mock PrismaService (test likely fails). Add: mock PrismaService; test search without location returns shape { page, pagesize, total, data }; test with partial location (e.g. only lat) throws BadRequestException; test with valid lat/lng/radius_km and mocked $queryRaw/findMany returns data with distance_km. |
| 3 | **RestaurantsController search** | Medium | Add: GET /restaurants with query params returns service result; invalid query (e.g. partial location) returns 400. |
| 4 | **E2E** | Medium | No e2e for GET /districts or GET /restaurants?lat=&lng=&radius_km=. Add: 200 for valid location params; 400 when only lat provided. |

---

## 5. Summary and priority fixes

**Recommended fixes**

1. **Web & Mobile:** On restaurants list fetch failure, set an error state and show a short message (e.g. "Failed to load restaurants") and optional retry so the user is not left with an empty or stale list.
2. **API tests:** Add `locations.controller.spec.ts` (GET returns districts). Fix `restaurants.service.spec.ts` with PrismaService mock and add tests for search (no location, partial location → 400, full location with mock).

**Optional improvements**

- DTO: `@MaxLength(20)` on lat/lng/radius_km; optional Sri Lanka bounds in service.
- DTO: numeric/range validation for page and pagesize.
- E2E for /districts and /restaurants with location params.

**Checklist**

| Category       | Finding |
|----------------|---------|
| Security       | Raw SQL parameterized; public endpoints by design. CORS and backfill OK. |
| Validation     | Service validates location numbers and ranges; DTO could add format/length. |
| Error handling | API: 400 for bad location. Frontends: no user-visible error on list fetch failure. |
| Tests          | No locations tests; restaurants search and Phase 2 behaviour untested. |
