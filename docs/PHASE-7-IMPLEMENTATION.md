# Phase 7 — Optional enhancements: implementation guide

**Goal (from roadmap):** Favourites and UX polish. Favourites work; Explore is useful; branding and env-based API URLs in place.

**Current state:**

- **API:** Auth provides `req.user.userId` (from JWT). No favourites table or endpoints. Restaurants and menus APIs exist.
- **Web:** Restaurant list (`/`), restaurant detail (`/restaurants/[id]`), login/register/account. Metadata in `layout.tsx` is still "Create Next App". API base URL hardcoded in `apps/web/src/lib/api.ts` as `http://localhost:3001`.
- **Mobile:** Home (search/filters), Explore (template placeholder with collapsibles and docs links), Account tab, restaurant details. API base URL hardcoded in `apps/mobile/src/lib/api.ts` as `http://10.0.2.2:3001`.

---

## Tasks in order

### 7.1 — Favourites model + APIs (API)

**Scope:** API only.

1. **Prisma schema**
   - Add model `favourites` with at least: `user_id` (Int, FK to `users.id`, `onDelete: Cascade`), `restaurant_id` (Int, FK to `restaurants.id`, `onDelete: Cascade`). Add a unique constraint on `(user_id, restaurant_id)` so a user cannot favourite the same restaurant twice.
   - Add relation from `users` to `favourites` and from `restaurants` to `favourites` if you want to query both ways.
   - Run migration.

2. **Favourites module**
   - Create a **FavouritesModule** (e.g. `services/api/src/favourites/`) with:
     - **FavouritesService**: `findAllByUserId(userId)`, `add(userId, restaurantId)`, `remove(userId, restaurantId)`. Use Prisma to read/create/delete from `favourites`. Validate that `restaurant_id` exists (e.g. `restaurants.findUnique`) before adding; return 404 if restaurant not found. On duplicate (unique constraint), either treat as success or return 409; recommend treating as idempotent success (204 or 200).
     - **FavouritesController** (or nest under a "users" resource): Expose:
       - `GET /users/me/favourites` — protected by `JwtAuthGuard`; use `req.user.userId`; return list of favourite restaurant ids and optionally full restaurant records (by joining with `restaurants` or calling RestaurantsService). Response shape: e.g. `{ data: { restaurantIds: number[] } }` or `{ data: Restaurant[] }` for direct use in "My favourites" UI.
       - `POST /users/me/favourites` — body: `{ restaurantId: number }`; protected; add favourite; return 201 or 204. Validate restaurant exists; 404 if not.
       - `DELETE /users/me/favourites/:restaurantId` — protected; remove favourite; 204. Idempotent: if not favourited, still 204.
   - Register module in `AppModule`; ensure PrismaModule is available (import or global).

3. **Auth**
   - All three routes require a valid JWT (no `@Public()`). Use `req.user.userId` from the existing JWT payload. No role check needed for "user" favourites; admins can have favourites too if desired.

4. **Tests**
   - Unit tests for FavouritesService: add, remove, list; duplicate add (idempotent); add for non-existent restaurant (404 or similar). Controller spec: authorised user gets list; add/delete with correct userId.

**Why first:** Favourites UI (7.2) depends on these endpoints.

---

### 7.2 — Web & mobile: favourites UI

**Scope:** Web and mobile.

**Web**

1. **My Favourites page**
   - Add route **`/favourites`** (e.g. `apps/web/src/app/favourites/page.tsx`). Protected: if no token, redirect to `/login`. Call `GET /users/me/favourites`; display list of restaurants (reuse restaurant card/link pattern from home). Each item: link to `/restaurants/[id]`, optional "Remove" button that calls `DELETE /users/me/favourites/:restaurantId` and refreshes the list.
2. **Save / Unsave on restaurant detail**
   - On **`/restaurants/[id]`**: If logged in, show "Save" or "Remove from favourites" (call GET /users/me/favourites once to know state, or include `isFavourite` in a combined endpoint). "Save" → `POST /users/me/favourites` with `{ restaurantId: id }`; "Remove" → `DELETE /users/me/favourites/:id`. If not logged in, show "Log in to save favourites" or hide the control.
3. **Home / nav**
   - When logged in, add a link to "My favourites" (e.g. in nav or on home) pointing to `/favourites`.

**Mobile**

1. **Favourites in app structure**
   - Either add a **Favourites** tab, or a "My favourites" section/screen reachable from Account or Home. Simpler: add a "Favourites" tab that lists saved restaurants (same as web: call `GET /users/me/favourites`; if not logged in, show "Log in to see favourites" with link to login).
2. **Save / Unsave on restaurant details**
   - On the restaurant details screen (`app/(tabs)/details.tsx` or equivalent): if logged in, show heart/star or "Save" / "Remove from favourites"; call POST/DELETE as above. If not logged in, show "Log in to save" or hide.
3. **Optional**
   - On Home list, show a heart icon or indicator for restaurants that are in the user's favourites (requires either including favourite ids in list response or fetching favourites and matching client-side).

**Why after 7.1:** Requires working favourites API.

---

### 7.3 — Mobile: repurpose Explore tab

**Scope:** Mobile only.

