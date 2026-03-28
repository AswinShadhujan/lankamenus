# Google SSO Implementation — Code Review

## 1. Security

### ✅ In place
- **Token verification**: Google ID token is verified server-side with `google-auth-library` (signature, expiration, audience `GOOGLE_CLIENT_ID`, `email_verified === true`). No trust of client-supplied identity without verification.
- **ValidationPipe**: Global `whitelist: true` and `forbidNonWhitelisted: true` prevent mass assignment; only `idToken` is accepted on `POST /auth/google`.
- **Rate limiting**: `ThrottlerGuard` is applied globally, so `POST /auth/google` is rate-limited with other auth endpoints.
- **JWT**: Our own JWTs are signed with `JWT_SECRET`; Google tokens are never used as session tokens.
- **CORS**: Configured with explicit origins and credentials.

### ⚠️ Addressed in follow-up
- **Race condition**: Two concurrent requests with the same Google token (e.g. link to existing email) can both pass `findUnique(byEmail)` and then both call `auth_providers.create`; the second hits unique constraint `(provider, provider_id)`. Without handling, this returns 500. **Fix**: Catch `P2002` on `auth_providers.create`, re-fetch by provider, and return token (idempotent link).
- **avatar_url length**: Google picture URLs can be very long (e.g. with tokens). Storing unbounded strings can be abused. **Fix**: Cap stored `avatar_url` length (e.g. 2048) when saving from Google payload.

### ℹ️ Optional hardening
- **idToken trim**: Leading/trailing whitespace could be stripped in DTO so accidental spaces don’t cause “invalid token” (validation already rejects empty with `IsNotEmpty`).

---

## 2. Validation

### ✅ In place
- **GoogleAuthDto**: `idToken` is `@IsString()`, `@IsNotEmpty()`, `@MaxLength(5000)`.
- **Email/password**: Existing `RegisterDto` / `LoginDto` unchanged (email format, password length, etc.).

### ⚠️ Addressed
- **Trim**: Add `@Transform((v) => v?.trim())` (or equivalent) for `idToken` so whitespace-only is normalized and can fail with a clear “invalid token” after trim.

### ℹ️ Not required
- **Email from token**: Email is taken from the verified Google payload, not from the client; no extra email format validation needed for the Google flow.
- **IsJWT()**: Not used for `idToken`; Google ID tokens are JWTs but length + server verification are sufficient.

---

## 3. Error handling

### ✅ In place
- **GoogleAuthService**: Invalid/expired/wrong-audience/unverified-email → `UnauthorizedException` with generic message; internal errors rethrown as `UnauthorizedException('Invalid or expired Google token')` without leaking details.
- **AuthService.login**: User not found / wrong password / no password → `UnauthorizedException` with appropriate messages.
- **Controller**: Google not configured → `BadRequestException('Google Sign-In is not configured')`.
- **Frontend**: API error message shown (e.g. “Invalid or expired Google token”); no secrets exposed.

### ⚠️ Addressed
- **P2002 on provider create**: When linking Google to existing user, duplicate `(provider, provider_id)` (e.g. race) was unhandled → 500. **Fix**: Catch `PrismaClientKnownRequestError` with `code === 'P2002'`, re-fetch `AuthProvider` by `(google, google_id)`, and return token.

### ℹ️ Optional
- **User creation P2002**: New-user path runs in a transaction; if email is taken (e.g. race with another provider), Prisma throws. Could catch P2002 and retry “find by email → link provider” for a single consistent message.

---

## 4. Missing tests

### ✅ Added
- **GoogleAuthService**: Unit tests for `verifyIdToken` — success, not configured, invalid/expired token, missing email/sub, email not verified; and for `isConfigured`.
- **AuthController**: Tests for `POST /auth/google` — success (returns token + user), Google not configured (400), and delegation to `AuthService.googleLogin`.
- **AuthService**: Tests for `googleLogin` — existing provider (login), link to existing email (link + token), new user creation, and P2002 on link (re-fetch and issue token).

### Before
- No `google-auth.service.spec.ts`.
- No controller tests for `POST /auth/google`.
- No AuthService tests for `googleLogin` or provider-linking / P2002.

---

## 5. Summary of code changes

| Area              | Change |
|-------------------|--------|
| AuthService       | Handle P2002 when creating Google provider (re-fetch by provider, issue token). Cap `avatar_url` length when storing from Google (e.g. 2048). |
| GoogleAuthDto     | Trim `idToken` (e.g. `@Transform`). |
| GoogleAuthService | Unit tests. |
| AuthController    | Unit tests for `POST /auth/google`. |
| AuthService       | Unit tests for `googleLogin` (existing provider, link, new user, P2002). |

---

## 6. Future providers

- New providers (Apple, Facebook, GitHub) only need a verification service (e.g. `AppleAuthService`) that returns a normalized payload (e.g. `email`, `provider_id`, `name`, `picture`) and the same controller pattern: verify → find/link/create user → issue JWT. Provider table and `googleLogin`-style flow already support this.
