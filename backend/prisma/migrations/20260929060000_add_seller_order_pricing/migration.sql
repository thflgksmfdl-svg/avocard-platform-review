-- CreateTable
CREATE TABLE "seller_order" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "seller_id" TEXT NOT NULL,
    "internal_1688_order_no" TEXT,
    "china_domestic_shipping_cny" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seller_order_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "seller_order_order_id_idx" ON "seller_order"("order_id");

-- AddForeignKey
ALTER TABLE "seller_order" ADD CONSTRAINT "seller_order_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "avocard_order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "order_item"
  ADD COLUMN "seller_order_id" TEXT,
  ADD COLUMN "customer_charge_cny_unit_price" DECIMAL(12,4);

-- CreateIndex
CREATE INDEX "order_item_seller_order_id_idx" ON "order_item"("seller_order_id");

-- AddForeignKey
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_seller_order_id_fkey" FOREIGN KEY ("seller_order_id") REFERENCES "seller_order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
