-- CreateTable
CREATE TABLE "user_dish_favourites" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "dish_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_dish_favourites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_dish_favourites_user_id_idx" ON "user_dish_favourites"("user_id");

-- CreateIndex
CREATE INDEX "user_dish_favourites_dish_id_idx" ON "user_dish_favourites"("dish_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_dish_favourites_user_id_dish_id_key" ON "user_dish_favourites"("user_id", "dish_id");

-- AddForeignKey
ALTER TABLE "user_dish_favourites" ADD CONSTRAINT "user_dish_favourites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_dish_favourites" ADD CONSTRAINT "user_dish_favourites_dish_id_fkey" FOREIGN KEY ("dish_id") REFERENCES "menu_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
