-- CreateTable
CREATE TABLE "media_assets" (
    "id" SERIAL NOT NULL,
    "provider" VARCHAR(30) NOT NULL DEFAULT 'cloudinary',
    "public_id" VARCHAR(255) NOT NULL,
    "secure_url" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "format" VARCHAR(20),
    "alt_text" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "homepage_banners" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "subtitle" VARCHAR(500),
    "cta_label" VARCHAR(100),
    "cta_url" VARCHAR(500),
    "media_asset_id" INTEGER,
    "overlay_color" VARCHAR(30),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "starts_at" TIMESTAMP(3),
    "ends_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "homepage_banners_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "media_assets_public_id_idx" ON "media_assets"("public_id");

-- CreateIndex
CREATE INDEX "homepage_banners_is_active_sort_order_idx" ON "homepage_banners"("is_active", "sort_order");

-- AddForeignKey
ALTER TABLE "homepage_banners" ADD CONSTRAINT "homepage_banners_media_asset_id_fkey" FOREIGN KEY ("media_asset_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
