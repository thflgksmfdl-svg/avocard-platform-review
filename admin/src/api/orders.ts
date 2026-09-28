import { apiClient } from './client';

export interface OrderErrorSummaryDto {
  provider: string;
  operation: string;
  reason: string;
  count: number;
  lastOccurredAt: string;
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
  errorSummaries: OrderErrorSummaryDto[];
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

export interface OrderNoteDto {
  id: string;
  body: string;
  createdBy: string;
  createdAt: string;
}

export interface AdminOperatorDto {
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

interface PageResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface OrderListFilters {
  page?: number;
  pageSize?: number;
  search?: string;
  customerStatus?: string;
  paymentMethod?: string;
  assignedOperatorId?: string;
  hasApiError?: boolean;
  hasRefundInProgress?: boolean;
  submittedFrom?: string;
  submittedTo?: string;
}

export function listOrders(filters: OrderListFilters = {}) {
  const params = new URLSearchParams();
  params.set('page', String(filters.page ?? 1));
  params.set('pageSize', String(filters.pageSize ?? 20));
  if (filters.search) params.set('search', filters.search);
  if (filters.customerStatus) params.set('customerStatus', filters.customerStatus);
  if (filters.paymentMethod) params.set('paymentMethod', filters.paymentMethod);
  if (filters.assignedOperatorId) params.set('assignedOperatorId', filters.assignedOperatorId);
  if (filters.hasApiError) params.set('hasApiError', 'true');
  if (filters.hasRefundInProgress) params.set('hasRefundInProgress', 'true');
  if (filters.submittedFrom) params.set('submittedFrom', filters.submittedFrom);
  if (filters.submittedTo) params.set('submittedTo', filters.submittedTo);
  return apiClient.get<PageResult<OrderInternalDto>>(`/api/v1/admin/orders?${params.toString()}`);
}

export function getOrderDetail(id: string) {
  return apiClient.get<{
    order: OrderInternalDto;
    integrationAttempts: IntegrationAttemptDto[];
    notes: OrderNoteDto[];
    auditLog: AuditLogDto[];
  }>(`/api/v1/admin/orders/${id}`);
}

export function assignOperator(orderId: string, operatorId: string | null) {
  return apiClient.patch<OrderInternalDto>(`/api/v1/admin/orders/${orderId}/assigned-operator`, {
    operatorId,
  });
}

export function addOrderNote(orderId: string, body: string) {
  return apiClient.post<OrderNoteDto>(`/api/v1/admin/orders/${orderId}/notes`, { body });
}

export function listOperators() {
  return apiClient.get<AdminOperatorDto[]>('/api/v1/admin/operators');
}
