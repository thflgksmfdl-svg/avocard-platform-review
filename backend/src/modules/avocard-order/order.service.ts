import type { Alibaba1688Port } from '../../integrations/alibaba1688/alibaba1688.port.js';
import type { Prisma, PrismaClient } from '@prisma/client';
import { NotFoundError } from '../../shared/errors.js';
import type { RequestActor } from '../../shared/types.js';
import { writeAuditLog } from '../audit/audit-log.service.js';
import { createOrderNote, findAnyOrderById, findOwnOrderById } from './order.repository.js';
import { generateOrderNo } from './order-number.js';

const MAX_ORDER_NO_ATTEMPTS = 5;

export interface SubmitOrderItemInput {
  offerId: string;
  skuId?: string;
  sellerId: string;
  titleZh: string;
  titleKo?: string;
  imageUrl?: string;
  productUrl?: string;
  videoUrl?: string;
  optionSnapshot?: Record<string, unknown>;
  qty: number;
  cnyUnitPrice: string;
}

export interface SubmitOrderInput {
  customsType: 'PERSONAL' | 'BUSINESS';
  transportMode: 'SEA' | 'AIR' | 'LCL';
  recipientSnapshot: Record<string, unknown>;
  customerMemo?: string;
  items: SubmitOrderItemInput[];
}

/**
 * Creates an avocard_order + order_items, then attempts a 1688 cross-order
 * create per seller group via the (currently stub) Alibaba1688Port. Because
 * the adapter is a stub, every attempt fails by design in this slice — this
 * exercises the documented partial-failure path (03_WORKFLOWS_AND_STATE_MACHINES.md
 * §4) end-to-end: successful attempts are kept, failed ones are recorded,
 * and the order lands in ORDER_CREATE_PARTIAL_FAILURE / QUOTE_PENDING when
 * any seller group fails, never silently marked as fully created.
 */
