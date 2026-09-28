import type { AvocardOrder, CustomerProfile, IntegrationAttempt, OrderItem } from '@prisma/client';

export interface OrderItemInternalDto {
  id: string;
  offerId: string;
  skuId: string | null;
  sellerId: string;
  titleZh: string;
  titleKo: string | null;
  qty: number;
  cnyUnitPrice: string;
  cnyAmount: string;
  sourceUnitPrice: string | null;
  negotiationStatus: string;
  refundStatus: string | null;
}

export interface OrderInternalDto {
  id: string;
  orderNo: string;
  shopifyCustomerId: string;
  customerId: string;
  customerEmail: string | null;
  customerStatus: string;
  internalStatus: string;
  customsType: string;
  transportMode: string;
  paymentMethod: string | null;
  assignedOperatorId: string | null;
  customerMemo: string | null;
  submittedAt: string | null;
  paidAt: string | null;
  items: OrderItemInternalDto[];
}

export function toOrderInternalDto(
  order: AvocardOrder & { items: OrderItem[]; customer?: CustomerProfile },
): OrderInternalDto {
  return {
    id: order.id,
    orderNo: order.order_no,
    shopifyCustomerId: order.shopify_customer_id,
    customerId: order.customer_id,
    customerEmail: order.customer?.email ?? null,
    customerStatus: order.customer_status,
    internalStatus: order.internal_status,
    customsType: order.customs_type,
    transportMode: order.transport_mode,
    paymentMethod: order.payment_method,
    assignedOperatorId: order.assigned_operator_id,
    customerMemo: order.customer_memo,
    submittedAt: order.submitted_at?.toISOString() ?? null,
    paidAt: order.paid_at?.toISOString() ?? null,
    items: order.items.map((item) => ({
      id: item.id,
      offerId: item.offer_id,
      skuId: item.sku_id,
      sellerId: item.seller_id,
      titleZh: item.title_zh,
      titleKo: item.title_ko,
      qty: item.qty,
      cnyUnitPrice: item.cny_unit_price.toString(),
      cnyAmount: item.cny_amount.toString(),
      sourceUnitPrice: item.source_unit_price?.toString() ?? null,
      negotiationStatus: item.negotiation_status,
      refundStatus: item.refund_status,
    })),
  };
}

export interface IntegrationAttemptDto {
  id: string;
  provider: string;
  operation: string;
  businessKey: string;
  status: string;
  retryCount: number;
  createdAt: string;
}

export function toIntegrationAttemptDto(attempt: IntegrationAttempt): IntegrationAttemptDto {
  return {
    id: attempt.id,
    provider: attempt.provider,
    operation: attempt.operation,
    businessKey: attempt.business_key,
    status: attempt.status,
    retryCount: attempt.retry_count,
    createdAt: attempt.created_at.toISOString(),
  };
}
