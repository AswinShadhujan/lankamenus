# Phase 1 — Code Review

Review of the Phase 1 implementation (Menus: data model, read-only API, web/mobile views) for **security**, **validation gaps**, **error handling**, and **missing tests**.

---

## 1. Security issues

| # | Issue | Severity | Location | Recommendation |
|---|--------|----------|----------|----------------|
| 1 | **Menu endpoints are public** | OK | MenusController, RestaurantMenusController | By design: browsing menus is public. No change needed. |
| 2 | **No authorization on menu by restaurant** | Low | MenusService | `findOne(id)` returns any menu by id; no check that menu belongs to the restaurant the user is viewing. Info is not sensitive; optional hardening for multi-tenant later. |
| 3 | **ID params: negative or zero** | Low | Controllers | `ParseIntPipe` allows negative numbers (e.g. `-1`). Prisma returns null → 404. Optional: reject negative/zero with a custom pipe or `@Min(1)` in a DTO. |
| 4 | **Prisma Decimal in response** | OK | menu_items.price | Serialized as string in JSON; frontends handle it. OK. |

---

## 2. Validation gaps

| # | Issue | Severity | Location | Recommendation |
|---|--------|----------|----------|----------------|
| 1 | **No DTOs for read responses** | Low | Menus module | Read-only; response shape follows Prisma. Optional: response DTOs if you want to hide fields or enforce shape. |
| 2 | **Path params only validated by ParseIntPipe** | OK | Both controllers | Non-integer ids (e.g. `abc`) get 400 from Nest. OK. |
| 3 | **Web: `id` from URL not validated** | Low | `restaurants/[id]/page.tsx` | Visiting `/restaurants/abc` sends request to API; backend returns 400. Optional: check `id` is numeric before calling API and show a friendly message. |
| 4 | **Mobile: same** | Low | `details.tsx` | Same as web; optional client-side numeric check. |

---

## 3. Error handling

| # | Issue | Severity | Location | Recommendation |
|---|--------|----------|----------|----------------|
| 1 | **MenusService.findByRestaurant** | OK | menus.service.ts | Throws `NotFoundException('Restaurant not found')` when restaurant missing. Returns only active menus. Good. |
| 2 | **MenusService.findOne** | OK | menus.service.ts | Throws `NotFoundException('Menu not found')` when menu missing. Good. |
| 3 | **No try/catch for Prisma errors** | Medium | MenusService | Connection/transaction errors propagate; no global exception filter yet (Phase 8). Same as rest of API. |
| 4 | **Web: API errors** | OK | `restaurants/[id]/page.tsx` | 404 → "Restaurant not found"; other errors → "Failed to load restaurant". Loading and error state handled. Good. |
| 5 | **Mobile: initial load failure** | High | `details.tsx` | On fetch failure (e.g. 404), only `console.error`; `restaurant` stays null and `loading` becomes false. UI then shows spinner forever because of `if (loading \|\| !restaurant)`. Should set an error state and show "Restaurant not found" or retry when request fails. |
| 6 | **Mobile: loadMenu failure** | Low | `details.tsx` | When switching menu tab, if `GET /menus/:id` fails, error is only logged; `selectedMenu` unchanged. Optional: show toast or inline error. |

---

## 4. Missing tests

| # | Gap | Severity | Recommendation |
|---|-----|----------|----------------|
| 1 | **MenusService** | High | No `menus.service.spec.ts`. Add: findByRestaurant returns menus for valid id and throws NotFound when restaurant missing; findOne returns menu with sections/items and throws NotFound when menu missing. Mock PrismaService. |
| 2 | **MenusController** | High | No spec. Add: getOne returns menu for valid id; getOne triggers 404 when service throws NotFound (integration or unit with mock). |
| 3 | **RestaurantMenusController** | High | No spec. Add: listByRestaurant returns array; 404 when restaurant missing. |
| 4 | **E2E** | Medium | No e2e for menus. Add: GET /restaurants/1/menus 200/404; GET /menus/1 200 with nested sections/items or 404. |

---

## 5. Summary and priority fixes

**Recommended fix (mobile UX):**

- **Mobile details screen:** On initial fetch failure (restaurant or menus), set an `error` state (e.g. `setError('Restaurant not found')`) and render a message + optional "Back" or retry instead of leaving the spinner visible when `!restaurant` and `!loading`.

**Optional improvements:**

- Reject negative or zero menu/restaurant ids (custom pipe or validation) for clearer 400.
- Web/mobile: validate route `id` is numeric before calling API for a friendlier client message.
- Add unit tests for MenusService and controller(s); add e2e for menu endpoints.

**Checklist**

| Category        | Finding |
|----------------|--------|
| Security       | Public read-only is correct; optional: reject negative ids, future tenant check for findOne. |
| Validation     | ParseIntPipe on ids is sufficient; optional client-side numeric check for route param. |
| Error handling | API: 404 for missing restaurant/menu. Web: errors handled. Mobile: initial load failure leaves spinner on; should show error. |
| Tests          | No menus unit or e2e tests. |

Implementing the mobile error-state fix will make Phase 1 behavior consistent across web and mobile when the restaurant or menu is missing or the request fails.
