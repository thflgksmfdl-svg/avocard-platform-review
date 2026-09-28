import { config as loadDotenv } from 'dotenv';
import path from 'node:path';
import { randomInt } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: path.resolve(__dirname, '..', '.env.local') });

const prisma = new PrismaClient();

/**
 * Creates 2 synthetic orders (no real customer data) for verifying the admin
 * order-detail workflow (search, operator assignment, notes, audit history)
 * on the review deployment. Idempotent: re-running skips orders that already
 * exist for the fixed test customer.
 *
 * Usage: tsx prisma/create-review-test-orders.ts
 */

function generateOrderNo(now: Date = new Date()): string {
  const yy = String(now.getUTCFullYear()).slice(-2);
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  const random = String(randomInt(0, 10000)).padStart(4, '0');
  return `AV${yy}${mm}${dd}${random}`;
}

const TEST_SHOPIFY_CUSTOMER_ID = 'review-test-customer-001';
const TEST_EMAIL = 'review-test-customer@example.com';

async function ensureTestCustomer() {
  return prisma.customerProfile.upsert({
    where: { shopify_customer_id: TEST_SHOPIFY_CUSTOMER_ID },
    create: {
      shopify_customer_id: TEST_SHOPIFY_CUSTOMER_ID,
      email: TEST_EMAIL,
      phone: '010-0000-0000',
    },
    update: {},
  });
}

async function createTestOrder(
  customerId: string,
  opts: {
    label: string;
    customerStatus: 'QUOTE_PENDING' | 'PAYMENT_PENDING';
    internalStatus: 'ORDER_CREATED' | 'ORDER_CREATE_PARTIAL_FAILURE';
    customerMemo: string;
    paymentMethod?: 'CARD' | 'BANK_TRANSFER';
  },
) {
  const orderNo = generateOrderNo();
  const sellerId = `test-seller-${orderNo}`;
  const order = await prisma.avocardOrder.create({
    data: {
      order_no: orderNo,
      shopify_customer_id: TEST_SHOPIFY_CUSTOMER_ID,
      customer_id: customerId,
      customer_status: opts.customerStatus,
      internal_status: opts.internalStatus,
      payment_method: opts.paymentMethod,
      customs_type: 'PERSONAL',
      transport_mode: 'SEA',
      recipient_snapshot: {
        recipientName: '테스트 수취인',
        recipientPhone: '010-0000-0000',
        postalCode: '00000',
        address: '테스트 주소 (검토용 더미 데이터)',
      },
      customer_memo: opts.customerMemo,
      submitted_at: new Date(),
    },
  });

  // Stage-2 pricing verification needs a SellerOrder group (per-seller China
  // shipping + internal 1688 order no.), not just a bare OrderItem.
  const sellerOrder = await prisma.sellerOrder.create({
    data: {
      order_id: order.id,
      seller_id: sellerId,
      china_domestic_shipping_cny: '5.00',
    },
  });

  await prisma.orderItem.create({
    data: {
      order_id: order.id,
      seller_order_id: sellerOrder.id,
      offer_id: `test-offer-${orderNo}`,
      seller_id: sellerId,
      title_zh: '测试商品（审核用）',
      title_ko: '테스트 상품 (검토용)',
      qty: 2,
      cny_unit_price: '18.50',
      cny_amount: '37.00',
    },
  });

  console.log(`Created test order: ${orderNo} (${opts.label})`);
  return order;
}

async function resetExistingTestOrders() {
  const existing = await prisma.avocardOrder.findMany({
    where: { shopify_customer_id: TEST_SHOPIFY_CUSTOMER_ID },
    select: { id: true },
  });
  if (existing.length === 0) return;

  const orderIds = existing.map((o) => o.id);
  console.log(`Resetting ${orderIds.length} existing test order(s) to rebuild with SellerOrder groups...`);

  await prisma.integrationAttempt.deleteMany({
    where: { OR: orderIds.map((id) => ({ business_key: { startsWith: `${id}:` } })) },
  });
  await prisma.auditLog.deleteMany({ where: { entity_type: 'avocard_order', entity_id: { in: orderIds } } });
  await prisma.orderNote.deleteMany({ where: { order_id: { in: orderIds } } });
  await prisma.orderItem.deleteMany({ where: { order_id: { in: orderIds } } });
  await prisma.sellerOrder.deleteMany({ where: { order_id: { in: orderIds } } });
  await prisma.avocardOrder.deleteMany({ where: { id: { in: orderIds } } });
}

async function main() {
  const customer = await ensureTestCustomer();

  await resetExistingTestOrders();

  await createTestOrder(customer.id, {
    label: '정상 생성 완료 주문 (카드결제 예정, 가격수정 테스트용)',
    customerStatus: 'PAYMENT_PENDING',
    internalStatus: 'ORDER_CREATED',
    customerMemo: '검토용 테스트 주문 1 — 정상 케이스',
    paymentMethod: 'CARD',
  });

  const failedOrder = await createTestOrder(customer.id, {
    label: '1688 주문 생성 일부 실패 주문',
    customerStatus: 'QUOTE_PENDING',
    internalStatus: 'ORDER_CREATE_PARTIAL_FAILURE',
    customerMemo: '검토용 테스트 주문 2 — API 오류 필터 확인용',
  });

  await prisma.integrationAttempt.create({
    data: {
      provider: 'ALIBABA_1688',
      operation: 'createCrossOrder',
      business_key: `${failedOrder.id}:test-seller-${failedOrder.order_no}:1`,
      status: 'FAILED',
      response_sanitized: { message: '검토용 더미 실패 (실제 1688 호출 아님)' },
    },
  });
  console.log('Attached a FAILED IntegrationAttempt to test order 2 for the API-error filter.');

  console.log('Test orders ready for review verification.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
