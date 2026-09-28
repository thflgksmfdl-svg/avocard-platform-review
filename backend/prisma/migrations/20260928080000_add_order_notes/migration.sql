-- CreateTable
CREATE TABLE "order_note" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_note_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "order_note_order_id_idx" ON "order_note"("order_id");

-- AddForeignKey
ALTER TABLE "order_note" ADD CONSTRAINT "order_note_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "avocard_order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
