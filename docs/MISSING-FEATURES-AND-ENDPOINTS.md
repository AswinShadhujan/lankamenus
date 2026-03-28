# Missing Features & Backend Endpoints

Based on the application purpose in [ARCHITECTURE.md](./ARCHITECTURE.md): **browse restaurant menus by location and search, limited to Sri Lanka**, with **end users** (browse) and **admins** (manage restaurants and menus).

---

## 1. Missing product features

| # | Feature | Description | User type |
|---|---------|-------------|-----------|
| 1 | **Menus & menu items** | View restaurant menus (sections/categories and items with name, description, price, etc.). Core to the product. | End users browse; admins manage |
| 2 | **Location-based discovery** | Find restaurants/menus by location: “near me” (lat/lng), or by Sri Lankan city/district. | End users |
| 3 | **Search over menus** | Search by dish name, description, or restaurant name so results include menu content. | End users |
| 4 | **Admin: restaurant CRUD** | Create and edit restaurants (name, address, city, district, cuisine, veg, halal, price level, location). Delete is declared but not implemented. | Admin |
| 5 | **Admin: menu CRUD** | Create, edit, and delete menus and menu items per restaurant. | Admin |
| 6 | **Auth for end users** | Optional login for end users (e.g. for favourites). Register/login exist in API but no frontend. | End users |
| 7 | **Favourites (optional)** | Save favourite restaurants or menus when logged in. | End users |
| 8 | **Sri Lanka reference data** | List of districts/cities for filters and validation (e.g. dropdowns). Can be static or DB-backed. | End users, Admin |

---

## 2. Data model additions (backend)

Required for the above; not present in current Prisma schema:

| Model | Purpose |
|-------|---------|
| **menus** | One per restaurant (or one “active” menu per restaurant). Fields: e.g. `id`, `restaurant_id`, `name`, `is_active`, `created_at`, `updated_at`. |
| **menu_sections** (or categories) | Group items (e.g. “Starters”, “Main”, “Drinks”). Fields: e.g. `id`, `menu_id`, `name`, `sort_order`. |
| **menu_items** | Individual dishes. Fields: e.g. `id`, `menu_section_id` (or `menu_id`), `name`, `description`, `price`, `currency`, `veg`, `sort_order`, `created_at`, `updated_at`. |
| **favourites** (optional) | If supporting favourites: e.g. `user_id`, `restaurant_id` (and/or `menu_id`), `created_at`. |

Ensure `restaurants.geom` is populated for “near me” (PostGIS geography). No new table required for reference data if using a static list of Sri Lankan districts/cities.

---

## 3. Backend endpoints required

### 3.1 Fixes to existing endpoints

| Method | Path | Issue | Required change |
|--------|------|--------|------------------|
| DELETE | `DELETE /restaurants/:id` | Does not delete; returns message only | Call `RestaurantsService.delete(id)` and return 204 (or 200 + body). |

---

### 3.2 Restaurants (new or extended)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `POST /restaurants` | Admin | Create restaurant (body: name, city, district, address, cuisine_tags, price_level, veg_friendly, halal_certified, optional lat/lng for geom). |
| PATCH | `PATCH /restaurants/:id` | Admin | Update restaurant (same fields as create, partial). |
| GET | `GET /restaurants` | Public | **Extend** query: add optional `lat`, `lng`, `radius_km` (or `radius_m`) to filter by distance (use `restaurants.geom`). Return distance when lat/lng provided. |

Existing: `GET /restaurants` (search/filter), `GET /restaurants/:id` are present. `DELETE /restaurants/:id` needs the fix above.

---

### 3.3 Menus (new module)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `GET /restaurants/:restaurantId/menus` | Public | List menus for a restaurant (e.g. active only or all). |
| GET | `GET /menus/:id` or `GET /restaurants/:restaurantId/menus/:id` | Public | Get one menu with sections and items (nested). |
| POST | `POST /restaurants/:restaurantId/menus` | Admin | Create menu for restaurant. |
| PATCH | `PATCH /menus/:id` | Admin | Update menu (e.g. name, is_active). |
| DELETE | `DELETE /menus/:id` | Admin | Delete menu (and cascade sections/items or soft-delete). |

