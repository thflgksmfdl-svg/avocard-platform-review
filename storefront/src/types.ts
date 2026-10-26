export interface SkuAttribute { attributeId: string; name: string; nameTrans?: string; value: string; valueTrans?: string; imageUrl?: string }
export interface Sku { skuId: string; attributes: SkuAttribute[]; priceCny: string; stock?: number }
export interface ProductDetail { offerId: string; titleZh: string; titleTrans?: string; imageUrls: string[]; sourceUrl?: string; moq?: number; skus: Sku[]; priceTiers: Array<{ startQuantity: number; priceCny: string }> }
export interface Profile { id: string; isImpersonated?: boolean }
export interface Address { id: string; addressType: 'PERSONAL' | 'BUSINESS'; label: string; recipientName: string | null; recipientPhone: string | null; customsClearanceNo: string | null; businessName: string | null; businessNo: string | null; postalCode: string; address: string; addressDetail: string | null; isDefault: boolean }
export type CartItemSubmissionStatus =
  | 'NORMAL'
  | 'CREATE_PROCESSING'
  | 'CREATE_FAILED_RETRY_AVAILABLE'
  | 'CREATE_FAILED_ACTION_REQUIRED'
  | 'CREATE_FAILED_SUPPORT_REQUIRED'
  | 'CREATE_RESULT_UNKNOWN'
  | 'CREATE_MATERIALIZING';
export interface CartItemDto { id: string; offerId: string; skuId: string; titleZh: string; titleKo?: string | null; imageUrl?: string | null; productUrl?: string | null; videoUrl?: string | null; optionSnapshot: SkuAttribute[]; qty: number; cnyUnitPrice: string; stockSnapshot?: number | null; productSnapshotVersion: string; submissionStatus: CartItemSubmissionStatus; submissionRequestId: string | null; failureReason: string | null; locked: boolean }
export interface CartDto { expiresAt: string | null; items: CartItemDto[] }
// `key` mirrors the server item id; kept as a separate field only so cart.tsx
// and its callers don't need to say `.id` vs `.key` depending on context.
export interface CartItem extends CartItemDto { key: string }
export interface CartRevalidationIssue { itemId: string; offerId: string; skuId: string; reason: string }
export interface CartRevalidationResult { ok: boolean; issues: CartRevalidationIssue[] }
export interface OrderItemDto { id: string; titleZh: string; titleKo: string | null; imageUrl: string | null; qty: number; cnyUnitPrice: string; cnyAmount: string; negotiationStatus: string; refundStatus: string | null }
export interface OrderDto { id: string; orderNo: string; customerStatus: string; customsType: string; transportMode: string; paymentMethod: string | null; submittedAt: string | null; items: OrderItemDto[] }
export interface OrderListPage { items: OrderDto[]; page: number; pageSize: number; total: number }
export interface FailedSubmissionRequest { submissionRequestId: string; sellerId: string; reason: string; canRetry: boolean }
export interface PendingOrMaterializingRequest { submissionRequestId: string; sellerId: string }
export interface SubmitCartResponse {
  createdOrders: OrderDto[];
  failedRequests: FailedSubmissionRequest[];
  pendingReconciliation: PendingOrMaterializingRequest[];
  materializingRequests: PendingOrMaterializingRequest[];
}
export type RetryOutcome =
  | { outcome: 'created'; order: OrderDto }
  | { outcome: 'failed'; reason: string; canRetry: false }
  | { outcome: 'pending_reconciliation' }
  | { outcome: 'materializing' };
