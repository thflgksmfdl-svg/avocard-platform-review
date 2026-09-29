/**
 * 1688 API port. Method names follow 04_API_INTEGRATION_SPEC.md §2.1's MVP-tagged
 * endpoints. queryProductDetail's shape (ProductDetail, SkuInfo, SellerInfo) was
 * redesigned 2026-09-29 against a real product.search.queryProductDetail
 * response (verified live via a sub-account access_token) — see
 * alibaba1688.adapter.live.ts's field-mapping comments for the exact response
 * paths each field comes from. createCrossOrder/previewOrder/estimateFreight/
 * getBuyerViewOrder/getLogisticsInfo/searchByKeyword/searchByImage remain
 * unimplemented (still throw via alibaba1688.adapter.stub.ts) — no live
 * response has been captured for them yet, and createCrossOrder specifically
 * has not been called against the live API by user instruction (order
 * creation requires separate approval).
 */
export interface Alibaba1688Port {
  searchByKeyword(input: KeywordSearchInput): Promise<ProductSummary[]>;
  searchByImage(input: ImageSearchInput): Promise<ProductSummary[]>;
  queryProductDetail(input: QueryProductDetailInput): Promise<ProductDetail>;
  estimateFreight(input: FreightEstimateInput): Promise<FreightEstimate>;
  previewOrder(input: PreviewOrderInput): Promise<OrderPreview>;
  createCrossOrder(input: CreateCrossOrderInput): Promise<CreateCrossOrderResult>;
  /** idOfStr must be 1688's baseInfo.idOfStr (confirmed 2026-09-29) — NOT baseInfo.id. */
  getBuyerViewOrder(idOfStr: string): Promise<BuyerViewOrder>;
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

/**
 * `country` selects the translated-language fields in the 1688 response
 * (subjectTrans, attributeNameTrans/valueTrans, etc.) — verified live that
 * `country: 'ko'` returns real Korean translations (09_CANONICAL_DECISIONS.md
 * "1688 제공 번역만 사용... 한국어 전환 버튼 제공"), not just 'en'.
 */
export interface QueryProductDetailInput {
  offerId: string;
  country?: 'ko' | 'en' | 'zh';
}

/**
 * One arbitrary SKU-distinguishing attribute (1688 calls it a "sku attribute"),
 * e.g. {name: "规格", value: "MC-024窗户挡水条通用-宽4.3cm-0.5米"}. 1688 does NOT
 * guarantee a fixed "color"/"size" split — a single attribute like "规格"
 * (specification) commonly encodes both together, and multiple attributes
 * with the same attributeId can repeat across SKUs. Do not force this into a
 * {color, size} shape; consumers that need color/size specifically must parse
 * `name`/`nameTrans` themselves per-product.
 */
export interface SkuAttribute {
  attributeId: string;
  name: string;
  nameTrans?: string;
  value: string;
  valueTrans?: string;
  imageUrl?: string;
}

/**
 * `priceCny` is queryProductDetail's `productSkuInfos[].price` — the price
 * actually charged per this SKU per 1688's own listing. `consignPriceCny`
 * and `distributorPriceCny` mirror the response's `consignPrice` and
 * `fenxiaoPriceInfo.offerPrice` fields, which were numerically identical to
 * `price` in the one product tested (997588458127) but are surfaced
 * separately since 1688 does not document a guarantee they always match —
 * AVOCARD's price-quoting logic should pick one canonical field (recommend
 * `priceCny`) and treat the others as informational/audit-only until more
 * products are sampled.
 */
export interface SkuInfo {
  skuId: string;
  attributes: SkuAttribute[];
  priceCny: string;
  consignPriceCny?: string;
  distributorPriceCny?: string;
  stock?: number;
  cargoNumber?: string;
  weightKg?: number;
  widthCm?: number;
  lengthCm?: number;
  heightCm?: number;
}

/** One entry of queryProductDetail's productSaleInfo.priceRangeList — MOQ-tiered pricing. */
export interface PriceTier {
  startQuantity: number;
  priceCny: string;
}

/**
 * Seller reputation/volume metrics from queryProductDetail's sellerDataInfo,
 * required by 09_CANONICAL_DECISIONS.md "판매자 등급·거래량·재구매율 표시" —
 * previously entirely absent from this port.
 */
export interface SellerInfo {
  sellerOpenId?: string;
  companyName?: string;
  tradeMedalLevel?: string;
  compositeServiceScore?: string;
  repeatPurchasePercent?: string;
  disputeComplaintScore?: string;
}

export interface ProductDetail {
  offerId: string;
  titleZh: string;
  titleTrans?: string;
  imageUrls: string[];
  videoUrl?: string;
  sourceUrl?: string;
  moq?: number;
  skus: SkuInfo[];
  priceTiers: PriceTier[];
  seller?: SellerInfo;
  shipFromText?: string;
  status?: string;
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
export interface BuyerViewOrderItem {
  /**
   * 1688's productItems[].productID, coerced to string. Product/sku ids
   * carry lower stakes than order ids if occasionally imprecise — see
   * alibaba1688.opaque-id.ts.
   */
  productId: string;
  skuId?: string;
  name: string;
  priceCny: string;
  quantity: number;
  status: string;
  imageUrls: string[];
}

/**
 * Verified live (2026-09-29) against a real alibaba.trade.get.buyerView
 * response, called with orderId = idOfStr + the main-account token (the
 * ONLY combination confirmed to succeed — see alibaba1688.adapter.live.ts's
 * token-selection rule).
 */
export interface BuyerViewOrder {
  /**
   * 1688's baseInfo.id, coerced to string. This is a PARSED, POSSIBLY-LOSSY
   * OBSERVED VALUE, NOT a guaranteed-accurate copy of 1688's original digits
   * — baseInfo.id is a 19-digit integer that exceeds
   * Number.MAX_SAFE_INTEGER, and standard JSON parsing (JSON.parse /
   * Response.json(), which this adapter's gateway client uses) can already
   * corrupt such values before any application code runs. Keep this field
   * for cross-reference/display only; never use it to query getBuyerView or
   * any other API — use `idOfStr` for that.
   */
  id: string;
  /**
   * 1688's baseInfo.idOfStr — the CONFIRMED correct, string-safe query key
   * for alibaba.trade.get.buyerView (confirmed 2026-09-29; baseInfo.id is
   * NOT recognized by that API at all). Always a JSON string in the
   * observed response, so it never crosses the numeric-precision boundary
   * that `id` above does.
   */
  idOfStr: string;
  status: string;
  totalAmountCny: string;
  /** Seconds. Never convert to a day count or hardcode a substitute — store and display as-is. */
  payTimeoutSeconds: number;
  /** Integer code; meaning unconfirmed as of 2026-09-29. Store as-is. */
  payTimeoutType: number;
  tradeTypeCode?: string;
  tradeTypeDesc?: string;
  /** 1688's own timestamp format (e.g. "20260929135647000+0800"), NOT ISO 8601 — not parsed/converted here. */
  createTime: string;
  buyerLoginId?: string;
  sellerLoginId?: string;
  items: BuyerViewOrderItem[];
}
export interface LogisticsInfo {
  trackingNo: string;
  carrier?: string;
}
