-- AlterTable
ALTER TABLE "media_assets" ADD COLUMN     "mime_type" VARCHAR(100),
ADD COLUMN     "source_type" VARCHAR(20) NOT NULL DEFAULT 'cloudinary',
ALTER COLUMN "public_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "menu_items" ADD COLUMN     "media_asset_id" INTEGER;

-- AlterTable
ALTER TABLE "restaurants" ADD COLUMN     "media_asset_id" INTEGER;

-- CreateIndex
CREATE INDEX "media_assets_source_type_idx" ON "media_assets"("source_type");

-- CreateIndex
CREATE INDEX "menu_items_media_asset_id_idx" ON "menu_items"("media_asset_id");

-- AddForeignKey
ALTER TABLE "restaurants" ADD CONSTRAINT "restaurants_media_asset_id_fkey" FOREIGN KEY ("media_asset_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_media_asset_id_fkey" FOREIGN KEY ("media_asset_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
