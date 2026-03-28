# `rating_count` not visible in Prisma Studio / “Prisma dashboard”

In this project, **`rating_count`** is defined on the **`restaurants`** model in `prisma/schema.prisma` (along with `view_count`, `favorite_count`, and generated `popular_score` / `trending_score`).

If you don’t see it, check the following.

## 1. Apply migrations (most common)

The column is created by migration **`20260318000000_restaurant_ranking_fields`**. If that migration was never applied to the database your app (and Studio) use, Prisma Studio may error when opening `restaurants`, or your DB tool won’t show the column.

From **`services/api`** (same `DATABASE_URL` as `.env`):

```bash
pnpm exec prisma migrate status
pnpm exec prisma migrate deploy
pnpm exec prisma generate
```

Then restart Prisma Studio.

## 2. Open Studio from the API package

Prisma reads **`services/api/prisma/schema.prisma`**. Run Studio from **`services/api`** so it uses the right schema and `.env`:

```bash
cd services/api
pnpm prisma:studio
```

If you run `prisma studio` from the monorepo root without `--schema`, you may be using a different schema or no schema.

## 3. Open the **`restaurants`** model

- **`restaurants`** → Google place review total → **`rating_count`**
- **`menu_items`** → dish reviews → separate **`rating_count`** on menu items

Don’t confuse the two tables.

## 4. Scroll horizontally in the table view

`restaurants` has many columns. **`rating_count`** is after `updated_at` in the schema; you may need to scroll right in Prisma Studio’s grid.

## 5. Confirm the column exists in PostgreSQL

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'restaurants'
  AND column_name = 'rating_count';
```

If this returns **no rows**, run **`prisma migrate deploy`** (see step 1).

## 6. Prisma Cloud / Data Browser

If you mean **Prisma Cloud**’s data browser, it reflects the **linked database**. Run migrations on that database (or the same `DATABASE_URL` you connected), then refresh.
