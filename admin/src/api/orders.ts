import { apiClient } from './client';

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
  items: Array<{
    id: string;
    offerId: string;
    sellerId: string;
    titleZh: string;
    titleKo: string | null;
    qty: number;
    cnyUnitPrice: string;
    cnyAmount: string;
    negotiationStatus: string;
    refundStatus: string | null;
  }>;
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

interface PageResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export function listOrders(page = 1, pageSize = 20) {
  return apiClient.get<PageResult<OrderInternalDto>>(`/api/v1/admin/orders?page=${page}&pageSize=${pageSize}`);
}

export function getOrderDetail(id: string) {
  return apiClient.get<{ order: OrderInternalDto; integrationAttempts: IntegrationAttemptDto[] }>(
    `/api/v1/admin/orders/${id}`,
  );
}
