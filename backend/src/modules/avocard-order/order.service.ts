import type { Alibaba1688Port } from '../../integrations/alibaba1688/alibaba1688.port.js';
import type { Prisma, PrismaClient } from '@prisma/client';
import { NotFoundError } from '../../shared/errors.js';
import { writeAuditLog } from '../audit/audit-log.service.js';
import { findAnyOrderById, findOwnOrderById } from './order.repository.js';
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
            items: {
              create: input.items.map((item) => ({
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
            },
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

  const sellerGroups = groupBySeller(input.items);
  let anyFailure = false;

  for (const [sellerId, items] of sellerGroups) {
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
