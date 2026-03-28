# Restaurant listing pagination

## Analysis (prior state)

| Area | Before |
|------|--------|
| **Endpoint** | `GET /restaurants` |
| **Query params** | `page`, `pagesize` (default 20, max **100**), plus filters `q`, `district`, `cuisine`, `lat`/`lng`/`radius_km`, etc. |
| **Prisma** | `skip` / `take` for normal list; **full `findMany` without skip/take** when Meilisearch or geo sort needed, then slice in memory. |
| **Response** | `{ page, pagesize, total, data }` |

### Issues

1. **Naming**: `pagesize` is nonstandard vs common `limit`.
2. **Large page sizes**: Max 100 allowed very large offset queries.
3. **Ordering**: Default sort was `name_default` asc; product often wants recency (`created_at`).
4. **Meilisearch path**: Loads all matching rows then paginates in memory (acceptable for bounded Meili hit lists; cursor pagination is a future improvement).

## Current API (backward compatible)

- **Query**: `page` (default `1`), **`limit`** (preferred) or legacy **`pagesize`** (default `20`, max **`50`**). If both are sent, **`limit` wins**.
- **Response**:
  ```json
  {
    "page": 1,
    "pagesize": 20,
    "total": 1234,
    "data": [ ... ],
    "meta": {
      "total": 1234,
      "page": 1,
      "limit": 20,
      "totalPages": 62
    }
  }
  ```
- Legacy clients can keep using `page`, `pagesize`, `total`, and `data` only.

## Performance

- **Max `limit` / `pagesize`**: 50 (enforced in `RestaurantsService.resolvePageSize`).
- **Default**: 20.
- **Ordering** (DB): `created_at desc` for Prisma-backed queries; geo and Meilisearch flows still apply their own ordering after fetch.

## Frontend (web home)

- **All Restaurants**: infinite scroll via `IntersectionObserver` (sentinel near bottom), appends pages using `page` + `limit`.
- **Discovery rails**: separate request `page=1&limit=50` (API cap).

## Optional next steps

- Cursor-based pagination for very large tables.
- Reduce Meilisearch “fetch all then slice” by pushing offset/limit into search (if Meili supports it for your setup).
