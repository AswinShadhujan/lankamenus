# Phase 5 — Redis sessions (optional)

When **Redis** is configured (`REDIS_URL`), the API uses Redis for **server-side sessions** in addition to JWT. This allows **logout** to revoke a token: the session is stored in Redis and removed on logout, so the same token cannot be used again.

## Env and secrets

| Variable    | Required | Description |
|------------|----------|-------------|
| `REDIS_URL` | No       | Redis connection URL (e.g. `redis://localhost:6379`, or `rediss://` for TLS). When set, sessions are stored in Redis. When unset, JWT is still used but logout does not revoke the token server-side. |
| `JWT_SECRET` | Yes      | Used to sign JWTs. Keep secret in production. |

Session TTL in Redis is **7 days** (see `SESSION_TTL_SECONDS` in `src/cache/cache-keys.ts`). The JWT may have a shorter expiry (e.g. 15m); the Redis key is used only to check “has this session been revoked?”.

## Behaviour

- **Login / Register:** A unique session id (`jti`) is embedded in the JWT and stored in Redis at `session:<jti>` with TTL 7 days. If Redis is not configured, the JWT is issued without a server-side session.
- **Protected routes:** If Redis is configured, the JWT strategy checks that `session:<jti>` exists. If it does not (e.g. user logged out), the request is treated as unauthorized (401).
- **POST /auth/logout:** Requires a valid JWT. Removes `session:<jti>` from Redis so that token cannot be used again. If Redis is not configured, returns `{ ok: true }` without changing anything.

## Deployment

1. Set `REDIS_URL` in production if you want server-side sessions and logout.
2. Ensure Redis is available (e.g. same Redis as used for caching in Phase 5.5).
3. Keep `JWT_SECRET` secret and consistent across instances so JWTs are valid everywhere.
