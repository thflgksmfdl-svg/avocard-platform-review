/**
 * 1688 API port. Method names follow 04_API_INTEGRATION_SPEC.md §2.1's MVP-tagged
 * endpoints. No implementation exists yet in this slice — see alibaba1688.adapter.stub.ts.
 */
export interface Alibaba1688Port {
  searchByKeyword(input: KeywordSearchInput): Promise<ProductSummary[]>;
  searchByImage(input: ImageSearchInput): Promise<ProductSummary[]>;
  queryProductDetail(offerId: string): Promise<ProductDetail>;
  estimateFreight(input: FreightEstimateInput): Promise<FreightEstimate>;
  previewOrder(input: PreviewOrderInput): Promise<OrderPreview>;
  createCrossOrder(input: CreateCrossOrderInput): Promise<CreateCrossOrderResult>;
  getBuyerViewOrder(alibabaOrderId: string): Promise<BuyerViewOrder>;
  getLogisticsInfo(alibabaOrderId: string): Promise<LogisticsInfo[]>;
}

export interface KeywordSearchInput {
  keyword: string;
  page?: number;
}
export interface ImageSearchInput {
  imageUrl: string;
}
export interface ProductSummary {
  offerId: string;
  titleZh: string;
  titleKo?: string;
  imageUrl?: string;
  priceCny: string;
}
export interface ProductDetail extends ProductSummary {
  skus: Array<{ skuId: string; color?: string; size?: string; priceCny: string; stock?: number }>;
  moq?: number;
  videoUrl?: string;
  sourceUrl?: string;
}
export interface FreightEstimateInput {
  offerId: string;
  skuId?: string;
  qty: number;
}
export interface FreightEstimate {
  freightCny: string;
}
export interface PreviewOrderInput {
  sellerId: string;
  items: Array<{ offerId: string; skuId?: string; qty: number }>;
}
export interface OrderPreview {
  valid: boolean;
  issues?: string[];
}
export interface CreateCrossOrderInput {
  businessKey: string;
  sellerId: string;
  items: Array<{ offerId: string; skuId?: string; qty: number; unitPriceCny: string }>;
}
export interface CreateCrossOrderResult {
  alibabaOrderId: string;
}
export interface BuyerViewOrder {
  alibabaOrderId: string;
  status: string;
}
export interface LogisticsInfo {
  trackingNo: string;
  carrier?: string;
}
