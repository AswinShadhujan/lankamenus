# Phase 0 — Code Review (current)

Review of the Phase 0 implementation for **security**, **validation gaps**, **error handling**, and **missing tests**. Items marked **FIXED** have been addressed in the codebase.

---

## 1. Security issues

| # | Issue | Severity | Status | Location | Notes |
|---|--------|----------|--------|----------|--------|
| 1 | **CORS origins hardcoded** | Medium | Open | `main.ts` | Origins are fixed (localhost:3000, 19006). For production, use env (e.g. `CORS_ORIGINS`). Planned for Phase 8. |
| 2 | **No rate limiting** | Medium | Open | Global | Auth and public endpoints not rate-limited; brute-force risk. Add `@nestjs/throttler` (Phase 8). |
| 3 | **RolesGuard assumes `user` exists** | Low | **FIXED** | `roles.guard.ts` | `if (!user) return false;` added before role check. |
| 4 | **Password in login response** | N/A | OK | — | Auth does not return password. OK. |
| 5 | **JWT secret length** | OK | OK | `env.validation.ts` | `JWT_SECRET` required, `min(16)`. |

---

## 2. Validation gaps

| # | Issue | Severity | Status | Location | Notes |
|---|--------|----------|--------|----------|--------|
| 1 | **GET /restaurants/:id returns 200 with `null`** | High | **FIXED** | `restaurants.service.ts` | `findOne()` throws `NotFoundException('Restaurant not found')` when `findUnique` returns null. |
| 2 | **Search DTO: `page` / `pagesize` range** | Low | Open | `search-restaurants.dto.ts` | Only `@IsString()`. Service clamps (1–100). Optional: numeric range validation. |
| 3 | **Search DTO: `pricelevel`** | Low | Open | `search-restaurants.dto.ts` | No decorator; accepts any string/array. Optional. |
| 4 | **Register: duplicate email** | High | **FIXED** | `auth.service.ts` | P2002 caught; throws `ConflictException('Email already registered')`. |
| 5 | **Auth DTOs: max length** | Low | **FIXED** | `register.dto.ts`, `login.dto.ts` | Email 255, password 128, name 100. |
| 6 | **Search: `q` max length** | Low | **FIXED** | `search-restaurants.dto.ts` | `@MaxLength(200)` on `q`; city, district, cuisine 100. |

---

## 3. Error handling

| # | Issue | Severity | Status | Location | Notes |
|---|--------|----------|--------|----------|--------|
| 1 | **No global exception filter** | Medium | Open | — | Unhandled errors can leak stack/details. Add exception filter (Phase 8). |
| 2 | **RestaurantsService.delete** | — | OK | `restaurants.service.ts` | P2025 → `NotFoundException`. Other errors re-thrown. |
| 3 | **AuthService.register** | High | **FIXED** | `auth.service.ts` | P2002 → `ConflictException`. Other errors re-thrown. |
| 4 | **AuthService.login** | — | OK | — | Invalid credentials → `UnauthorizedException`. |
| 5 | **RestaurantsService.findOne** | High | **FIXED** | `restaurants.service.ts` | Throws `NotFoundException` when not found. |
| 6 | **RestaurantsService.search** | Low | OK | — | Invalid page/pagesize clamped; acceptable. |

---

## 4. Missing tests

| # | Gap | Severity | Status | Recommendation |
|---|-----|----------|--------|----------------|
| 1 | **RestaurantsController** | High | Open | Spec only “should be defined”. Add: search shape, getOne 404, delete 204/404 with mocks. |
| 2 | **RestaurantsService** | High | Open | Spec only “should be defined”. Add: search, findOne 404, delete P2025/success with mocked Prisma. |
| 3 | **AuthService** | High | Open | No `auth.service.spec.ts`. Add: register success/duplicate 409, login success/invalid 401. |
| 4 | **AuthController** | Medium | Open | Add: register/login with DTOs; invalid body → 400. |
| 5 | **AppController** | Low | Open | Add: `getHealth()` returns `{ status: 'ok' }`. |
| 6 | **Guards** | Low | Open | Optional: JwtAuthGuard Public; RolesGuard role check. |
| 7 | **E2E** | Medium | Open | No Phase 0 e2e. Add: health, restaurants, auth register/login/duplicate. |

---

## 5. Summary

**Fixed in Phase 0**

- **Validation/errors:** findOne → 404; register duplicate → 409; RolesGuard `!user` → false.
- **Validation (DTOs):** MaxLength on auth (email, password, name) and search (q, city, district, cuisine).

**Still open (Phase 0 scope)**

- **Security:** CORS from env, rate limiting (planned Phase 8).
- **Validation:** Optional numeric/range for page, pagesize, pricelevel.
- **Error handling:** Global exception filter (Phase 8).
- **Tests:** All Phase 0 specs are still minimal; no auth specs, no e2e.

**Checklist**

| Category        | Status |
|----------------|--------|
| Security       | RolesGuard fixed; CORS and rate limiting open (Phase 8). |
| Validation     | findOne 404, register 409, MaxLength on DTOs done; page/pagesize/pricelevel optional. |
| Error handling | findOne, delete, register errors handled; global filter open (Phase 8). |
| Tests          | Only “should be defined”; no auth tests, no e2e. |

Phase 0 behavior and validation are in good shape; remaining work is tests and Phase 8 hardening (CORS, rate limit, exception filter).
