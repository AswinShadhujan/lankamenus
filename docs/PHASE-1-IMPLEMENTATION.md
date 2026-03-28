# Phase 1 — Implementation Guide

How to implement **Phase 1 — Menus (data model + read APIs + web/mobile views)** in this project. Tasks are in **dependency order**; implement in this order.

**Goal:** End users can open a restaurant and see its menu(s) (sections and items) on web and mobile.

---

## Task order (summary)

| Order | Task | What to do |
|-------|------|------------|
| **1** | 1.1 | Add Prisma models `menus`, `menu_sections`, `menu_items`; run migration. |
| **2** | 1.2a | Create MenusModule, MenusService, and read-only endpoints (list by restaurant, get one by id with sections + items). |
| **3** | 1.2b | Register MenusModule in AppModule; ensure routes are public. |
| **4** | 1.3 | Web: add `/restaurants/[id]` page; fetch restaurant + menus; render menu(s) with sections and items. |
| **5** | 1.4 | Mobile: on restaurant details, fetch and show menus (sections + items). |

---

## 1.1 — Prisma: add `menus`, `menu_sections`, `menu_items`

**Goal:** Add the menu data model and relation to `restaurants`. One restaurant can have many menus; one menu has many sections; one section has many items.

**File to change:** `services/api/prisma/schema.prisma`

**Steps**

1. **Add `menus` model** (after the `restaurants` model, before `spatial_ref_sys`):

   - `id` — Int, @id, @default(autoincrement())
   - `restaurant_id` — Int, relation to `restaurants` (e.g. `restaurants restaurant @relation(...)`)
   - `name` — String (e.g. "Main menu", "Breakfast")
   - `is_active` — Boolean, @default(true)
   - `created_at` — DateTime?, @default(now())
   - `updated_at` — DateTime?, @updatedAt

   Add the back-relation on `restaurants`: `menus menus[]` (or `menus Menu[]` if you use PascalCase model names).

2. **Add `menu_sections` model**:

   - `id` — Int, @id, @default(autoincrement())
   - `menu_id` — Int, relation to `menus`
   - `name` — String (e.g. "Starters", "Main", "Drinks")
   - `sort_order` — Int, @default(0)
   - `created_at` — DateTime?, @default(now())
   - `updated_at` — DateTime?, @updatedAt

   Add back-relation on `menus`: `menu_sections menu_sections[]` (or `sections MenuSection[]`).

3. **Add `menu_items` model**:

   - `id` — Int, @id, @default(autoincrement())
   - `menu_section_id` — Int, relation to `menu_sections`
   - `name` — String
   - `description` — String? (optional)
   - `price` — Decimal or Float (e.g. `Decimal? @db.Decimal(10, 2)` or `Float?`)
   - `currency` — String?, @default("LKR")
   - `veg` — Boolean?, @default(false)
   - `sort_order` — Int, @default(0)
   - `created_at` — DateTime?, @default(now())
   - `updated_at` — DateTime?, @updatedAt

   Add back-relation on `menu_sections`: `menu_items menu_items[]` (or `items MenuItem[]`).

4. **Run migration** (from `services/api`):

   - `pnpm prisma migrate dev --name add_menus`
   - Then `pnpm prisma generate` (if not run automatically by migrate).

**Naming:** This project uses lowercase table names (`restaurants`, `users`). Use the same for new tables: `menus`, `menu_sections`, `menu_items` in the schema so Prisma generates matching client names.

**Exit criteria:** Migration applies cleanly; `prisma.restaurants.findMany({ include: { menus: true } })` is valid.

---

## 1.2a — Menus module (read-only API)

**Goal:** Expose two public read-only endpoints: list menus by restaurant, get one menu with sections and items.

**Routes (Phase 1 read-only):**

- `GET /restaurants/:restaurantId/menus` — list menus for a restaurant (e.g. active only).
- `GET /menus/:id` — get one menu by id with nested `sections` and each section’s `items`.

**Steps**

1. **Create MenusService** (`services/api/src/menus/menus.service.ts`):

   - Inject `PrismaService`.
   - `findByRestaurant(restaurantId: number)`: `prisma.menus.findMany({ where: { restaurant_id: restaurantId, is_active: true }, orderBy: { id: 'asc' } })`. Optionally include sections/items if you want a minimal nested shape for the list. For Phase 1, returning flat list of menus (id, name, is_active, etc.) is enough for list.
   - `findOne(id: number)`: `prisma.menus.findUnique({ where: { id }, include: { menu_sections: { orderBy: { sort_order: 'asc' }, include: { menu_items: { orderBy: { sort_order: 'asc' } } } } } })`. If not found, throw `NotFoundException('Menu not found')`.
   - Handle invalid `restaurantId` (e.g. no restaurant): either throw `NotFoundException('Restaurant not found')` after checking restaurant exists, or return empty array.

