-- CreateEnum
CREATE TYPE "BusinessDocumentStatus" AS ENUM ('NOT_SUBMITTED', 'SUBMITTED', 'REVERIFY_REQUIRED');

-- CreateEnum
CREATE TYPE "AddressType" AS ENUM ('PERSONAL', 'BUSINESS');

-- CreateEnum
CREATE TYPE "CustomerStatus" AS ENUM ('QUOTE_PENDING', 'PAYMENT_PENDING', 'PAID', 'AWAITING_ARRIVAL', 'ARRIVED', 'ARRIVAL_ERROR', 'AWAITING_SHIPMENT', 'SHIPPED');

-- CreateEnum
CREATE TYPE "InternalStatus" AS ENUM ('DRAFT', 'ORDER_CREATE_PENDING', 'ORDER_CREATE_PARTIAL_FAILURE', 'ORDER_CREATED', 'CUSTOMER_PAYMENT_PENDING', 'CUSTOMER_PAID', 'STAFF_PURCHASE_IN_PROGRESS', 'SELLER_SHIPMENT_PENDING', 'PARTIALLY_SHIPPED', 'SHIPPED', 'TRADE_COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CARD', 'BANK_TRANSFER');

-- CreateEnum
CREATE TYPE "CustomsType" AS ENUM ('PERSONAL', 'BUSINESS');

-- CreateEnum
CREATE TYPE "TransportMode" AS ENUM ('SEA', 'AIR', 'LCL');

-- CreateEnum
CREATE TYPE "NegotiationStatus" AS ENUM ('NORMAL', 'REVIEW_REQUIRED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('REQUESTED', 'PROCESSING', 'COMPLETED');

-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('STAFF');

-- CreateEnum
CREATE TYPE "IntegrationProvider" AS ENUM ('ALIBABA_1688', 'JUNGPAN', 'SHOPIFY', 'CHANNEL_TALK');

-- CreateEnum
CREATE TYPE "IntegrationAttemptStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'UNKNOWN_NEEDS_RECONCILE');

-- CreateTable
CREATE TABLE "customer_profile" (
    "id" TEXT NOT NULL,
    "shopify_customer_id" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "business_document_status" "BusinessDocumentStatus" NOT NULL DEFAULT 'NOT_SUBMITTED',
    "business_document_submitted_at" TIMESTAMP(3),
    "business_document_submitted_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "address_book" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "address_type" "AddressType" NOT NULL,
    "label" TEXT NOT NULL,
    "recipient_name" TEXT,
    "recipient_phone" TEXT,
    "customs_clearance_no" TEXT,
    "business_name" TEXT,
    "business_no" TEXT,
    "postal_code" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "address_detail" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "address_book_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exchange_rate" (
    "id" TEXT NOT NULL,
    "currency_pair" TEXT NOT NULL DEFAULT 'CNY_KRW',
    "rate" DECIMAL(12,6) NOT NULL,
    "effective_at" TIMESTAMP(3) NOT NULL,
    "entered_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exchange_rate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "avocard_order" (
    "id" TEXT NOT NULL,
    "order_no" TEXT NOT NULL,
    "shopify_customer_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "customer_status" "CustomerStatus" NOT NULL DEFAULT 'QUOTE_PENDING',
    "internal_status" "InternalStatus" NOT NULL DEFAULT 'DRAFT',
    "payment_method" "PaymentMethod",
    "customs_type" "CustomsType" NOT NULL,
    "transport_mode" "TransportMode" NOT NULL,
    "recipient_snapshot" JSONB NOT NULL,
    "customer_memo" TEXT,
    "assigned_operator_id" TEXT,
    "submitted_at" TIMESTAMP(3),
    "paid_at" TIMESTAMP(3),
    "hidden_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "avocard_order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_item" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "offer_id" TEXT NOT NULL,
    "sku_id" TEXT,
    "seller_id" TEXT NOT NULL,
    "title_zh" TEXT NOT NULL,
    "title_ko" TEXT,
    "image_url" TEXT,
    "product_url" TEXT,
    "video_url" TEXT,
    "option_snapshot" JSONB,
    "qty" INTEGER NOT NULL,
    "cny_unit_price" DECIMAL(12,4) NOT NULL,
    "cny_amount" DECIMAL(12,4) NOT NULL,
    "source_unit_price" DECIMAL(12,4),
    "negotiation_status" "NegotiationStatus" NOT NULL DEFAULT 'NORMAL',
    "refund_status" "RefundStatus",
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_user" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "role" "AdminRole" NOT NULL DEFAULT 'STAFF',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "before_json" JSONB,
    "after_json" JSONB,
    "actor_type" TEXT NOT NULL,
    "actor_id" TEXT,
    "correlation_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_attempt" (
    "id" TEXT NOT NULL,
    "provider" "IntegrationProvider" NOT NULL,
    "operation" TEXT NOT NULL,
    "business_key" TEXT NOT NULL,
    "request_sanitized" JSONB,
    "response_sanitized" JSONB,
    "http_status" INTEGER,
    "status" "IntegrationAttemptStatus" NOT NULL DEFAULT 'PENDING',
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "next_retry_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integration_attempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customer_profile_shopify_customer_id_key" ON "customer_profile"("shopify_customer_id");

-- CreateIndex
CREATE INDEX "address_book_customer_id_idx" ON "address_book"("customer_id");

-- CreateIndex
CREATE INDEX "exchange_rate_currency_pair_effective_at_idx" ON "exchange_rate"("currency_pair", "effective_at");

-- CreateIndex
CREATE UNIQUE INDEX "avocard_order_order_no_key" ON "avocard_order"("order_no");

-- CreateIndex
CREATE INDEX "avocard_order_customer_id_idx" ON "avocard_order"("customer_id");

-- CreateIndex
CREATE INDEX "avocard_order_shopify_customer_id_idx" ON "avocard_order"("shopify_customer_id");

-- CreateIndex
CREATE INDEX "order_item_order_id_idx" ON "order_item"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "admin_user_email_key" ON "admin_user"("email");

-- CreateIndex
CREATE INDEX "audit_log_entity_type_entity_id_idx" ON "audit_log"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_log_created_at_idx" ON "audit_log"("created_at");

-- CreateIndex
CREATE INDEX "integration_attempt_status_idx" ON "integration_attempt"("status");

-- CreateIndex
CREATE UNIQUE INDEX "integration_attempt_provider_operation_business_key_key" ON "integration_attempt"("provider", "operation", "business_key");

-- AddForeignKey
ALTER TABLE "address_book" ADD CONSTRAINT "address_book_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customer_profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avocard_order" ADD CONSTRAINT "avocard_order_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customer_profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "avocard_order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
