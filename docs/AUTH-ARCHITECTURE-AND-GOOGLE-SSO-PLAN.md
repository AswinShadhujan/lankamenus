# Authentication architecture & Google SSO integration plan

This document describes the current auth setup and a safe way to add Google SSO without breaking existing email/password users.

---

## 1. Current User model (Prisma)

```prisma
model users {
  id          Int          @id @default(autoincrement())
  email       String       @unique
  password    String
  name        String?
  role        String       @default("user")
  created_at  DateTime     @default(now())
  favourites  favourites[]
}
```

- **id**: Primary key.
- **email**: Unique; used as login identifier for email/password.
- **password**: Required; bcrypt-hashed. Used only for email/password login.
- **name**: Optional display name.
- **role**: String, default `"user"`; typical values `"user"` and `"admin"`. Used for authorization (e.g. admin routes).
- **favourites**: One-to-many to `favourites` (restaurant favourites).

There is no OAuth/SSO field (e.g. `google_id`) and no nullable password today.

---

## 2. Email/password login

Yes. It is the only login method today.

- **Register**: `POST /auth/register` with `email`, `password`, optional `name`. Password is bcrypt-hashed (cost 10), user is created, then a JWT is issued and returned.
- **Login**: `POST /auth/login` with `email`, `password`. User is looked up by email; password is verified with `bcrypt.compare`. If valid, a JWT is issued and returned.
- **Validation**: Login DTO requires email (format + max 255) and password (min 8, max 128). Register DTO is the same plus optional name.

---

## 3. Existing auth endpoints

| Method | Path        | Auth   | Description |
|--------|-------------|--------|-------------|
| POST   | /auth/register | Public | Create account (email, password, optional name). Returns `{ accessToken, user }`. |
| POST   | /auth/login    | Public | Email/password login. Returns `{ accessToken, user }`. |
| GET    | /auth/me       | JWT    | Current user (id, email, name, role). |
| POST   | /auth/logout   | JWT    | Revoke current session (when Redis is used). |

All routes live in `services/api/src/auth/auth.controller.ts`. Login and register are marked with `@Public()` so they bypass the global JWT guard.

---

## 4. How JWT authentication is implemented

### 4.1 Issuing tokens (AuthService)

- **Payload**: `{ sub: user.id, role: user.role }`.
- **JWT ID (jti)**: Random UUID per token (session id).
- **Signing**: `JwtService.sign(payload, { jwtid: sessionId })` with `JWT_SECRET`, expiry **15 minutes**.
- **Session store (optional)**: If Redis is configured, a session record is stored under `session:{sessionId}` with TTL 7 days, containing `userId`, `email`, `role`. Used to validate and revoke tokens.

### 4.2 Validating requests (JwtStrategy + JwtAuthGuard)

- **Extraction**: `passport-jwt` reads the token from `Authorization: Bearer <token>`.
- **Verification**: Token is verified with `JWT_SECRET`. Payload must have `sub` (user id).
- **Session check**: If Redis is configured and payload has `jti`, the strategy looks up `session:{jti}`. If the session is missing, `validate()` returns `null` (request is treated as unauthenticated). So logout (delete session) invalidates the token even before it expires.
- **Request user**: After validation, `req.user` is set to `{ userId: payload.sub, role: payload.role, jti: payload.jti }`. Controllers and guards use this.

### 4.3 Global guard and public routes

- **JwtAuthGuard** is registered as a global guard (in `AuthModule`). It runs on every request.
- **@Public()**: Sets metadata so the guard skips JWT checks for that route. Used on login, register, and all non-auth endpoints that must be public (e.g. public GETs).
- **RolesGuard**: Also global; applies role checks when required (e.g. admin-only routes use `@Roles(Role.ADMIN)`).

### 4.4 Response shape for login/register

Both login and register return the same shape:

```ts
{
  accessToken: string;  // JWT
  user: { id: number; email: string; role: string };
}
```

The frontend stores `accessToken` and sends it as `Authorization: Bearer <token>` on subsequent requests.

---

## 5. How frontend login works

### 5.1 Web (admin)

- **Page**: `apps/web/src/app/admin/login/page.tsx`.
- **Flow**: User enters email and password → `POST /auth/login` with `{ email, password }` → on success, `accessToken` is stored in **localStorage** under key `adminToken` via `setAdminToken(data.accessToken)` → redirect to `/admin/restaurants`. If `user.role !== 'admin'`, an “Access denied” message is shown and token is not stored.
- **API client**: `apps/web/src/lib/api.ts` attaches `Authorization: Bearer <token>` from `localStorage.getItem('adminToken')` on every request. On 401, it clears `adminToken` and redirects to `/admin/login` when the path is under `/admin` (except the login page itself).

### 5.2 Mobile (user + admin)

- **Page**: `apps/mobile/app/login.tsx`.
- **Flow**: User enters email and password → `POST /auth/login` with `{ email, password }` → on success, `accessToken` is stored in **expo-secure-store** under key `lankamenus_auth_token` via `setAuthToken(data.accessToken)` → navigate to `/(tabs)`. No role check on login screen; role is enforced per-route or feature (e.g. admin features elsewhere).
- **API client**: `apps/mobile/src/lib/api.ts` loads the token with `getAuthToken()` (async) and sets `Authorization: Bearer <token>` on every request. 401 is handled (e.g. clear token) without forcing a specific redirect.

