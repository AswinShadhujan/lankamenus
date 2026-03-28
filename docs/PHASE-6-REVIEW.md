# Phase 6 — Auth for end users: review

Review of the Phase 6 implementation for security, validation, error handling, and tests.

---

## 1. Security

### Fixed during review

- **Login/register must be public:** The API uses a **global** `JwtAuthGuard`. Without `@Public()`, `POST /auth/login` and `POST /auth/register` would require a valid JWT, so unauthenticated users could not log in or register. **Fix applied:** `@Public()` was added to both `register` and `login` in `AuthController`.

### Already in good shape

- **JWT:** Secret from env, 15m expiry; no hardcoded secrets.
- **Passwords:** Hashed with bcrypt (10 rounds) before storage; never returned in API responses.
- **GET /auth/me:** Protected by `JwtAuthGuard`; returns only `id`, `email`, `name`, `role` (no password or internal fields).
- **POST /auth/logout:** Protected; uses `jti` to revoke session in Redis when configured.
- **Session revocation:** When Redis is configured, logout deletes the session so the token cannot be reused.
- **Roles:** `RolesGuard` only applies where `@Roles()` is used; auth routes do not require a role, so any authenticated user can call `GET /auth/me` and `POST /auth/logout`.

### Recommendations (later phases)

- **Rate limiting:** No brute-force protection on login/register (planned in Phase 8 with `@nestjs/throttler`).
- **CORS:** Currently allows specific origins; tighten for production and document.
- **HTTPS:** Enforce in production; document in deployment docs.

---

## 2. Validation

### API (server)

- **LoginDto:** `@IsEmail()`, `@MaxLength(255)` on email; `@IsString()`, `@MinLength(8)`, `@MaxLength(128)` on password. ValidationPipe has `whitelist: true`, `forbidNonWhitelisted: true`.
- **RegisterDto:** Same email/password rules; `name` is `@IsOptional()`, `@IsString()`, `@MaxLength(100)`.
- **GET /auth/me:** No body; `userId` comes from JWT payload (numeric), so no extra input validation needed beyond the guard.
- **POST /auth/logout:** No body; no validation needed.

### Gaps / optional improvements

- **Name trimming:** Service uses `name` as-is; optional improvement: `@Trim()` on `RegisterDto` or trim in service to avoid leading/trailing spaces. Low risk.
- **Email normalization:** No lowercasing; Prisma uniqueness is case-sensitive. Could add `@IsEmail()` and normalize to lowercase in service if desired for consistency.

---

## 3. Error handling

### API

- **AuthService:** `register` throws `ConflictException` on P2002 (email exists); `login` throws `UnauthorizedException` on invalid credentials; `getMe` returns `null` (controller maps to 401); `logout` never throws (Redis errors swallowed, returns `{ ok: true }`).
- **AuthController:** `me()` returns 401 when `userId` is missing or `getMe()` returns null; `logout()` always returns `{ ok: true }`.
- **Validation:** ValidationPipe returns 400 with message array for invalid DTOs.

### Web

- **Login/register:** API error message extracted from `response.data.message` (string or array); fallback message shown. Loading and disabled submit during request.
- **Account:** **Fix applied:** On any `GET /auth/me` failure (401 or other), token is cleared and user is redirected to `/login`, so the “Redirecting to login…” state is not stuck.

### Mobile

- **Login/register:** Same pattern: extract message, show fallback, loading state.
- **Account:** On `GET /auth/me` failure in `useFocusEffect`, `user` is set to null and “Log in” / “Sign up” is shown; no infinite loading.

---

## 4. Missing tests

### Existing

- **AuthService** (`auth.service.spec.ts`): register (success, conflict), login (not found, wrong password, success, cache session), **getMe** (user exists, user not found), logout (no jti, cache not configured, success with cache).
- **JwtStrategy** (`jwt.strategy.spec.ts`): validate with/without cache, session present/missing, no jti.

### Added in this review

- **AuthController** (`auth.controller.spec.ts`): 
  - `GET /auth/me`: returns user when JWT valid and user exists; 401 when no user in request; 401 when getMe returns null.
  - `POST /auth/logout`: returns `{ ok: true }` and calls logout with jti.
  - Login and register are not exercised in controller spec (they are integration-style; service tests already cover behavior); the important addition is coverage for `me` and `logout`.

### Optional (later)

- E2E: full flow (register → login → GET /auth/me → logout) against real API.
- Web/Mobile: component or integration tests for login/register/account (e.g. form validation, error display).

---

## 5. Summary

| Area            | Status | Notes |
|-----------------|--------|--------|
| Security        | OK     | `@Public()` added for login/register; JWT, bcrypt, session revocation in place. Rate limiting deferred to Phase 8. |
| Validation       | OK     | DTOs validated; optional trim/normalize for name/email. |
| Error handling  | OK     | API and clients handle 401/409/400; web account redirects on any /auth/me failure. |
| Tests           | OK     | AuthService and JwtStrategy covered; AuthController spec added for `me` and `logout`. |

Phase 6 implementation is in good shape for security, validation, error handling, and test coverage after the applied fixes and the new controller tests.