export async function submitOrder(
  prisma: PrismaClient,
  alibaba1688: Alibaba1688Port,
  customerId: string,
  shopifyCustomerId: string,
  input: SubmitOrderInput,
  correlationId?: string,
) {
  const sellerGroupsAtSubmit = groupBySeller(input.items);

  const orderId = await prisma.$transaction(async (tx) => {
    let orderNo: string | null = null;
    let created;

    for (let attempt = 0; attempt < MAX_ORDER_NO_ATTEMPTS; attempt += 1) {
      const candidate = generateOrderNo();
      try {
        created = await tx.avocardOrder.create({
          data: {
            order_no: candidate,
            shopify_customer_id: shopifyCustomerId,
            customer_id: customerId,
            internal_status: 'ORDER_CREATE_PENDING',
            customer_status: 'QUOTE_PENDING',
            customs_type: input.customsType,
            transport_mode: input.transportMode,
            recipient_snapshot: input.recipientSnapshot as Prisma.InputJsonValue,
            customer_memo: input.customerMemo,
            submitted_at: new Date(),
          },
        });
        orderNo = candidate;
        break;
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          continue;
        }
        throw error;
      }
    }

    if (!created || !orderNo) {
      throw new Error('Failed to generate a unique order_no after multiple attempts');
    }

    // One SellerOrder per 1688 seller group, matching how AVOCARD actually
    // groups purchasing (09_CANONICAL_DECISIONS.md "여러 1688 판매자의 상품을
    // 한 주문에 담을 수 있다"), so per-seller China-domestic-shipping and the
    // internal 1688 order number can be recorded and edited independently.
    for (const [sellerId, items] of sellerGroupsAtSubmit) {
      const sellerOrder = await tx.sellerOrder.create({
        data: { order_id: created.id, seller_id: sellerId },
      });

      await tx.orderItem.createMany({
        data: items.map((item) => ({
          order_id: created!.id,
          seller_order_id: sellerOrder.id,
          offer_id: item.offerId,
          sku_id: item.skuId,
          seller_id: item.sellerId,
          title_zh: item.titleZh,
          title_ko: item.titleKo,
          image_url: item.imageUrl,
          product_url: item.productUrl,
          video_url: item.videoUrl,
          option_snapshot: item.optionSnapshot as Prisma.InputJsonValue | undefined,
          qty: item.qty,
          cny_unit_price: item.cnyUnitPrice,
          cny_amount: (Number(item.cnyUnitPrice) * item.qty).toString(),
        })),
      });
    }

    await writeAuditLog(tx, {
      entityType: 'avocard_order',
      entityId: created.id,
      action: 'SUBMIT',
      after: { orderNo, itemCount: input.items.length },
      actor: { type: 'CUSTOMER', id: customerId },
      correlationId,
    });

    return created.id;
  });

  let anyFailure = false;

  for (const [sellerId, items] of sellerGroupsAtSubmit) {
    const businessKey = `${orderId}:${sellerId}:1`;

    await prisma.integrationAttempt.upsert({
      where: {
        provider_operation_business_key: {
          provider: 'ALIBABA_1688',
          operation: 'createCrossOrder',
          business_key: businessKey,
        },
      },
      create: {
        provider: 'ALIBABA_1688',
        operation: 'createCrossOrder',
        business_key: businessKey,
        status: 'PENDING',
      },
      update: { status: 'PENDING', retry_count: { increment: 1 } },
    });

    try {
      await alibaba1688.createCrossOrder({
        businessKey,
        sellerId,
        items: items.map((item) => ({
          offerId: item.offerId,
          skuId: item.skuId,
          qty: item.qty,
          unitPriceCny: item.cnyUnitPrice,
        })),
      });

      await prisma.integrationAttempt.update({
        where: {
          provider_operation_business_key: {
            provider: 'ALIBABA_1688',
            operation: 'createCrossOrder',
            business_key: businessKey,
          },
        },
        data: { status: 'SUCCEEDED' },
      });
    } catch (error) {
      anyFailure = true;
      await prisma.integrationAttempt.update({
        where: {
          provider_operation_business_key: {
            provider: 'ALIBABA_1688',
            operation: 'createCrossOrder',
            business_key: businessKey,
          },
        },
        data: {
          status: 'FAILED',
          response_sanitized: { message: error instanceof Error ? error.message : 'Unknown error' },
        },
      });
    }
  }

  const finalStatus = anyFailure
    ? { internal_status: 'ORDER_CREATE_PARTIAL_FAILURE' as const, customer_status: 'QUOTE_PENDING' as const }
    : { internal_status: 'ORDER_CREATED' as const, customer_status: 'PAYMENT_PENDING' as const };

  await prisma.$transaction(async (tx) => {
    const before = await tx.avocardOrder.findUniqueOrThrow({ where: { id: orderId } });
    const after = await tx.avocardOrder.update({ where: { id: orderId }, data: finalStatus });

    await writeAuditLog(tx, {
      entityType: 'avocard_order',
      entityId: orderId,
      action: 'CREATE_1688_ORDERS_RESULT',
      before: { internalStatus: before.internal_status },
      after: { internalStatus: after.internal_status, anyFailure },
      actor: { type: 'SYSTEM', id: null },
      correlationId,
    });
  });

  const result = await findAnyOrderById(prisma, orderId);
  if (!result) {
    throw new Error('Order disappeared after creation');
  }
  return result;
}

function groupBySeller(items: SubmitOrderItemInput[]): Map<string, SubmitOrderItemInput[]> {
  const map = new Map<string, SubmitOrderItemInput[]>();
  for (const item of items) {
    const group = map.get(item.sellerId) ?? [];
    group.push(item);
    map.set(item.sellerId, group);
  }
  return map;
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'P2002'
  );
}

export async function getOwnOrderOrThrow(prisma: PrismaClient, customerId: string, id: string) {
  const order = await findOwnOrderById(prisma, customerId, id);
  if (!order) {
    throw new NotFoundError('Order not found');
  }
  return order;
}

export async function getAnyOrderOrThrow(prisma: PrismaClient, id: string) {
  const order = await findAnyOrderById(prisma, id);
  if (!order) {
    throw new NotFoundError('Order not found');
  }
  return order;
}

/**
 * Assigns (or clears, when operatorId is null) the staff member responsible
 * for an order. 09_CANONICAL_DECISIONS.md gives all ~7 staff the same
 * permissions, so this is a plain reassignment, not an approval workflow.
 */
