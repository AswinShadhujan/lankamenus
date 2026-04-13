-- AlterTable
ALTER TABLE "homepage_banners"
ADD COLUMN "cta_type" VARCHAR(30),
ADD COLUMN "restaurant_id" INTEGER,
ADD COLUMN "cuisine_key" VARCHAR(100);

-- Backward compatibility: existing banners with cta_url become custom_url;
-- others default to restaurants_list.
UPDATE "homepage_banners"
SET "cta_type" = CASE
  WHEN COALESCE(NULLIF(TRIM("cta_url"), ''), '') <> '' THEN 'custom_url'
  ELSE 'restaurants_list'
END
WHERE "cta_type" IS NULL;

-- CreateIndex
CREATE INDEX "homepage_banners_cta_type_idx" ON "homepage_banners"("cta_type");

-- CreateIndex
CREATE INDEX "homepage_banners_restaurant_id_idx" ON "homepage_banners"("restaurant_id");

-- AddForeignKey
ALTER TABLE "homepage_banners"
ADD CONSTRAINT "homepage_banners_restaurant_id_fkey"
FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