Both fronts expect the same API contract: login/register return `{ accessToken, user }` and the same JWT is used for `/auth/me`, `/auth/logout`, and protected resources (favourites, admin, etc.).

---

## 6. Safe approach to add Google SSO (without breaking existing users)

### 6.1 Principles

- **Do not break existing email/password users**: Existing users keep `email` + hashed `password` and must still be able to log in with `POST /auth/login`.
- **Same token contract**: Google SSO should result in the same `{ accessToken, user }` and the same JWT shape (`sub`, `role`, `jti`) so all existing protected routes and frontends keep working.
- **Account linking by email**: If a user previously registered with email/password and later signs in with Google using the same email, treat it as the same account (link Google to that user) so they have one user record and one set of favourites.
- **Optional password**: Users who only ever sign in with Google do not need a password; store `password` as nullable and only run bcrypt login when `password` is not null.

### 6.2 Schema changes (Prisma)

- **users.password**: Change from `String` to `String?` (nullable). Existing rows keep their current hash; new Google-only users get `null`.
- **users.google_id**: Add `String?` (nullable, unique). Store Google’s subject id (`sub` from the ID token). Used to find users who signed up with Google and to link Google to an existing account by email.

Migration steps:

1. Add column `google_id String? @unique`.
2. Alter column `password` to be nullable (existing data unchanged).

No change to `email`, `role`, or `favourites`; no new tables required.

### 6.3 New backend endpoint

- **POST /auth/google** (Public).
- **Body**: e.g. `{ idToken: string }` (Google OpenID Connect ID token from the client).
- **Server**:
  1. Verify `idToken` with Google (e.g. using Google Auth Library or a JWT library with Google’s JWKS). Extract `sub` (Google user id), `email`, `email_verified`, optional `name`.
  2. If `email` is missing or not verified, return 400.
  3. Find user by `google_id === sub`. If found → log in (issue token).
  4. Else find user by `email`. If found → optionally update `google_id = sub` (link account), then issue token. If the user has no password, they are effectively Google-only; if they have a password, they can still use email/password or Google.
  5. If no user → create user: `email`, `name` (from Google), `google_id = sub`, `password = null`, `role = 'user'`. Then issue token.
- **Response**: Same as login/register: `{ accessToken, user: { id, email, role } }`. Use the same `issueToken(user)` helper so JWT payload and session store (if any) stay identical.

This keeps a single code path for “get or create user and issue token” and reuses existing session and role behaviour.

### 6.4 Email/password login (unchanged, with one check)

- In `AuthService.login(email, password)`:
  - Load user by `email`.
  - If no user or **user.password is null**, throw Unauthorized (e.g. “Invalid credentials” or “Use Google to sign in”).
  - Otherwise, run `bcrypt.compare(password, user.password)` and, if it fails, throw Unauthorized.
  - On success, call `issueToken(user)` as today.

No change to register: new users still set a hashed password; they can later link Google by signing in with Google (same email).

### 6.5 Frontend (add Google as an option)

- **Web admin**: On `/admin/login`, add a “Sign in with Google” button. Use Google Identity Services (GIS) or OAuth 2.0 to get an ID token, then `POST /auth/google` with `{ idToken }`. On success, store the returned `accessToken` in `adminToken` and redirect as today. Optionally restrict to admin accounts (e.g. only allow if `user.role === 'admin'`) by checking the response and showing “Access denied” otherwise.
- **Mobile**: On the login screen, add “Sign in with Google” (e.g. `expo-auth-session` or `@react-native-google-signin/google-signin`). On success, send the ID token to `POST /auth/google`, then call `setAuthToken(accessToken)` and navigate as today.

No change to how the token is sent or how 401 is handled; only the way the token is obtained (Google vs email/password) changes.

### 6.6 Security and config

- **Validate ID token** on the server (signature, audience, issuer, expiry). Do not trust the client.
- **Env**: e.g. `GOOGLE_OAUTH_CLIENT_ID` (web/mobile client id) for audience check. Optional: separate client ids for web vs mobile if you use different OAuth clients.
- **Admin and Google**: If only some admins should use Google, keep the existing admin role logic; Google sign-in just returns the same `user.role`. You can later add rules like “only these emails can be admin” if needed.

### 6.7 Summary of what stays the same

- User model aside from nullable `password` and new `google_id`.
- All existing auth endpoints and their contracts.
- JWT format, secret, and validation (JwtStrategy, JwtAuthGuard).
- Session store (Redis) and logout behaviour.
- Role-based access (RolesGuard, admin routes).
- Frontend token storage (localStorage for web admin, SecureStore for mobile) and API interceptors.
- Email/password register and login for existing and new email/password users.

This gives a single, backward-compatible auth architecture with email/password and Google SSO, and a clear path to implement Google SSO without breaking existing users.