- Replace the current **Explore** tab content (template with "File-based routing", "Android, iOS, and web support", etc.) with something useful for Lankamenus.
- Options (pick one or combine):
  - **By district:** List of districts (reuse `GET /districts`); tapping a district navigates to Home with that district pre-selected or opens a list of restaurants in that district (reuse search with `district` param).
  - **Featured:** List of restaurants (e.g. "Featured" could be a subset from `GET /restaurants` with a limit, or a future `featured` flag; for now can be "Recent" or first N from default search).
  - **Categories / cuisines:** List of cuisine tags (e.g. from a static list or aggregated from restaurants); tapping filters by cuisine (Home or a restaurant list with `cuisine` param).
- Implementation: Replace `app/(tabs)/explore.tsx` content with the chosen UX; reuse existing API (`/districts`, `/restaurants`) and navigation (e.g. `router.push` to home with params, or a shared restaurant list component). Keep the tab label "Explore".

**Why this order:** Independent of favourites; can be done in parallel with 7.2, but 7.2 is higher value so listed first. Doing 7.3 after 7.2 keeps the task list clear.

---

### 7.4 — Web: metadata & branding

**Scope:** Web only.

- In **`apps/web/src/app/layout.tsx`** (root layout):
  - Update `metadata` (or generate it): set **title** to something like `Lankamenus` (or "Lankamenus – Restaurant menus in Sri Lanka").
  - Set **description** to a short app description (e.g. "Discover restaurant menus across Sri Lanka. Search by dish, location, and more.").
  - Add **openGraph** (and optionally **twitter**) metadata so shared links show the right title, description, and image (e.g. `openGraph: { title, description, url, siteName: 'Lankamenus' }`). Add a default OG image under `public/` if needed (e.g. `public/og.png`) and reference it in metadata.
- Remove any remaining "Create Next App" or boilerplate text from the default layout or pages (already largely done if home is custom; double-check layout and any placeholder pages).
- Optional: add a favicon that matches branding (e.g. replace `favicon.ico` in `app/` or `public/`).

**Why this order:** Independent; can be done anytime. Placed after Explore so "content" tasks are done first.

---

### 7.5 — API base URL from env (Web + Mobile)

**Scope:** Web and mobile; document for prod.

1. **Web**
   - In **`apps/web`**: Use **`NEXT_PUBLIC_API_URL`** for the API base URL (Next.js exposes only `NEXT_PUBLIC_*` to the browser). In `apps/web/src/lib/api.ts`, set `baseURL` to `process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'` (or similar) so local dev works without env set.
   - Add to **`.env.local.example`** or README: `NEXT_PUBLIC_API_URL=http://localhost:3001` (dev) and note production URL for deploy.

2. **Mobile**
   - In **`apps/mobile`**: Use **`EXPO_PUBLIC_API_URL`** (Expo’s convention for client-visible env). In `apps/mobile/src/lib/api.ts`, set `baseURL` to `process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:3001'` (or a default that works for Android emulator; iOS simulator often uses `localhost` or `127.0.0.1`). Document in README or `.env.example`: for dev, `EXPO_PUBLIC_API_URL=http://10.0.2.2:3001` (Android) or `http://localhost:3001` (iOS simulator), and for production set to the deployed API URL.

3. **Docs**
   - In **`docs/`** or deployment doc: list `NEXT_PUBLIC_API_URL` and `EXPO_PUBLIC_API_URL` with examples for dev and prod so deployers know what to set.

**Why last:** Unblocks production deploy; other Phase 7 features work with hardcoded URLs. Doing it after 7.4 keeps branding and config together as "polish."

---

## Summary table

| Order | Task | Scope | Delivers |
|-------|------|--------|----------|
| 7.1 | Favourites model + APIs | API | Table `favourites`; `GET/POST/DELETE /users/me/favourites`; JWT-protected. |
| 7.2 | Favourites UI | Web + Mobile | "My favourites" list; Save/Remove on restaurant detail; link from nav/home. |
| 7.3 | Repurpose Explore tab | Mobile | Explore shows e.g. By district / Featured / Cuisines instead of template. |
| 7.4 | Web metadata & branding | Web | Lankamenus title, description, OG tags; remove Create Next App defaults. |
| 7.5 | API base URL from env | Web + Mobile | `NEXT_PUBLIC_API_URL`, `EXPO_PUBLIC_API_URL`; documented. |

---

## Exit criteria (from roadmap)

- Favourites work (save/remove, list on web and mobile).
- Explore is useful (district/featured/cuisine or similar).
- Branding and env-based API URLs in place.

---

## Notes

- **7.1 route shape:** The roadmap suggests `GET /users/me/favourites` and POST/DELETE favourite. You can use a **UsersModule** with a controller prefix `users` and a child controller or route group for `me/favourites` (e.g. `GET me/favourites`, `POST me/favourites`, `DELETE me/favourites/:restaurantId`). Ensure `me` is not a literal path segment for "current user" — the current user is inferred from JWT; the resource is "current user's favourites."
- **Optional:** In 7.1, return full restaurant objects in `GET /users/me/favourites` so the client does not need a second request per restaurant; or return ids and let the client fetch; the former is better for "My favourites" list UX.
- **Explore (7.3):** If you use "By district," reuse `GET /districts` and existing restaurant search with `district`; no new API required.