2. **Create two controllers** (so both route shapes work):

   - **Restaurant menus (nested route)** — e.g. `services/api/src/menus/restaurant-menus.controller.ts`:
     - `@Controller('restaurants/:restaurantId/menus')`
     - `@Public()` (no auth)
     - `@Get()` — call `menusService.findByRestaurant(+restaurantId)`; return array. Use `ParseIntPipe` for `restaurantId`.
   - **Single menu by id** — e.g. `services/api/src/menus/menus.controller.ts`:
     - `@Controller('menus')`
     - `@Public()`
     - `@Get(':id')` — call `menusService.findOne(+id)`; return menu with sections and items. Use `ParseIntPipe` for `id`.

3. **Create MenusModule** (`services/api/src/menus/menus.module.ts`):

   - Import `PrismaModule` (or rely on global `PrismaModule`).
   - Controllers: both restaurant-menus controller and menus controller.
   - Providers: `MenusService`.
   - Export: `MenusService` (if needed elsewhere).

**Route order:** In Nest, more specific routes must be registered before parametric ones. Register the controller that handles `restaurants/:restaurantId/menus` so it does not conflict with `GET /restaurants/:id` (which is getOne restaurant). The existing RestaurantsController has `Get(':id')` — so `GET /restaurants/1/menus` will be interpreted as getOne(1) with path "menus" as part of the id unless you define a child route. So you **must** define the menus list route in a way that Nest treats `menus` as path. Use a controller with path `restaurants/:restaurantId/menus` and `@Get()`. Then the full path is `GET /restaurants/:restaurantId/menus` and `:restaurantId` is the only param. That works.

**Exit criteria:** `GET /restaurants/1/menus` returns list of menus; `GET /menus/1` returns one menu with sections and items (or 404).

---

## 1.2b — Register MenusModule

**Goal:** Wire the new module into the app.

**File to change:** `services/api/src/app.module.ts`

- Add `import { MenusModule } from './menus/menus.module';`
- Add `MenusModule` to the `imports` array.

**Exit criteria:** App starts without errors; both menu endpoints respond.

---

## 1.3 — Web: restaurant detail + menu view

**Goal:** User can open a restaurant by id and see its menu(s) with sections and items.

**Steps**

1. **Add dynamic route** — Create `apps/web/src/app/restaurants/[id]/page.tsx` (Next.js App Router).

2. **Fetch data** — Use the route param `id` to:
   - `GET /restaurants/:id` — restaurant details.
   - `GET /restaurants/:id/menus` — list of menus (or use restaurant id in the list endpoint).

   Call both in parallel (e.g. `Promise.all`) or sequentially; handle loading and error (e.g. 404).

3. **Render** — Show restaurant name, address, etc. Then for each menu (or the first/active one), show:
   - Menu name.
   - Sections (e.g. "Starters", "Main") with a list of items under each: name, description, price, currency, veg badge if needed.

4. **Link from home** — On the existing list page (`apps/web/src/app/page.tsx`), make each restaurant a link to `/restaurants/[id]` (e.g. `<Link href={`/restaurants/${r.id}`}>`).

5. **Types (optional)** — Add `apps/web/src/types/menu.ts` (e.g. `Menu`, `MenuSection`, `MenuItem`) to match API response shapes.

**Exit criteria:** From the home list, user can click a restaurant and see its detail page with menu(s), sections, and items.

---

## 1.4 — Mobile: menu view from details

**Goal:** On the existing restaurant details screen, show the restaurant’s menu(s) with sections and items.

**Steps**

1. **Fetch menus** — In `apps/mobile/app/(tabs)/details.tsx` (or the screen that shows one restaurant), after fetching the restaurant (or in parallel), call `GET /restaurants/:restaurantId/menus` with the restaurant id. Optionally, if you want full section/item data on the list response, use that; otherwise fetch the first menu’s full detail with `GET /menus/:id` (e.g. first menu id from the list).

2. **State** — Add state for menus (e.g. list of menus or single menu with sections/items). Set it when the API responds.

3. **Render** — Below the existing restaurant info, render:
   - Menu name(s).
   - For the selected or first menu: list sections; under each section list items (name, description, price, veg).

4. **Types (optional)** — Add `apps/mobile/src/types/menu.ts` (e.g. `Menu`, `MenuSection`, `MenuItem`) to match API.

**Exit criteria:** From the home list, user taps a restaurant, sees details and the restaurant’s menu(s) with sections and items.

---

## Implementation order checklist

1. **[1.1]** Edit `schema.prisma`: add `menus`, `menu_sections`, `menu_items` and relations. Run `pnpm prisma migrate dev --name add_menus` and `pnpm prisma generate`.
2. **[1.2a]** Create `menus.service.ts`, `restaurant-menus.controller.ts`, `menus.controller.ts`, `menus.module.ts`. Implement list by restaurant and findOne with include.
3. **[1.2b]** Import and add `MenusModule` in `app.module.ts`.
4. **[1.3]** Add `apps/web/src/app/restaurants/[id]/page.tsx`; fetch restaurant + menus; render menu(s) with sections/items; link from home.
5. **[1.4]** In mobile details screen, fetch menus and render sections + items; add types if desired.

**Exit criteria (from roadmap):** End users can open a restaurant and see its menu(s) on web and mobile.