---

### 3.4 Menu sections (optional structure)

If menus have sections/categories:

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | (included in `GET /menus/:id`) | — | Sections returned nested in menu. |
| POST | `POST /menus/:menuId/sections` | Admin | Create section (name, sort_order). |
| PATCH | `PATCH /menus/:menuId/sections/:id` | Admin | Update section. |
| DELETE | `DELETE /menus/:menuId/sections/:id` | Admin | Delete section (cascade items or forbid if has items). |

---

### 3.5 Menu items (new)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | (included in `GET /menus/:id`) | — | Items returned nested in menu (by section). |
| POST | `POST /menus/:menuId/items` or `POST /menus/:menuId/sections/:sectionId/items` | Admin | Create menu item (name, description, price, currency, veg, sort_order). |
| PATCH | `PATCH /menus/:menuId/items/:id` | Admin | Update menu item. |
| DELETE | `DELETE /menus/:menuId/items/:id` | Admin | Delete menu item. |

---

### 3.6 Search (extended)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `GET /restaurants` | Public | **Extend** existing search: when menu data exists, support e.g. `q` to search in restaurant name/city/district **and** in menu item names/descriptions (join menus → menu_items). |
| GET | `GET /search` (optional) | Public | Alternative: single “search” endpoint that returns restaurants and/or menu items matching query and filters (location, cuisine, etc.). |

Either extend `GET /restaurants` or add `GET /search`; avoid duplicate behaviour.

---

### 3.7 Location (new or extended)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `GET /restaurants?lat=&lng=&radius_km=` | Public | **Extend** `GET /restaurants`: accept `lat`, `lng`, `radius_km` (or `radius_m`), filter by distance using `restaurants.geom`, order by distance. Sri Lanka only (optional: reject or clamp out-of-Sri-Lanka coordinates). |

Can be part of existing `GET /restaurants` as extra query params.

---

### 3.8 Reference data (Sri Lanka)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `GET /districts` or `GET /locations/districts` | Public | List Sri Lankan districts (for filters/dropdowns). Can be static JSON or DB table. |
| GET | `GET /cities` or `GET /locations/cities` | Public | Optional: list cities (or cities by district). |

---

### 3.9 Auth (existing + optional)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `POST /auth/register` | Public | Exists. | 
| POST | `POST /auth/login` | Public | Exists. |
| GET | `GET /auth/me` (optional) | User | Return current user (id, email, name, role). Useful for frontend auth state. |

---

### 3.10 Favourites (optional)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `GET /users/me/favourites` or `GET /favourites` | User | List user’s favourite restaurants (and optionally menus). |
| POST | `POST /restaurants/:id/favourite` or `POST /favourites` | User | Add favourite (body: `restaurant_id` or `menu_id`). |
| DELETE | `DELETE /restaurants/:id/favourite` or `DELETE /favourites/:id` | User | Remove favourite. |

---

## 4. Summary checklist

**Must-have for purpose (menus + location + search, Sri Lanka):**

- [ ] Data model: **menus**, **menu_sections** (optional), **menu_items**
- [ ] **GET** restaurant’s menus (list + one with items)
- [ ] **POST/PATCH/DELETE** menus and menu items (admin)
- [ ] **POST/PATCH** restaurants (admin); **fix DELETE** restaurants
- [ ] **GET /restaurants** extended with **location** (lat, lng, radius) using `geom`
- [ ] **Search** extended to menu content (dish name/description) or new `GET /search`
- [ ] **GET /districts** (and optionally cities) for Sri Lanka

**Nice-to-have:**

- [ ] **GET /auth/me**
- [ ] **Favourites** (model + endpoints)
- [ ] Stricter validation, error handling, health check (see ARCHITECTURE.md)

This list is the set of **missing features and backend endpoints** required to complete the platform as described in the architecture doc.