export async function assignOrderOperator(
  prisma: PrismaClient,
  orderId: string,
  operatorId: string | null,
  actor: RequestActor,
  correlationId?: string,
) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.avocardOrder.findUnique({ where: { id: orderId } });
    if (!before) {
      throw new NotFoundError('Order not found');
    }

    const after = await tx.avocardOrder.update({
      where: { id: orderId },
      data: { assigned_operator_id: operatorId },
    });

    await writeAuditLog(tx, {
      entityType: 'avocard_order',
      entityId: orderId,
      action: 'ASSIGN_OPERATOR',
      before: { assignedOperatorId: before.assigned_operator_id },
      after: { assignedOperatorId: after.assigned_operator_id },
      actor,
      correlationId,
    });

    return after;
  });
}

/**
 * Updates the per-seller China-domestic-shipping cost and/or the internal
 * 1688 order number staff record after confirming with the seller
 * (09_CANONICAL_DECISIONS.md "담당자는... 중국 내 운임... 수정할 수 있다";
 * 05_CUSTOMER_AND_ADMIN_UX.md §9-B). No exchange-rate or total is stored
 * here — order-pricing.ts recomputes the customer-facing total from the
 * latest rate on every read, per "수정값은 고객 화면에 즉시 반영. 별도
 * `결제금액 확정` 버튼은 없다."
 */
export async function updateSellerOrderShipping(
  prisma: PrismaClient,
  sellerOrderId: string,
  input: { chinaDomesticShippingCny?: string; internal1688OrderNo?: string | null },
  actor: RequestActor,
  correlationId?: string,
) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.sellerOrder.findUnique({ where: { id: sellerOrderId } });
    if (!before) {
      throw new NotFoundError('Seller order not found');
    }

    const after = await tx.sellerOrder.update({
      where: { id: sellerOrderId },
      data: {
        china_domestic_shipping_cny: input.chinaDomesticShippingCny,
        internal_1688_order_no: input.internal1688OrderNo,
      },
    });

    await writeAuditLog(tx, {
      entityType: 'seller_order',
      entityId: sellerOrderId,
      action: 'UPDATE_SHIPPING_AND_REF',
      before: {
        chinaDomesticShippingCny: before.china_domestic_shipping_cny.toString(),
        internal1688OrderNo: before.internal_1688_order_no,
      },
      after: {
        chinaDomesticShippingCny: after.china_domestic_shipping_cny.toString(),
        internal1688OrderNo: after.internal_1688_order_no,
      },
      actor,
      correlationId,
    });

    return after;
  });
}

/**
 * Updates the customer-charged unit price for one order item. Quantity is
 * never editable here — 09_CANONICAL_DECISIONS.md "담당자도 수량을 수정하지
 * 않는다" — and the original cny_unit_price (what the customer submitted
 * at) is left untouched; customer_charge_cny_unit_price is the staff
 * override that order-pricing.ts prefers when present.
 */
export async function updateOrderItemCharge(
  prisma: PrismaClient,
  orderItemId: string,
  customerChargeCnyUnitPrice: string | null,
  actor: RequestActor,
  correlationId?: string,
) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.orderItem.findUnique({ where: { id: orderItemId } });
    if (!before) {
      throw new NotFoundError('Order item not found');
    }

    const after = await tx.orderItem.update({
      where: { id: orderItemId },
      data: { customer_charge_cny_unit_price: customerChargeCnyUnitPrice },
    });

    await writeAuditLog(tx, {
      entityType: 'order_item',
      entityId: orderItemId,
      action: 'UPDATE_CUSTOMER_CHARGE_PRICE',
      before: { customerChargeCnyUnitPrice: before.customer_charge_cny_unit_price?.toString() ?? null },
      after: { customerChargeCnyUnitPrice: after.customer_charge_cny_unit_price?.toString() ?? null },
      actor,
      correlationId,
    });

    return after;
  });
}

/**
 * Appends one row to the order's internal-memo timeline. Notes are
 * append-only (05_CUSTOMER_AND_ADMIN_UX.md §9-A "내부메모 timeline") — there
 * is no edit/delete route, matching the audit_log append-only pattern.
 */
export async function addOrderNote(
  prisma: PrismaClient,
  orderId: string,
  body: string,
  actor: RequestActor,
  correlationId?: string,
) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.avocardOrder.findUnique({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundError('Order not found');
    }

    const note = await createOrderNote(tx, orderId, body, actor.id ?? 'unknown');

    await writeAuditLog(tx, {
      entityType: 'avocard_order',
      entityId: orderId,
      action: 'ADD_NOTE',
      after: { noteId: note.id, body },
      actor,
      correlationId,
    });

    return note;
  });
}
