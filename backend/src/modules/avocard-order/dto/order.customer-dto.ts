import type { AvocardOrder, OrderItem } from '@prisma/client';

export interface OrderItemCustomerDto {
  id: string;
  titleZh: string;
  titleKo: string | null;
  imageUrl: string | null;
  qty: number;
  cnyUnitPrice: string;
  cnyAmount: string;
  negotiationStatus: string;
  refundStatus: string | null;
}

export interface OrderCustomerDto {
  id: string;
  orderNo: string;
  customerStatus: string;
  customsType: string;
  transportMode: string;
  paymentMethod: string | null;
  submittedAt: string | null;
  items: OrderItemCustomerDto[];
}

/**
 * Customer-facing DTO. Never includes internal_status, assigned_operator_id,
 * seller_id, offer_id/sku_id, source_unit_price, or any 1688 order id —
 * those are internal-only per 05_CUSTOMER_AND_ADMIN_UX.md §1.
 */
export function toOrderCustomerDto(order: AvocardOrder & { items: OrderItem[] }): OrderCustomerDto {
  return {
    id: order.id,
    orderNo: order.order_no,
    customerStatus: order.customer_status,
    customsType: order.customs_type,
    transportMode: order.transport_mode,
    paymentMethod: order.payment_method,
    submittedAt: order.submitted_at?.toISOString() ?? null,
    items: order.items.map((item) => ({
      id: item.id,
      titleZh: item.title_zh,
      titleKo: item.title_ko,
      imageUrl: item.image_url,
      qty: item.qty,
      cnyUnitPrice: item.cny_unit_price.toString(),
      cnyAmount: item.cny_amount.toString(),
      negotiationStatus: item.negotiation_status,
      refundStatus: item.refund_status,
    })),
  };
}
