# Redis cache layer (API)

The NestJS API (`services/api`) optionally uses **Redis** for HTTP response caching (e.g. `GET /restaurants`, single restaurant rows) and can back sessions. If Redis is not configured, the app runs without caching (database-backed only).

## Connection

Configure **either** a single URL **or** host + port.

### `REDIS_URL` (recommended for production)

- Format: `redis://` or **`rediss://`** (TLS). Include password in the URL when required.
- Examples:
  - Local: `redis://localhost:6379`
  - With password: `redis://:PASSWORD@host:6379`
  - TLS (many managed providers): `rediss://default:PASSWORD@your-instance.provider.com:6380`

When `REDIS_URL` is set and non-empty, it is used as-is by `ioredis`.

### `REDIS_HOST` + `REDIS_PORT` (alternative)

If `REDIS_URL` is unset or empty, the API builds:

`redis://${REDIS_HOST}:${REDIS_PORT}`

(default port **6379**). This path does **not** add TLS; use `REDIS_URL` with `rediss://` for TLS.

## Environment variables

| Variable | Purpose |
|----------|---------|
| `REDIS_URL` | Full connection URL (`redis://` / `rediss://`). |
| `REDIS_HOST` | Host when URL is not used. |
| `REDIS_PORT` | Port when URL is not used (default 6379). |
| `CACHE_TTL_RESTAURANTS_NEARBY` | TTL (seconds) for geo list cache. |
| `CACHE_TTL_RESTAURANTS_LIST` | Default list TTL. |
| `CACHE_TTL_RESTAURANTS_DISCOVERY` | TTL for first-page “discovery” list. |

`CACHE_TTL_RESTAURANTS_*` values are validated with a **maximum of 86400** (24h), aligned with the runtime cap for `restaurants:list:*` keys only.

## Behaviour

- **List TTL cap**: Keys prefixed with `restaurants:list:` have their TTL capped at **24 hours** in `CacheService.set()` so misconfiguration cannot create extremely long-lived list entries. Session keys (`session:*`) and single-entity keys (`restaurant:{id}`, etc.) are **not** subject to this cap.
- **Log redaction**: Cache keys and patterns in logs are **truncated** (length prefix + total length) so full user queries or oversized keys are not written verbatim.
- **`getClient()`**: Exposed for **internal** use (tests, ops). Avoid using it from feature code; misuse can run destructive Redis commands.

## See also

- `services/api/.env.example`
- `services/api/src/cache/cache-keys.ts` — prefixes, defaults, and `MAX_RESTAURANTS_LIST_CACHE_TTL_SECONDS`
