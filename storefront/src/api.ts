import type { Address, CartDto, CartRevalidationResult, OrderDto, OrderListPage, ProductDetail, Profile, RetryOutcome, SubmitCartResponse } from './types';

const base = import.meta.env.VITE_API_BASE_URL || '';
export class ApiError extends Error { constructor(message: string, readonly status: number) { super(message); } }

// Tab-scoped (sessionStorage, not cookie) so multiple impersonation tabs for
// different customers never cross — 09_CANONICAL_DECISIONS.md order-recovery
// addendum §5/§C. Only ever attached to /api/v1/me/* requests; it carries no
// authority over /api/v1/admin/*.
const IMPERSONATION_STORAGE_KEY = 'avocard.impersonation.credential';
const IMPERSONATION_HEADER = 'x-avocard-impersonation-credential';

export function getImpersonationCredential(): string | null {
  try { return sessionStorage.getItem(IMPERSONATION_STORAGE_KEY); } catch { return null; }
}
export function setImpersonationCredential(credential: string) {
  try { sessionStorage.setItem(IMPERSONATION_STORAGE_KEY, credential); } catch { /* ignore */ }
}
export function clearImpersonationCredential() {
  try { sessionStorage.removeItem(IMPERSONATION_STORAGE_KEY); } catch { /* ignore */ }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const devCustomer = import.meta.env.DEV ? import.meta.env.VITE_DEV_SHOPIFY_CUSTOMER_ID : undefined;
  const impersonationCredential = getImpersonationCredential();
  const response = await fetch(`${base}${path}`, { ...init, credentials: 'include', headers: { Accept: 'application/json', ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...(impersonationCredential ? { [IMPERSONATION_HEADER]: impersonationCredential } : devCustomer ? { 'x-dev-shopify-customer-id': devCustomer } : {}), ...init?.headers } });
  const body = await response.json().catch(() => undefined);
  if (!response.ok) throw new ApiError(body?.error?.message ?? '요청을 처리하지 못했습니다.', response.status);
  return body as T;
}

export const api = {
  profile: () => request<Profile>('/api/v1/me/profile'),
  addresses: () => request<Address[]>('/api/v1/me/addresses'),
  product: (offerId: string) => request<ProductDetail>(`/api/v1/catalog/products/${encodeURIComponent(offerId)}?country=ko`),
  cart: () => request<CartDto>('/api/v1/me/cart'),
  addCartItem: (input: { offerId: string; skuId: string; qty: number }) =>
    request<CartDto>('/api/v1/me/cart/items', { method: 'POST', body: JSON.stringify(input) }),
  updateCartItem: (itemId: string, qty: number) =>
    request<CartDto>(`/api/v1/me/cart/items/${encodeURIComponent(itemId)}`, { method: 'PATCH', body: JSON.stringify({ qty }) }),
  removeCartItem: (itemId: string) =>
    request<CartDto>(`/api/v1/me/cart/items/${encodeURIComponent(itemId)}`, { method: 'DELETE' }),
  revalidateCartForSubmission: () =>
    request<CartRevalidationResult>('/api/v1/me/cart/revalidate-for-submission', { method: 'POST' }),
  submitOrder: (input: { customsType: 'PERSONAL' | 'BUSINESS'; transportMode: 'SEA' | 'AIR' | 'LCL'; recipientSnapshot: Record<string, unknown>; customerMemo?: string }) =>
    request<SubmitCartResponse>('/api/v1/me/orders', { method: 'POST', body: JSON.stringify(input) }),
  retrySubmissionRequest: (submissionRequestId: string, input: { customsType: 'PERSONAL' | 'BUSINESS'; transportMode: 'SEA' | 'AIR' | 'LCL'; recipientSnapshot: Record<string, unknown>; customerMemo?: string }) =>
    request<RetryOutcome>(`/api/v1/me/order-submission-requests/${encodeURIComponent(submissionRequestId)}/retry`, { method: 'POST', body: JSON.stringify(input) }),
  orders: (page = 1, pageSize = 20) =>
    request<OrderListPage>(`/api/v1/me/orders?page=${page}&pageSize=${pageSize}`),
  order: (id: string) => request<OrderDto>(`/api/v1/me/orders/${encodeURIComponent(id)}`),
  exchangeImpersonationHandoff: (handoffToken: string) =>
    request<{ credential: string; expiresAt: string }>('/api/v1/me/impersonation/exchange', { method: 'POST', body: JSON.stringify({ handoffToken }) }),
  endImpersonation: (credential: string) =>
    request<{ ok: boolean }>('/api/v1/me/impersonation/end', { method: 'POST', body: JSON.stringify({ credential }) }),
};
