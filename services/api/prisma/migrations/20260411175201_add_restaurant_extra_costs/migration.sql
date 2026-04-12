-- CreateTable
CREATE TABLE "restaurant_extra_costs" (
    "id" SERIAL NOT NULL,
    "restaurant_id" INTEGER NOT NULL,
    "label" VARCHAR(100) NOT NULL,
    "rate" DECIMAL(6,3) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "restaurant_extra_costs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "restaurant_extra_costs_restaurant_id_idx" ON "restaurant_extra_costs"("restaurant_id");

-- AddForeignKey
ALTER TABLE "restaurant_extra_costs" ADD CONSTRAINT "restaurant_extra_costs_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
