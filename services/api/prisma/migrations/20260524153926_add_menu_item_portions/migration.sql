-- CreateTable
CREATE TABLE "menu_item_portions" (
    "id" SERIAL NOT NULL,
    "menu_item_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "is_available" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "menu_item_portions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "menu_item_portions_menu_item_id_idx" ON "menu_item_portions"("menu_item_id");

-- AddForeignKey
ALTER TABLE "menu_item_portions" ADD CONSTRAINT "menu_item_portions_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "menu_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
