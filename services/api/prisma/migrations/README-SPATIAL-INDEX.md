# Spatial index for restaurants.geom

Prisma does not generate GIST indexes for PostGIS `geography` columns. To speed up "near me" search (`ST_DWithin` / `ST_Distance`), run this SQL once (e.g. in a migration or manually):

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS restaurants_geom_idx
ON restaurants USING GIST(geom);
```

- Use `CONCURRENTLY` in production to avoid locking the table.
- Omit `CONCURRENTLY` if the table is empty or during initial setup.

After adding the index, spatial queries in `RestaurantsService.search` will use it.
