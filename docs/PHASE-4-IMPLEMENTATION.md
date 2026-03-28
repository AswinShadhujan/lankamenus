# Phase 4 — Implementation Guide

How to implement **Phase 4 — Search over menus** in this project. Tasks are in **dependency order**.

**Goal:** Users can find restaurants and menus by typing a dish name, ingredient, or restaurant name on web and mobile.

---

## Task order (summary)

| Order | Task | What to do |
|-------|------|------------|
| **1** | 4.1 | Extend `GET /restaurants` so that when `q` is present, also search `menu_items.name` and `menu_items.description`; return restaurants that match. Keep existing filters (district, city, cuisine, veg, halal, price, lat/lng/radius). |
| **2** | 4.2 | Web: add search box and wire it (and existing filters) to the extended endpoint. |
| **3** | 4.3 | Mobile: add search input and wire to endpoint; optional “search in menu” emphasis. |

---

## 4.1 — Extend search to menu content (API)

**Goal:** When `q` is provided, match restaurants whose **name**, **city**, or **district** contain the query (current behavior) **or** that have at least one **menu item** whose **name** or **description** contains the query. All other filters (district, city, cuisine, veg, halal, price, lat/lng/radius) continue to apply.

**Data model:** `restaurants` → `menus` → `menu_sections` → `menu_items` (name, description). Only active menus should be considered if the app uses `is_active` for public listing.

**Steps**

1. **RestaurantsService.search** (`services/api/src/restaurants/restaurants.service.ts`):
   - When building `where` and `dto.q` is present, extend the `OR` array to include a condition on related menu content:
     - Restaurant matches if **any** of its menus has **any** section with **any** item where:
       - `menu_items.name` contains `q` (case-insensitive), or
       - `menu_items.description` contains `q` (case-insensitive).
   - Prisma relation path: `menus` (filter `is_active: true` if you only want active menus) → `menu_sections` → `menu_items`.
   - Example shape (conceptually):
     - `where.OR = [ existing name_default/city/district clauses, { menus: { some: { is_active: true, menu_sections: { some: { menu_items: { OR: [ { name: { contains: q, mode: 'insensitive' } }, { description: { contains: q, mode: 'insensitive' } } ] } } } } } } ]`
   - Keep all other filters (district, city, cuisine, veg, halal, price_level, location ids) applied on top of this `where` (AND with the OR block).

2. **No DTO changes** required: `SearchRestaurantsDto` already has optional `q` with `@MaxLength(200)`.

3. **Performance:** For large datasets, a single Prisma query with nested relations may be sufficient; Phase 5 (Meilisearch) will offer full-text indexing if needed.

**Exit criteria:** `GET /restaurants?q=kottu` returns restaurants that have “kottu” in name/city/district **or** in any menu item name/description. Other params (e.g. `district=Colombo`) still filter correctly.

---

## 4.2 — Web: search UI

**Goal:** Users can type a search query (dish or restaurant name) and apply existing filters (district, near me) with results from the extended endpoint.

**Steps**

1. **Home page** (`apps/web/src/app/page.tsx` or equivalent):
   - Add a **search input** (e.g. “Search dishes or restaurant name”).
   - Store the value in state (e.g. `searchQuery`); trim before sending.
   - When fetching restaurants, include `q: searchQuery` in params when non-empty.
   - Optionally: add **city** and **cuisine** filters (dropdown or text) and pass `city`, `cuisine` to match the API (already supported). Veg/halal can be added as checkboxes later if desired.

2. **UX:** Submit search on button click and/or on Enter; keep “district” and “Use my location” working together with the search term.

**Exit criteria:** User can type “kottu” (or similar) in the search box and see restaurants that serve it or match the name; filters still apply.

---

## 4.3 — Mobile: search UI

**Goal:** Same as web: search box and filters wired to the extended `GET /restaurants` endpoint, with optional “search in menu” emphasis (e.g. placeholder text).

**Steps**

1. **Home / search screen** (e.g. `apps/mobile/app/(tabs)/index.tsx`):
   - Add a **search TextInput** (placeholder e.g. “Search dishes or restaurant name” or “Search in menu”).
   - Store value in state; when calling `GET /restaurants`, pass `q` when non-empty.
   - Ensure existing filters (district, city, cuisine, near me) are still sent and applied.

2. **Apply:** Trigger fetch when user taps “Apply Filters” (existing) or add “Search” button; optionally debounce or search on submit to avoid excessive requests.

**Exit criteria:** User can search by dish or restaurant name on mobile; filters (district, city, cuisine, near me) continue to work.

---

## Implementation order checklist

1. **[4.1]** In `RestaurantsService.search`, when `dto.q` is present, add to `where.OR` a clause that matches restaurants with at least one active menu containing an item whose name or description contains `q` (case-insensitive). Keep all other filters.
2. **[4.2]** Web: search input, wire `q` (and existing filters) to `GET /restaurants`.
3. **[4.3]** Mobile: search input, wire `q` to `GET /restaurants`; optional “search in menu” placeholder.

**Exit criteria (from roadmap):** Users can find restaurants and menus by typing dish or restaurant name on web and mobile.
