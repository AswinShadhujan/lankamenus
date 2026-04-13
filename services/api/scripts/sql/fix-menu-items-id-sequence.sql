-- Fix Prisma P2002 on menu_items.id ("Unique constraint failed on the fields: (id)")
-- Root cause: PostgreSQL SERIAL/identity sequence is behind MAX(menu_items.id).
-- Typical after: COPY, createMany with explicit ids, restore from dump, or scripts/migrate-data.ts
-- (inserting rows with fixed ids does not bump the sequence).
--
-- 1) Inspect (optional)
-- SELECT last_value, is_called FROM pg_sequences WHERE sequencename = 'menu_items_id_seq';
-- Or: SELECT * FROM menu_items_id_seq;
-- SELECT COALESCE(MAX(id), 0) AS max_id FROM menu_items;
--
-- 2) Safe reset: next INSERT gets COALESCE(MAX(id),0)+1
SELECT setval(
  pg_get_serial_sequence('menu_items', 'id'),
  COALESCE((SELECT MAX(id) FROM menu_items), 0) + 1,
  false
);
--
-- 3) After other bulk imports, consider the same pattern for any SERIAL table you touched:
-- SELECT setval(pg_get_serial_sequence('menus', 'id'), COALESCE((SELECT MAX(id) FROM menus), 0) + 1, false);
-- SELECT setval(pg_get_serial_sequence('menu_sections', 'id'), COALESCE((SELECT MAX(id) FROM menu_sections), 0) + 1, false);
-- SELECT setval(pg_get_serial_sequence('restaurants', 'id'), COALESCE((SELECT MAX(id) FROM restaurants), 0) + 1, false);
-- SELECT setval(pg_get_serial_sequence('media_assets', 'id'), COALESCE((SELECT MAX(id) FROM media_assets), 0) + 1, false);
-- (Adjust table/column names if your schema differs.)
--
-- 4) One-shot after bulk import: resync menus → sections → items (same drift pattern)
BEGIN;
SELECT setval(
  pg_get_serial_sequence('menus', 'id'),
  COALESCE((SELECT MAX(id) FROM menus), 0) + 1,
  false
);
SELECT setval(
  pg_get_serial_sequence('menu_sections', 'id'),
  COALESCE((SELECT MAX(id) FROM menu_sections), 0) + 1,
  false
);
SELECT setval(
  pg_get_serial_sequence('menu_items', 'id'),
  COALESCE((SELECT MAX(id) FROM menu_items), 0) + 1,
  false
);
COMMIT;
