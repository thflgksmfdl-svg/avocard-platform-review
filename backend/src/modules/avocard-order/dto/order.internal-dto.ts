import type {
  AuditLog,
  AvocardOrder,
  CustomerProfile,
  IntegrationAttempt,
  OrderItem,
  OrderNote,
  SellerOrder,
} from '@prisma/client';
import { computeOrderPriceBreakdown, type OrderPriceBreakdown } from '../order-pricing.js';

export interface OrderItemInternalDto {
  id: string;
  sellerOrderId: string | null;
  offerId: string;
  skuId: string | null;
  sellerId: string;
  titleZh: string;
  titleKo: string | null;
  qty: number;
  cnyUnitPrice: string;
  cnyAmount: string;
  sourceUnitPrice: string | null;
  customerChargeCnyUnitPrice: string | null;
  negotiationStatus: string;
  refundStatus: string | null;
}

export interface SellerOrderDto {
  id: string;
  sellerId: string;
  internal1688OrderNo: string | null;
  chinaDomesticShippingCny: string;
  items: OrderItemInternalDto[];
}

function toOrderItemInternalDto(item: OrderItem): OrderItemInternalDto {
  return {
    id: item.id,
    sellerOrderId: item.seller_order_id,
    offerId: item.offer_id,
    skuId: item.sku_id,
    sellerId: item.seller_id,
    titleZh: item.title_zh,
    titleKo: item.title_ko,
    qty: item.qty,
    cnyUnitPrice: item.cny_unit_price.toString(),
    cnyAmount: item.cny_amount.toString(),
    sourceUnitPrice: item.source_unit_price?.toString() ?? null,
    customerChargeCnyUnitPrice: item.customer_charge_cny_unit_price?.toString() ?? null,
    negotiationStatus: item.negotiation_status,
    refundStatus: item.refund_status,
  };
}

function toSellerOrderDto(sellerOrder: SellerOrder & { items: OrderItem[] }): SellerOrderDto {
  return {
    id: sellerOrder.id,
    sellerId: sellerOrder.seller_id,
    internal1688OrderNo: sellerOrder.internal_1688_order_no,
    chinaDomesticShippingCny: sellerOrder.china_domestic_shipping_cny.toString(),
    items: sellerOrder.items.map(toOrderItemInternalDto),
  };
}

export interface OrderErrorSummaryDto {
  provider: string;
  operation: string;
  reason: string;
  count: number;
  lastOccurredAt: string;
}

const ERROR_REASON_LABELS: Record<string, string> = {
  'ALIBABA_1688:createCrossOrder': '1688 주문 생성 실패',
  'JUNGPAN:createOrder': '중판 주문 생성 실패',
  'JUNGPAN:notifyPayment': '중판 결제통보 실패',
  'SHOPIFY:notifyCustomer': '고객 알림 발송 실패',
};

export function describeIntegrationError(provider: string, operation: string): string {
  return ERROR_REASON_LABELS[`${provider}:${operation}`] ?? `${provider} ${operation} 호출 실패`;
}

export interface OrderPriceBreakdownDto {
  exchangeRate: string;
  itemsCnyTotal: string;
  chinaShippingCnyTotal: string;
  goodsAndShippingCnyTotal: string;
  goodsAndShippingKrw: string;
  serviceFeeKrw: string;
  walletUsedKrw: string;
  cardChargeBaseKrw: string;
  cardFeeKrw: string;
  totalKrw: string;
}

function toOrderPriceBreakdownDto(breakdown: OrderPriceBreakdown): OrderPriceBreakdownDto {
  return {
    exchangeRate: breakdown.exchangeRate.toString(),
    itemsCnyTotal: breakdown.itemsCnyTotal.toFixed(4),
    chinaShippingCnyTotal: breakdown.chinaShippingCnyTotal.toFixed(4),
    goodsAndShippingCnyTotal: breakdown.goodsAndShippingCnyTotal.toFixed(4),
    goodsAndShippingKrw: Math.round(breakdown.goodsAndShippingKrw).toString(),
    serviceFeeKrw: Math.round(breakdown.serviceFeeKrw).toString(),
    walletUsedKrw: Math.round(breakdown.walletUsedKrw).toString(),
    cardChargeBaseKrw: Math.round(breakdown.cardChargeBaseKrw).toString(),
    cardFeeKrw: Math.round(breakdown.cardFeeKrw).toString(),
    totalKrw: Math.round(breakdown.totalKrw).toString(),
  };
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
  sellerOrders: SellerOrderDto[];
  priceBreakdown: OrderPriceBreakdownDto | null;
  errorSummaries: OrderErrorSummaryDto[];
}

export function toOrderInternalDto(
  order: AvocardOrder & {
    items: OrderItem[];
    customer?: CustomerProfile;
    sellerOrders?: (SellerOrder & { items: OrderItem[] })[];
  },
  errorSummaries: { provider: string; operation: string; count: number; lastOccurredAt: string }[] = [],
  latestExchangeRate: number | null = null,
): OrderInternalDto {
  const sellerOrders = order.sellerOrders ?? [];
  const priceBreakdown =
    latestExchangeRate !== null
      ? toOrderPriceBreakdownDto(
          computeOrderPriceBreakdown(
            sellerOrders.map((so) => ({
              seller_id: so.seller_id,
              internal_1688_order_no: so.internal_1688_order_no,
              china_domestic_shipping_cny: so.china_domestic_shipping_cny.toString(),
              items: so.items.map((item) => ({
                qty: item.qty,
                cny_unit_price: item.cny_unit_price.toString(),
                customer_charge_cny_unit_price: item.customer_charge_cny_unit_price?.toString() ?? null,
              })),
            })),
            latestExchangeRate,
            order.payment_method,
          ),
        )
      : null;

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
    items: order.items.map(toOrderItemInternalDto),
    sellerOrders: sellerOrders.map(toSellerOrderDto),
    priceBreakdown,
    errorSummaries: errorSummaries.map((s) => ({
      provider: s.provider,
      operation: s.operation,
      reason: describeIntegrationError(s.provider, s.operation),
      count: s.count,
      lastOccurredAt: s.lastOccurredAt,
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

export interface OrderNoteDto {
  id: string;
  body: string;
  createdBy: string;
  createdAt: string;
}

export function toOrderNoteDto(note: OrderNote): OrderNoteDto {
  return {
    id: note.id,
    body: note.body,
    createdBy: note.created_by,
    createdAt: note.created_at.toISOString(),
  };
}

export interface AdminUserOptionDto {
  id: string;
  email: string;
  displayName: string;
}

export interface AuditLogDto {
  id: string;
  action: string;
  before: unknown;
  after: unknown;
  actorType: string;
  actorId: string | null;
  createdAt: string;
}

export function toAuditLogDto(log: AuditLog): AuditLogDto {
  return {
    id: log.id,
    action: log.action,
    before: log.before_json,
    after: log.after_json,
    actorType: log.actor_type,
    actorId: log.actor_id,
    createdAt: log.created_at.toISOString(),
  };
}
