# Phase 6 — Auth for end users: implementation guide

**Goal (from roadmap):** Optional login for end users; foundation for favourites and personalized features. End users and admins can log in on web and mobile; the API knows the current user.

**Current state:**

- **API:** `POST /auth/register`, `POST /auth/login` (return `accessToken` + `user: { id, email, role }`), `POST /auth/logout` (JWT). No `GET /auth/me`. JWT payload has `sub`, `role`, `jti`; optional Redis sessions.
- **Web:** Admin-only auth: `/admin/login`, `localStorage.adminToken`, request interceptor sends `Authorization`, 401 redirects to `/admin/login` only for admin paths. No public login/register.
- **Mobile:** No auth: single API client, no token storage or `Authorization` header.

---

## Tasks in order

### 6.1 — API: `GET /auth/me`

**Scope:** API only.

- Add a **GET** route on `AuthController`: `GET /auth/me`.
- Protect with `JwtAuthGuard`.
- In the handler, use `req.user` (from `JwtStrategy`: `userId`, `role`, `jti`). Load the user from the DB by `userId` (e.g. `prisma.users.findUnique({ where: { id: req.user.userId } })`), select only safe fields: `id`, `email`, `name`, `role`. If user not found (deleted after token issued), return 401.
- Return JSON: `{ id, email, name, role }` (no password, no internal fields).
- Add a minimal **AuthService** method if desired, e.g. `getMe(userId: number)` that returns the user or null, and have the controller return 401 when null.

**Why in order:** Everything else (web/mobile UIs and “current user” state) depends on this endpoint.

---

### 6.2 — Web: login / register UI and token usage

**Scope:** Web app (`apps/web`).

1. **Token storage and API client**
   - Decide token strategy:
     - **Option A (recommended):** Use one token for both admin and end users. Rename or generalize from `adminToken` to something like `authToken` (or keep `adminToken` but use it for all auth). Send this token on **all** API requests when present (you already do for admin). On 401, clear the token; redirect to login only when the user is on a route that requires auth (e.g. admin routes → admin login; optional future “account” route → public login).
     - **Option B:** Keep `adminToken` for admin; add a separate `userToken` for end users. Then the request interceptor must attach the correct token (e.g. for `/admin/*` use adminToken, for other authed calls use userToken). More complexity; only needed if you want strict separation.
   - Ensure the existing interceptor sends `Authorization: Bearer <token>` for **all** requests when a token exists (already true if you use one key), and on 401 clears that token and, if on an admin path, redirects to `/admin/login`. For Phase 6, end-user pages (login/register) do not require a token; only “account” or future protected pages would.

2. **Public login and register pages**
   - Add **`/login`** and **`/register`** (e.g. `apps/web/src/app/login/page.tsx`, `apps/web/src/app/register/page.tsx`).
   - **Login:** Form (email, password) → `POST /auth/login` → store token (e.g. `setAdminToken` or new `setAuthToken`) and optionally user snippet; redirect to home or a “profile”/“account” page. Show API error (e.g. “Invalid credentials”).
   - **Register:** Form (email, password, name optional) → `POST /auth/register` → same as login (store token, redirect). Show API errors (e.g. “Email already registered”).
   - Do **not** restrict by role on these pages (unlike admin login); any user can log in. Admin users can use the same login and then navigate to `/admin` if they have the role.

3. **Links to login/register**
   - Add “Log in” / “Sign up” (or “Register”) links on the public site (e.g. header or home) that point to `/login` and `/register`. If the user is already logged in (you can check by having a token and optionally calling `GET /auth/me`), show “Account” or “Log out” instead (see 6.4).

**Why this order:** 6.1 is done first so the web app can call `GET /auth/me` once you add “current user” state. Then 6.2 gives end users a way to log in and have their token sent on every request.

---

### 6.3 — Mobile: login / register UI and token usage

**Scope:** Mobile app (`apps/mobile`).

1. **Token storage**
   - Use **secure storage** for the auth token (e.g. `expo-secure-store`). Key name can be `authToken` or `lankamenus_token`. Install the package if not present (e.g. `expo-secure-store`).

2. **API client**
   - Update `apps/mobile/src/lib/api.ts` (or equivalent): on each request, read the token from secure storage and set `Authorization: Bearer <token>`.
   - On 401, clear the token from secure storage and optionally navigate to a login screen (if you have a “requires auth” screen) or just let the user retry.

3. **Login and register screens**
   - Add two screens: **Login** and **Register** (e.g. under `app/(tabs)/` or a separate stack `app/auth/login.tsx`, `app/auth/register.tsx`). Use the same API: `POST /auth/login`, `POST /auth/register`; on success, write the token to secure storage and navigate to the main app (e.g. Home tab).
   - Forms: email, password; register adds optional name. Handle loading and API errors.

4. **Reaching the screens**
   - From Home or Explore, add a way to open “Log in” / “Sign up” (e.g. button or link that navigates to the login screen). Optionally, if you have an “Account” tab or profile screen (6.4), show “Log in” when not authenticated and “Account” when authenticated.

**Why this order:** Same as web: 6.1 exists so mobile can call `GET /auth/me` later; 6.3 gives mobile users login/register and ensures the token is sent on all API calls.

---

### 6.4 — Optional: profile / account screen (web + mobile)

**Scope:** Web and mobile.

- **Web:** Add a page such as `/account` or `/profile`. If no token (or `GET /auth/me` returns 401), redirect to `/login`. Otherwise call `GET /auth/me` and show user info (id, email, name, role). Provide a “Log out” button: call `POST /auth/logout` with the current token, then clear the token and redirect to home or login. Use the same token you use for the rest of the app (e.g. `authToken` / `adminToken`).
- **Mobile:** Add an “Account” (or “Profile”) tab or screen. When opened, if no token, show “Log in” and navigate to login. If token exists, call `GET /auth/me`, show user info, and a “Log out” button that calls `POST /auth/logout`, clears the token from secure storage, and navigates back to Home or Login.

**Why last:** Depends on 6.1 (GET /auth/me), 6.2 (web token + login), and 6.3 (mobile token + login). It completes “show user info; logout” as in the roadmap.

---

## Summary table

| Order | Task | Scope | Delivers |
|-------|------|--------|----------|
| 6.1 | `GET /auth/me` | API | Current user (id, email, name, role) for any valid JWT. |
| 6.2 | Web login/register + token on requests | Web | End users can sign up and sign in; token sent on all API calls; links to login/register. |
| 6.3 | Mobile login/register + secure token + Authorization | Mobile | Same for mobile; secure storage; API client sends Bearer token. |
| 6.4 | Profile/account screen + logout | Web + Mobile | Show user info and logout using `GET /auth/me` and `POST /auth/logout`. |

---

## Exit criteria (from roadmap)

- End users and admins can log in on web and mobile.
- API knows the current user (via JWT and optional `GET /auth/me`).

---

## Notes

- **Single auth flow:** The same `POST /auth/login` and `POST /auth/register` serve both admins and end users. Admin login page can keep its role check and redirect to `/admin/restaurants`; public login/register do not restrict by role.
- **Login/register response:** Today the API returns `user: { id, email, role }` (no `name`). You can add `name` to that response for consistency with `GET /auth/me`; otherwise the frontend can rely on `GET /auth/me` for full profile (id, email, name, role) after login.
- **CORS:** Ensure the API allows the web origin and (if needed) the mobile app’s origin so browser and app can call auth and me.
