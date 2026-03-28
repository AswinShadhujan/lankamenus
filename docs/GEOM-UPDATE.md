# Updating `restaurants.geom` (PostGIS)

The `restaurants` table has a PostGIS `geography` column `geom` used for “near me” search. Prisma does not support this type in normal `create`/`update`, so geom must be set via **raw SQL**.

---

## Formula

From latitude and longitude (WGS84):

```sql
ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
```

- **Order:** `ST_MakePoint(longitude, latitude)` — lng first, then lat.
- **SRID 4326** is WGS 84 (standard GPS coordinates).

---

## Single update (by id)

```sql
UPDATE restaurants
SET geom = ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography
WHERE id = :id;
```

Example for restaurant id `1` at Colombo (6.9271, 79.8612):

```sql
UPDATE restaurants
SET geom = ST_SetSRID(ST_MakePoint(79.8612, 6.9271), 4326)::geography
WHERE id = 1;
```

---

## Using Prisma in the API

When implementing admin create/update (e.g. Phase 3), use parameterized raw SQL:

```ts
import { Prisma } from '@prisma/client';

// After creating or updating a restaurant by id:
await this.prisma.$executeRaw`
  UPDATE restaurants
  SET geom = ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
  WHERE id = ${restaurantId}
`;
```

Omit this call when lat/lng are not provided (geom remains null).

---

## Backfill script

A one-off script can update existing rows when you have id and lat/lng (e.g. from a CSV or manual list).

- **Single row:** from `services/api` run:
  ```bash
  npx ts-node -r dotenv/config scripts/backfill-restaurant-geom.ts <id> <lat> <lng>
  ```
- **Bulk:** use the same SQL in a loop over your data, or adapt the script to read a JSON/CSV file (e.g. `[{ "id": 1, "lat": 6.9271, "lng": 79.8612 }, ...]`).

Ensure `.env` (or `dotenv`) sets `DATABASE_URL` when running the script.

---

## Phase 3

The admin `POST /restaurants` and `PATCH /restaurants/:id` endpoints (Phase 3) should accept optional `lat` and `lng`. When present, run the raw `UPDATE` above after the normal create/update so that `geom` is set for “near me” search.
