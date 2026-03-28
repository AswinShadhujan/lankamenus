# Phase 5 — Code Review

Review of the Phase 5 implementation (Meilisearch & Redis: search, index sync, caching, sessions) for **security**, **validation gaps**, **error handling**, and **missing tests**.

---

## 1. Security

| # | Issue | Severity | Location | Recommendation |
|---|--------|----------|----------|----------------|
| 1 | **Meilisearch / Redis optional** | OK | SearchService, CacheService | Both are no-op when env not set; app works without them. No secret required in code when disabled. Good. |
| 2 | **Meilisearch query `q`** | OK | SearchService.searchRestaurantIds, RestaurantsService.search | `q` is passed to Meilisearch SDK (parameterized). Not used in raw SQL. Prisma fallback uses parameterized `where`. No injection. |
| 3 | **Redis keys** | OK | cache-keys.ts, buildSearchCacheKey | Keys are server-controlled: `restaurant:${id}`, `menu:${id}`, `session:${uuid}`, `restaurants:list:${JSON.stringify(dto)}`. DTO fields are validated (MaxLength etc.); key is not user-supplied. SCAN pattern is fixed (`restaurants:list:*`). No key injection. |
| 4 | **Session id (`jti`)** | OK | AuthService, JwtStrategy | Session id is generated with `randomUUID()` on login and stored in JWT. Logout uses `req.user.jti` from validated JWT. Not client-supplied. Good. |
| 5 | **Logout protected** | OK | AuthController | `POST /auth/logout` uses `JwtAuthGuard`; only valid tokens can revoke their own session. Good. |
| 6 | **Cached response parsing** | Low | RestaurantsService.findOne, search; MenusService.findOne | `JSON.parse(cached)` on cache hit; if Redis returns corrupted data, parse can throw and is caught (findOne/search fall through to DB). Acceptable. |
| 7 | **Meilisearch / Redis URLs in env** | Low | env.validation | `MEILISEARCH_HOST` has `.uri()`; `REDIS_URL` is plain string (so `redis://` works). Ensure production Redis URL is not logged. Optional: avoid logging full REDIS_URL in errors. |
| 8 | **No rate limiting** | Medium | GET /restaurants, POST /auth/login | Public search and login remain unthrottled. Add `@nestjs/throttler` (Phase 8) for production. |

---

## 2. Validation gaps

| # | Issue | Severity | Location | Recommendation |
|---|--------|----------|----------|----------------|
| 1 | **Env: MEILISEARCH_HOST** | OK | env.validation.ts | Optional URI; empty string allowed. Good. |
| 2 | **Env: REDIS_URL** | OK | env.validation.ts | Optional string (no `.uri()` so `redis://` / `rediss://` valid). Good. |
| 3 | **Search cache key size** | Low | buildSearchCacheKey | Key is JSON of DTO; DTO has MaxLength(200) on `q`, MaxLength(100) on city/district/cuisine. Key length is bounded. Acceptable. |
| 4 | **Session TTL** | OK | cache-keys.ts | `SESSION_TTL_SECONDS = 604800` (7 days). JWT expiry (e.g. 15m) still applies. Document in deploy doc (done in PHASE-5-REDIS-SESSIONS.md). |
| 5 | **Meilisearch search limit** | OK | SearchService.searchRestaurantIds | `limit` capped at 2000. Prevents unbounded result set. Good. |

---

## 3. Error handling

| # | Issue | Severity | Location | Recommendation |
|---|--------|----------|----------|----------------|
| 1 | **Meilisearch index/delete** | OK | SearchService | indexRestaurant, deleteRestaurantFromIndex: try/catch, log, swallow so DB mutations succeed. Good. |
| 2 | **Meilisearch search** | OK | RestaurantsService.search | searchRestaurantIds() not wrapped in SearchService; RestaurantsService catches in `if (useMeilisearch) { try { ... } catch { useMeilisearch = false } }` and falls back to Prisma. Good. |
| 3 | **Redis get/set/del/delByPattern** | OK | CacheService | All catch, log, and return null or no-op. Callers (findOne, search, etc.) fall through to DB on cache failure. Good. |
| 4 | **Auth issueToken cache.set** | OK | AuthService | `.catch(() => {})` so login/register succeed even if Redis fails. Session will be missing so token may be rejected later if Redis required. Acceptable. |
| 5 | **Auth logout** | Medium | AuthService.logout | No try/catch around `cache.del`. If Redis throws (e.g. connection lost), logout returns 500. Optional: wrap in try/catch, log, still return `{ ok: true }`. |
| 6 | **CacheService constructor** | OK | CacheService | Redis client creation in try/catch; client null on failure, isConfigured() false. Good. |
| 7 | **onModuleDestroy** | Low | CacheService | `await this.client.quit()` may throw if connection already dead. Optional: try/catch and log. |

---

## 4. Missing tests

| # | Gap | Severity | Recommendation |
|---|-----|----------|----------------|
| 1 | **SearchService** | Medium | No search.service.spec.ts. Add: isConfigured when host set vs not; indexRestaurant no-op when client null; indexRestaurant calls buildRestaurantDocument and addDocuments (mock Prisma + Meilisearch); deleteRestaurantFromIndex; searchRestaurantIds returns ids and totalHits (mock index.search). |
| 2 | **CacheService** | Low | No cache.service.spec.ts. Add: isConfigured; get/set/del no-op when client null; get/set/del call Redis when configured; delByPattern uses SCAN (mock client). |
| 3 | **RestaurantsService search with Meilisearch** | Medium | Current spec mocks isConfigured false. Add test: when isConfigured true and searchRestaurantIds returns ids, assert where.id in candidateIds and result order preserved (or integration-style test with mocks). |
| 4 | **Cache invalidation on mutate** | Low | RestaurantsService and MenusService: assert that create/update/delete call cache.del or delByPattern (already mocked; could assert mock invoked with expected key/pattern). |
| 5 | **AuthService / JwtStrategy** | OK | auth.service.spec.ts and jwt.strategy.spec.ts cover register, login, logout, session store when cache configured, and validate with/without session. Good. |
| 6 | **E2E** | Low | No e2e for Phase 5: GET /restaurants?q= with Meilisearch, cached GET /restaurants/:id, POST /auth/logout. Optional for Phase 8. |

---

## 5. Summary and priority fixes

**Recommended**

1. **Error handling:** In `AuthService.logout`, wrap `cache.del` in try/catch; on error log and still return `{ ok: true }` so logout does not 500 when Redis is down.
2. **Tests (optional):** Add SearchService unit tests (indexRestaurant, deleteRestaurantFromIndex, searchRestaurantIds with mocked client and Prisma). Optionally add CacheService tests.

**Optional**

- Rate limiting on search and login (Phase 8).
- CacheService.onModuleDestroy: try/catch around quit().
- RestaurantsService spec: one test with isConfigured true and searchRestaurantIds returning ids to confirm Meilisearch path and ordering.

**Checklist**

| Category       | Finding |
|----------------|---------|
| Security       | Meilisearch/Redis optional; keys and session id server-controlled; logout protected. No injection. Rate limiting still missing. |
| Validation     | Env and DTOs adequate; search cache key bounded; Meilisearch limit capped. |
| Error handling | Index/delete/cache methods swallow and log; search falls back to Prisma. Logout can 500 if Redis throws. |
| Tests          | Auth and JwtStrategy well covered. No SearchService or CacheService specs; RestaurantsService Meilisearch path not tested. |
