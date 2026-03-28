# Phase 3 — Code Review

Review of the Phase 3 implementation (Admin: restaurant & menu CRUD, admin UI) for **security**, **validation gaps**, **error handling**, and **missing tests**.

---

## 1. Security

| # | Issue | Severity | Location | Recommendation |
|---|--------|----------|----------|----------------|
| 1 | **Admin routes protected** | OK | RestaurantsController, MenusController, RestaurantMenusController | POST/PATCH/DELETE use `@Roles(Role.ADMIN)` and `RolesGuard`. JWT required. Good. |
| 2 | **Raw SQL for geom** | OK | RestaurantsService.setGeomFromLatLng | Uses `Prisma.sql` with parameterized `restaurantId`, `lat`, `lng`. No SQL injection. |
| 3 | **Token in localStorage** | Low | apps/web src/lib/api.ts, login | Admin JWT stored in `localStorage`. XSS could steal it. Acceptable for admin tool; for production consider httpOnly cookie or short-lived token + refresh. |
| 4 | **Role check on login** | OK | apps/web admin/login/page.tsx | After login, checks `data.user?.role === 'admin'` and does not store token if not admin. Good. |
| 5 | **401 handling** | OK | api.ts response interceptor | On 401, clears token and redirects to /admin/login when on admin path. Prevents stuck state. |
| 6 | **No rate limiting on login** | Medium | Auth (global) | Login endpoint not rate-limited; brute-force possible. Add `@nestjs/throttler` or similar (e.g. Phase 8). |
| 7 | **GET /restaurants/:id/menus?active_only=false** | Low | RestaurantMenusController | Public endpoint; any client can pass `active_only=false` and see inactive menus. Low impact (menu names only). Optional: restrict `active_only=false` to admin (e.g. require auth and role). |

---

## 2. Validation gaps

| # | Issue | Severity | Location | Recommendation |
|---|--------|----------|----------|----------------|
| 1 | **Path ids: zero or negative** | Low | All controllers | `ParseIntPipe` allows `0` and negative (e.g. `PATCH /restaurants/-1`). Prisma returns 404 or no-op. Optional: custom pipe or `@Min(1)` in DTO for id params to return 400 for invalid id. |
| 2 | **CreateRestaurantDto: cuisine_tags element length** | Low | create-restaurant.dto.ts | `@IsArray() @IsString({ each: true }) @ArrayMaxSize(20)` but no max length per tag. Very long strings could be sent. Optional: `@MaxLength(50)` per element (class-validator supports it in array). |
| 3 | **CreateRestaurantDto: empty cuisine_tags** | Low | create-restaurant.dto.ts | DTO allows `[]`; backend might expect at least one. Service passes it to Prisma; DB allows empty array. Document or require `@ArrayMinSize(1)` if business rule is “at least one cuisine”. |
| 4 | **UpdateRestaurantDto: empty body** | OK | update-restaurant.dto.ts | PATCH with `{}` is valid; service returns findOne(id). Acceptable. |
| 5 | **CreateMenuItemDto: menu_section_id** | Low | create-menu-item.dto.ts | No `@Min(1)`; service validates section belongs to menu. Optional: reject non-positive section id at DTO level. |
| 6 | **Menu item price** | OK | create-menu-item.dto.ts, update-menu-item.dto.ts | `@IsNumber() @Min(0)`; Prisma Decimal accepts number. OK. |
| 7 | **Admin UI: form validation** | Low | RestaurantForm, menu/section/item forms | Client-side is minimal (required, trim). Backend DTOs enforce; 400 messages shown. Optional: add client-side max length / numeric checks for better UX. |

---

## 3. Error handling

| # | Issue | Severity | Location | Recommendation |
|---|--------|----------|----------|----------------|
| 1 | **RestaurantsService.create/update** | OK | restaurants.service.ts | create: P2025 not expected (create always returns). update/delete: P2025 → NotFoundException. Good. |
| 2 | **RestaurantsService.update: empty data** | OK | restaurants.service.ts | If dto has only lat/lng, update data is empty; Prisma update with {} still runs and then setGeomFromLatLng runs. Correct. |
| 3 | **MenusService: section/item ownership** | OK | menus.service.ts | createSection/createItem/updateSection/updateItem/deleteSection/deleteItem verify menu or section ownership. NotFoundException or BadRequestException. Good. |
| 4 | **Prisma/DB errors** | Medium | All services | Connection or unexpected Prisma errors propagate; no global exception filter. Same as rest of app; consider global filter (Phase 8) to avoid leaking stack/details. |
| 5 | **Admin UI: API errors** | OK | admin pages | List/create/edit pages set error state and show message on catch. Login shows “Access denied” or server message. Good. |
| 6 | **Admin UI: 401 redirect** | OK | api.ts | Interceptor clears token and redirects to login; user sees login page again. Good. |
| 7 | **Admin layout: token check** | Low | admin/layout.tsx | Redirect to login when no token; relies on client-side only. If token is expired but present, first API call returns 401 and then redirect. Acceptable. |

---

## 4. Missing tests

| # | Gap | Severity | Recommendation |
|---|-----|----------|----------------|
| 1 | **RestaurantsService.create** | High | Add test: create with valid dto returns restaurant; with lat/lng calls setGeomFromLatLng (mock $executeRaw). |
| 2 | **RestaurantsService.update** | High | Add test: update with partial dto returns updated restaurant; update with invalid id throws NotFoundException. |
| 3 | **RestaurantsController POST/PATCH** | Medium | Add tests: POST with valid body returns 201 and body (mock service); PATCH returns 200; invalid body returns 400. |
| 4 | **MenusService** | High | No menus.service.spec.ts. Add: createMenu (restaurant not found → 404); createSection, updateSection, deleteSection (menu/section ownership); createItem (section not in menu → 400); updateItem, deleteItem. |
| 5 | **MenusController** | Medium | No menus.controller.spec.ts or restaurant-menus.controller.spec.ts. Add: POST /restaurants/:id/menus 201; PATCH/DELETE /menus/:id with mock service. |
| 6 | **E2E** | Medium | No e2e for admin: POST /restaurants (with auth), PATCH /restaurants/:id, POST /menus, etc. Add with admin JWT. |

---

## 5. Summary and priority fixes

**Recommended**

1. **Tests:** Add unit tests for RestaurantsService.create and update (mock Prisma); add MenusService tests for createMenu, createSection, createItem, and ownership (section in menu, item in menu).
2. **Optional:** Reject zero/negative path ids (e.g. custom pipe `ParsePositiveIntPipe` or validate in controller) for clearer 400.

**Optional**

- Add `@MaxLength(50)` (or similar) for each element of `cuisine_tags` in CreateRestaurantDto.
- Restrict `active_only=false` to admin if you want inactive menus hidden from public.
- Rate limiting on login (Phase 8).
- Global exception filter (Phase 8).

**Checklist**

| Category       | Finding |
|----------------|---------|
| Security       | Admin routes and role check OK; token in localStorage; no rate limit on login. |
| Validation     | DTOs and ownership checks in place; path ids can be 0/negative; optional per-tag length. |
| Error handling | Services throw appropriate exceptions; admin UI shows errors; 401 redirect works. |
| Tests          | No Phase 3 unit or e2e tests for create/update menus or restaurants. |
