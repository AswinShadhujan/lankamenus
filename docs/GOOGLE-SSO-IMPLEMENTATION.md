# Google SSO implementation – analysis, architecture & plan

## 1. Codebase analysis

### 1.1 Existing Prisma User model

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
- **email**: Unique; used for email/password login and as the main account identifier.
- **password**: Required, bcrypt-hashed; used only for email/password auth.
- **name**: Optional.
- **role**: Default `"user"`; used by RolesGuard for admin routes.
- **favourites**: One-to-many to `favourites`.

There is no OAuth/provider field today.

### 1.2 Current authentication flow

**Email/password**

- **Register**: `POST /auth/register` → bcrypt hash password → `prisma.users.create` → `issueToken(user)` → return `{ accessToken, user }`.
- **Login**: `POST /auth/login` → find user by email → `bcrypt.compare` → `issueToken(user)`.

**JWT issuing**

- Payload: `{ sub: user.id, role: user.role }`, `jti`: random UUID.
- Signed with `JWT_SECRET`, 15m expiry.
- Optional Redis session: key `session:{jti}`, TTL 7 days; JwtStrategy rejects if session missing when Redis is on.

### 1.3 Current auth endpoints

| Method | Path           | Auth  | Description                    |
|--------|----------------|-------|--------------------------------|
| POST   | /auth/register | Public| Create account, return JWT.   |
| POST   | /auth/login    | Public| Email/password, return JWT.    |
| GET    | /auth/me       | JWT   | Current user.                  |
| POST   | /auth/logout   | JWT   | Revoke session (Redis).        |

### 1.4 Auth guards and middleware

- **JwtAuthGuard** (global): Requires valid JWT unless route is `@Public()`.
- **RolesGuard** (global): Enforces `@Roles()` (e.g. admin).
- **JwtStrategy**: Extracts Bearer token, verifies with `JWT_SECRET`, optionally validates session in Redis, sets `req.user = { userId, role, jti }`.

### 1.5 Frontend login and session

- **Web admin** (`/admin/login`): Form → `POST /auth/login` → store `accessToken` in `localStorage['adminToken']` → redirect. API client sends `Authorization: Bearer <token>`; on 401 clears token and redirects to `/admin/login`.
- **Mobile**: Same contract; token stored in SecureStore, sent via API interceptor.

### 1.6 Safest way to add Google SSO

- Keep email/password and JWT contract unchanged.
- Introduce a **provider table** so one user can have multiple sign-in methods (email, google, future apple/facebook).
- Make **password** nullable so Google-only users have no password.
- **Link by email**: If Google returns an email that already exists, attach the Google provider to that user instead of creating a duplicate.
- Reuse **issueToken(user)** for Google so JWT shape and session behaviour stay the same.

---

## 2. Authentication architecture (provider table)

### 2.1 Why a provider table instead of `google_id` on users

| Aspect | `google_id` on users | Provider table (`auth_providers`) |
|--------|----------------------|-----------------------------------|
| Multiple providers | One column per provider (google_id, apple_id, …) | One row per provider; add provider = “apple” etc. |
| Schema changes for new provider | New migration every time | No schema change; new provider = new value in `provider` |
| One user, many sign-in methods | Hard (multiple nullable columns) | Natural: one user, many rows in `auth_providers` |
| Email + Google + Apple | Awkward | Same user_id, multiple rows |
| Future (Apple, Facebook, GitHub) | Repeated migrations | Single model, add verification service only |

**Conclusion**: A dedicated **auth_providers** table is more future-proof and keeps the user table stable when adding new providers.

### 2.2 Target model

- **users**: id, email (unique), password (optional), name, avatar_url, created_at, role; relation to auth_providers and favourites.
- **auth_providers**: id, provider, provider_id, user_id, created_at; unique (provider, provider_id); belongs to user.

One user can have multiple providers (e.g. email + google). Lookup: “find auth_provider where provider = 'google' and provider_id = google_sub” → user; or “find user by email” then attach provider.

---

## 3. Prisma schema update

See Step 3 in the implementation (schema and migration).

---

## 4. Migration plan

1. Add **auth_providers** table (id, provider, provider_id, user_id, created_at; unique(provider, provider_id); FK user_id → users.id).
2. Add **avatar_url** to users (nullable).
3. Alter **users.password** to nullable (existing rows keep value).
4. Backfill: optionally create `auth_providers` for existing users with provider = 'email', provider_id = email (can be done in a script or lazily on next email login).

---

## 5. Backend implementation

- **GoogleAuthService**: Verify Google ID token (signature, expiry, audience, email_verified); extract email, sub (google_id), name, picture; throw on invalid/expired/unverified.
- **AuthService**:  
  - **googleLogin(idToken)**: Verify via GoogleAuthService → provider logic (find by provider+provider_id → else find by email → link or create user) → issueToken(user).  
  - **register**: Create user + AuthProvider(provider='email', provider_id=email).  
  - **login**: Find user by email; if password null, throw “Use Google to sign in”; else bcrypt check; ensure AuthProvider(email, email) exists (create if not); issueToken(user).
- **POST /auth/google**: Body `{ idToken }` → AuthService.googleLogin → return `{ accessToken, user }`.
- Logging: Google login success, new user via Google, existing account linked.
- Errors: 400/401 for invalid token, expired, email not verified, provider mismatch.

---

## 6. Frontend integration

- Use **Google Identity Services** (GIS).
- “Continue with Google” button → GIS returns ID token → `POST /auth/google` with `{ idToken }` → store returned `accessToken` in existing auth storage (adminToken / SecureStore) → redirect/navigate as for email login.
- Reuse existing session handling and API interceptors.

---

## 7. Security considerations

- **Token verification**: Google ID token is verified server-side via `google-auth-library` (signature, expiration, audience = GOOGLE_CLIENT_ID). Reject if `email_verified !== true` or email/sub missing.
- **No client-only trust**: Backend never trusts the client; it always verifies the ID token with Google.
- **JWT_SECRET**: Used only for our own JWTs; Google ID tokens are verified with Google’s keys.
- **Rate limiting**: POST /auth/google is covered by the existing global ThrottlerGuard.
- **Logging**: AuthService logs `[Auth] Google login success`, `[Auth] Existing account linked to Google`, `[Auth] New user created via Google`. GoogleAuthService logs verification failures.

---

## 8. Implemented pieces (reference)

- **Prisma**: `users.password` optional, `users.avatar_url` added; `auth_providers` table with `provider`, `provider_id`, `user_id`; unique `(provider, provider_id)`.
- **Migration**: `20260317000000_add_auth_providers/migration.sql`.
- **Backend**: `GoogleAuthService` (verify ID token, extract email/sub/name/picture), `AuthService.googleLogin` (provider lookup → link or create user → issueToken), `AuthService.register` (create user + email provider), `AuthService.login` (reject if password null; ensure email provider exists). `POST /auth/google` with body `{ idToken }`.
- **Frontend**: Admin login page loads GSI script, shows “Continue with Google” when `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is set; on credential callback sends `idToken` to `POST /auth/google`, then stores JWT and redirects. Email/password form unchanged.
- **Env**: API `GOOGLE_CLIENT_ID` (optional); Next.js `NEXT_PUBLIC_GOOGLE_CLIENT_ID` for the Google button.
