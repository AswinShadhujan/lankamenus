-- Safe if column already exists (Postgres 9.1+ style: use IF NOT EXISTS via migration pattern)
ALTER TABLE "menu_items" ADD COLUMN IF NOT EXISTS "click_count" INTEGER NOT NULL DEFAULT 0;
