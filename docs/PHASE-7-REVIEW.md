# Phase 7 — Optional enhancements: review

Review of the Phase 7 implementation for security, validation, error handling, and tests.

---

## 1. Security

### API (favourites)

- **Authorization:** All three routes (`GET/POST/DELETE /users/me/favourites`) are protected by `JwtAuthGuard`. `userId` is taken only from `req.user.userId` (JWT payload). Users cannot access or modify another user’s favourites.
- **Input:** `restaurantId` in POST is validated by `CreateFavouriteDto` (`@IsInt()`, `@Min(1)`). DELETE uses `ParseIntPipe` for the path param (non-integer returns 400). No unsanitized user input is used in queries beyond validated ids.
- **Response:** Favourites list returns only restaurant entities (same shape as public restaurant API); no internal or sensitive data exposed.

### Web & mobile

- **Auth gate:** Favourites list and favourite toggle are only available when the user has a token; unauthenticated users are redirected or shown “Log in” (no privilege escalation).
- **Rendering:** Restaurant names and other data are rendered through React/React Native (escaped by default); no XSS concerns from API data.
- **API URL (7.5):** `NEXT_PUBLIC_API_URL` and `EXPO_PUBLIC_API_URL` are intended to be set by the deployer; exposing the API base URL to the client is expected.

### Optional hardening (later)

- **DELETE path param:** `ParseIntPipe` allows any integer (e.g. negative). `deleteMany` with a non-existent or invalid id is a no-op and does not leak data. You could add a check (e.g. `restaurantId < 1` → `BadRequestException`) for consistency with POST validation.

---

## 2. Validation

### API

- **CreateFavouriteDto:** `restaurantId` is `@IsInt()` and `@Min(1)`. ValidationPipe (global) rejects non-integer or &lt; 1 with 400. No `@Max()`; extremely large ids could be rejected with a `@Max()` if you want to cap range (optional).
- **DELETE `:restaurantId`:** Only `ParseIntPipe`; non-integer path returns 400. Range (e.g. positive only) is not enforced; see optional hardening above.
- **Service:** `add()` checks that the restaurant exists before creating a favourite and throws `NotFoundException` if not; behaviour is correct and tested.

### Web & mobile

- **Favourite toggle:** Uses `restaurant.id` from the current restaurant object (no free-text input). Remove uses the same id from the list. No client-side validation gap for favourites.

---

## 3. Error handling

### API

- **FavouritesService:** `add()` throws `NotFoundException('Restaurant not found')` when the restaurant does not exist; other Prisma errors are rethrown. P2002 (unique constraint) is caught and treated as idempotent success. `remove()` uses `deleteMany` and does not throw.
- **FavouritesController:** Does not catch service exceptions; Nest returns 404 when `add()` throws `NotFoundException`, and 201/204 on success. Unauthorized (missing `userId`) returns 401.

### Web

- **Favourites page:** 401 on list → redirect to login; other errors → list set to `[]`, loading cleared. Remove failure is swallowed (`.catch(() => {})`); list state is unchanged. Acceptable; optional improvement: show a short “Failed to remove” message or retry.
- **Restaurant detail:** Favourite fetch and toggle failures are caught and ignored; `isFavourite` and loading state are still cleared. Optional: show a brief error or retry for toggle.

### Mobile

- **Favourites tab:** Same pattern: 401/errors on fetch result in empty list or login prompt; remove failure is silent. Optional: toast or inline error.
- **Explore:** Districts fetch errors set `error` state and show “Failed to load districts.” Good.

### 7.5 (API URL)

- **Web:** Empty or undefined `NEXT_PUBLIC_API_URL` falls back to `http://localhost:3001`. No throw; safe for dev and prod (set env in prod).
- **Mobile:** Same for `EXPO_PUBLIC_API_URL` with default `http://10.0.2.2:3001`. Safe.

---

## 4. Tests

### API (favourites)

- **FavouritesService:** List (with/without rows), add (restaurant not found → `NotFoundException`, success, duplicate P2002 → idempotent), remove (deleteMany called with correct args). Covered.
- **FavouritesController:** List returns data and uses `userId`; list/add/remove throw `UnauthorizedException` when `userId` is null; add/remove call service with correct args. **Added in review:** add propagates `NotFoundException` when service throws (404 for non-existent restaurant).

### Gaps (optional)

- **Controller:** No test for DELETE with invalid path (e.g. non-numeric) — ParseIntPipe is a framework behaviour; can be covered by e2e if desired.
- **Web/Mobile:** No unit or integration tests for favourites or Explore UI; acceptable for Phase 7. E2E can cover flows later.

---

## 5. Summary

| Area           | Status | Notes |
|----------------|--------|--------|
| Security       | OK     | Favourites scoped to JWT user; validated ids; no XSS; API URL from env is intentional. Optional: reject negative/zero `restaurantId` on DELETE. |
| Validation     | OK     | DTO and ParseIntPipe in place; optional: `@Max()` for `restaurantId`, positive-only DELETE param. |
| Error handling | OK     | API 404/401 behaviour correct; clients handle 401 and clear state; failures on remove/toggle are silent (optional: user-visible error or retry). |
| Tests          | OK     | Service and controller specs cover main paths and 404 propagation; optional: e2e for favourites flow. |

Phase 7 implementation is in good shape after the added controller test for 404 on add. Remaining items are optional UX and hardening improvements.
