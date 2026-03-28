# Restaurant ranking (API)

## Overview

`GET /restaurants` supports `sort=top_rated|popular|trending` (plus existing `relevance`, `rating`, `price`, `distance`). Sorting uses **PostgreSQL** (`ORDER BY` + offset pagination) with **generated** score columns on `restaurants` for popular and trending.

## Formulas (DB)

| Mode       | Formula |
|------------|---------|
| `top_rated` | `ORDER BY rating DESC NULLS LAST` |
| `popular`   | `popular_score` = `rating * ln(rating_count + 1)` (GENERATED) |
| `trending`  | `trending_score` = `view_count*0.4 + favorite_count*0.4 + rating*rating_count*0.2` (GENERATED) |

## Counters

- `rating_count`, `view_count`: mutable columns; seed with `pnpm run simulate:ranking:dev` (non-production only).
- `favorite_count`: denormalized; updated in `FavouritesService` add/remove; resynced by the simulate script.

## Redis

List cache keys include `sort`. TTLs: `popular` / `top_rated` / `rating` → 5 min; `trending` → 2 min (see `cache-keys.ts`). Favourites changes invalidate `restaurants:list:*`.

## Future

- Increment `view_count` on restaurant detail views.
- Replace or augment `trending_score` with click/CTR signals.
- Per-user personalization via separate read path or feature flags.
