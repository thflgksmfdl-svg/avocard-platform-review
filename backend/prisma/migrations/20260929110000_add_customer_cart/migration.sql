CREATE TABLE "cart" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "cart_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "cart_item" (
    "id" TEXT NOT NULL,
    "cart_id" TEXT NOT NULL,
    "offer_id" TEXT NOT NULL,
    "sku_id" TEXT NOT NULL,
    "seller_id" TEXT NOT NULL,
    "title_zh" TEXT NOT NULL,
    "title_ko" TEXT,
    "image_url" TEXT,
    "product_url" TEXT,
    "video_url" TEXT,
    "option_snapshot" JSONB NOT NULL,
    "qty" INTEGER NOT NULL,
    "cny_unit_price" DECIMAL(12,4) NOT NULL,
    "stock_snapshot" INTEGER,
    "product_snapshot_version" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "cart_item_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cart_customer_id_key" ON "cart"("customer_id");
CREATE INDEX "cart_expires_at_idx" ON "cart"("expires_at");
CREATE INDEX "cart_item_cart_id_idx" ON "cart_item"("cart_id");
CREATE UNIQUE INDEX "cart_item_cart_id_offer_id_sku_id_key" ON "cart_item"("cart_id", "offer_id", "sku_id");

ALTER TABLE "cart" ADD CONSTRAINT "cart_customer_id_fkey"
FOREIGN KEY ("customer_id") REFERENCES "customer_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "cart_item" ADD CONSTRAINT "cart_item_cart_id_fkey"
FOREIGN KEY ("cart_id") REFERENCES "cart"("id") ON DELETE CASCADE ON UPDATE CASCADE;
