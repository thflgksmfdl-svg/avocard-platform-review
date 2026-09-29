import { NotImplementedError } from '../../shared/errors.js';
import { callAlibaba1688Api, type Alibaba1688GatewayConfig } from './alibaba1688.gateway-client.js';
import type {
  Alibaba1688Port,
  BuyerViewOrder,
  CreateCrossOrderInput,
  CreateCrossOrderResult,
  FreightEstimate,
  FreightEstimateInput,
  ImageSearchInput,
  KeywordSearchInput,
  LogisticsInfo,
  OrderPreview,
  PreviewOrderInput,
  PriceTier,
  ProductDetail,
  ProductSummary,
  QueryProductDetailInput,
  SellerInfo,
  SkuAttribute,
  SkuInfo,
} from './alibaba1688.port.js';

const NOT_IMPLEMENTED =
  'This 1688 API method has not been verified against a live response yet. ' +
  'Only queryProductDetail has been implemented and confirmed working ' +
  '(2026-09-29) — see alibaba1688.adapter.live.ts. createCrossOrder in ' +
  'particular must not be implemented/called without separate approval, ' +
  'since it creates a real 1688 order.';

/**
 * Separate main-account and sub-account tokens — confirmed live (2026-09-29)
 * that different 1688 APIs require different token types and are NOT
 * interchangeable: queryProductDetail succeeds only with the sub-account
 * token; alibaba.trade.get.buyerView succeeds only with the main-account
 * token (sub-account token gets PEMISSION_ERROR even with the correct order
 * identifier). Each port method must select the correct field per the
 * confirmed-or-TODO permission matrix documented on Alibaba1688LiveAdapter —
 * never assume one token works for an API that hasn't been tested.
 */
export interface Alibaba1688LiveAdapterConfig extends Alibaba1688GatewayConfig {
  /** The 1688 main account access_token — required for account-management and buyer-view APIs (confirmed: subaccount.auth.list, getBuyerView). */
  mainAccountAccessToken: string;
  /** The 1688 sub-account (子账号) access_token — required for product APIs (confirmed: queryProductDetail). */
  subAccountAccessToken: string;
}

// --- Raw response shapes from product.search.queryProductDetail, captured
// from a live call against offerId 997588458127 (2026-09-29). Only the
// fields this adapter actually reads are typed; the real response has more
// (description HTML, tagInfoList, certificateList, etc.) that AVOCARD does
// not currently need.
interface RawSkuAttribute {
  attributeId: number | string;
  attributeName: string;
  attributeNameTrans?: string;
  value: string;
  valueTrans?: string;
  skuImageUrl?: string;
}
interface RawSkuInfo {
  skuId: number | string;
  price: string;
  consignPrice?: string;
  fenxiaoPriceInfo?: { offerPrice?: string };
  amountOnSale?: number;
  cargoNumber?: string;
  skuAttributes?: RawSkuAttribute[];
}
interface RawShippingDetail {
  skuId: string;
  width?: number;
  length?: number;
  height?: number;
  weight?: number;
}
interface RawPriceRangeEntry {
  startQuantity: number;
  price: string;
}
interface RawSellerDataInfo {
  tradeMedalLevel?: string;
  compositeServiceScore?: string;
  repeatPurchasePercent?: string;
  disputeComplaintScore?: string;
}
interface RawProductDetailResult {
  offerId: number | string;
  subject: string;
  subjectTrans?: string;
  productImage?: { images?: string[] };
  mainVideo?: string;
  promotionUrl?: string;
  minOrderQuantity?: number;
  status?: string;
  sendGoodsAddressText?: string;
  sellerOpenId?: string;
  companyName?: string;
  sellerDataInfo?: RawSellerDataInfo;
  productSkuInfos?: RawSkuInfo[];
  productSaleInfo?: { priceRangeList?: RawPriceRangeEntry[] };
  productShippingInfo?: { sendGoodsAddressText?: string; skuShippingDetails?: RawShippingDetail[] };
}
interface RawQueryProductDetailEnvelope {
  result?: {
    success?: boolean;
    code?: string;
    message?: string;
    result?: RawProductDetailResult;
  };
  error_code?: string;
  error_message?: string;
}

function mapSkuAttribute(raw: RawSkuAttribute): SkuAttribute {
  return {
    attributeId: String(raw.attributeId),
    name: raw.attributeName,
    nameTrans: raw.attributeNameTrans,
    value: raw.value,
    valueTrans: raw.valueTrans,
    imageUrl: raw.skuImageUrl,
  };
}

function mapSku(raw: RawSkuInfo, shippingBySkuId: Map<string, RawShippingDetail>): SkuInfo {
  const shipping = shippingBySkuId.get(String(raw.skuId));
  return {
    skuId: String(raw.skuId),
    attributes: (raw.skuAttributes ?? []).map(mapSkuAttribute),
    priceCny: raw.price,
    consignPriceCny: raw.consignPrice,
    distributorPriceCny: raw.fenxiaoPriceInfo?.offerPrice,
    stock: raw.amountOnSale,
    cargoNumber: raw.cargoNumber || undefined,
    weightKg: shipping?.weight,
    widthCm: shipping?.width,
    lengthCm: shipping?.length,
    heightCm: shipping?.height,
  };
}

function mapPriceTier(raw: RawPriceRangeEntry): PriceTier {
  return { startQuantity: raw.startQuantity, priceCny: raw.price };
}

function mapSeller(result: RawProductDetailResult): SellerInfo | undefined {
  if (!result.sellerOpenId && !result.companyName && !result.sellerDataInfo) {
    return undefined;
  }
  return {
    sellerOpenId: result.sellerOpenId,
    companyName: result.companyName,
    tradeMedalLevel: result.sellerDataInfo?.tradeMedalLevel,
    compositeServiceScore: result.sellerDataInfo?.compositeServiceScore,
    repeatPurchasePercent: result.sellerDataInfo?.repeatPurchasePercent,
    disputeComplaintScore: result.sellerDataInfo?.disputeComplaintScore,
  };
}

function mapProductDetail(result: RawProductDetailResult): ProductDetail {
  const shippingBySkuId = new Map(
    (result.productShippingInfo?.skuShippingDetails ?? []).map((d) => [String(d.skuId), d]),
  );

  return {
    offerId: String(result.offerId),
    titleZh: result.subject,
    titleTrans: result.subjectTrans,
    imageUrls: result.productImage?.images ?? [],
    videoUrl: result.mainVideo || undefined,
    sourceUrl: result.promotionUrl,
    moq: result.minOrderQuantity,
    skus: (result.productSkuInfos ?? []).map((sku) => mapSku(sku, shippingBySkuId)),
    priceTiers: (result.productSaleInfo?.priceRangeList ?? []).map(mapPriceTier),
    seller: mapSeller(result),
    shipFromText: result.productShippingInfo?.sendGoodsAddressText ?? result.sendGoodsAddressText,
    status: result.status,
  };
}

/**
 * Live 1688 adapter. Only queryProductDetail is implemented and has been
 * verified against the real gw.open.1688.com gateway (2026-09-29, offerId
 * 997588458127, country=en and country=ko both returned real translated
 * data). Every other method still throws NotImplementedError — in
 * particular createCrossOrder must not be implemented here without
 * separate, explicit approval, since it creates a real order on 1688.
 *
 * Token-selection rule (confirmed live, 2026-09-29 — do NOT wire an
 * unconfirmed API to either token by guessing; add a TODO instead):
 *   - queryProductDetail        → subAccountAccessToken (confirmed working)
 *   - subaccount.auth.list      → mainAccountAccessToken (confirmed working, see verify-1688-signing.ts)
 *   - alibaba.trade.get.buyerView → mainAccountAccessToken (confirmed working;
 *     subAccountAccessToken confirmed to FAIL with PEMISSION_ERROR even when
 *     given the correct order identifier — not implemented here yet, see
 *     getBuyerViewOrder below)
 *   - createOrder.preview, getBuyerOrderList → both tokens reached the API
 *     (auth succeeded with either), but this is NOT the same as a confirmed
 *     fully-successful call with both — treat as inconclusive, not "either works"
 *   - createCrossOrder, cancel, getLogisticsInfos.buyerView,
 *     getLogisticsTraceInfo.buyerView, memoAdd → UNCONFIRMED for either
 *     token; do not implement/call with a guessed token, verify live first
 *
 * Order identifiers (1688's `idOfStr`, confirmed 2026-09-29 as the correct
 * query key for getBuyerView — NOT `baseInfo.id`, which getBuyerView does
 * not recognize at all) must stay `string` end-to-end. `idOfStr` values are
 * 19-digit integers that exceed Number.MAX_SAFE_INTEGER — never call
 * Number()/parseInt() or do arithmetic on an order identifier anywhere in
 * this file or its callers. This does NOT apply to product-catalog numeric
 * IDs like offerId/skuId (7-13 digits, within safe integer range, and
 * 1688's own queryProductDetail request schema requires offerId as a JSON
 * number) — the Number(input.offerId) call below is intentional and
 * unrelated to the order-identifier precision concern.
 */
export class Alibaba1688LiveAdapter implements Alibaba1688Port {
  constructor(private readonly config: Alibaba1688LiveAdapterConfig) {}

  async queryProductDetail(input: QueryProductDetailInput): Promise<ProductDetail> {
    const offerDetailParam = JSON.stringify({
      offerId: Number(input.offerId),
      country: input.country ?? 'ko',
    });

    // Token: subAccountAccessToken — confirmed working for queryProductDetail (2026-09-29).
    const result = await callAlibaba1688Api<RawQueryProductDetailEnvelope>(
      this.config,
      'com.alibaba.fenxiao.crossborder',
      'product.search.queryProductDetail',
      {
        access_token: this.config.subAccountAccessToken,
        offerDetailParam,
      },
      { method: 'POST' },
    );

    const envelope = result.body;
    if (envelope.error_code) {
      throw new Error(`1688 queryProductDetail failed: ${envelope.error_code} ${envelope.error_message ?? ''}`);
    }
    if (envelope.result?.success !== true || !envelope.result.result) {
      throw new Error(
        `1688 queryProductDetail returned an unexpected shape: ${JSON.stringify(envelope).slice(0, 500)}`,
      );
    }

    return mapProductDetail(envelope.result.result);
  }

  // TODO: token unconfirmed for this API — do not implement/call with a
  // guessed token, verify live first (see class-level token-selection rule).
  async searchByKeyword(_input: KeywordSearchInput): Promise<ProductSummary[]> {
    throw new NotImplementedError(NOT_IMPLEMENTED);
  }
  // TODO: token unconfirmed for this API — see class-level token-selection rule.
  async searchByImage(_input: ImageSearchInput): Promise<ProductSummary[]> {
    throw new NotImplementedError(NOT_IMPLEMENTED);
  }
  // TODO: token unconfirmed for this API — see class-level token-selection rule.
  async estimateFreight(_input: FreightEstimateInput): Promise<FreightEstimate> {
    throw new NotImplementedError(NOT_IMPLEMENTED);
  }
  // TODO: createOrder.preview reached param-validation with BOTH tokens live
  // (2026-09-29), but that only proves auth succeeded, not that a fully
  // successful call behaves identically with both — do not assume either
  // token is "confirmed" for this API until a real successful preview call
  // has been observed with each token separately.
  async previewOrder(_input: PreviewOrderInput): Promise<OrderPreview> {
    throw new NotImplementedError(NOT_IMPLEMENTED);
  }
  // TODO: createCrossOrder must not be implemented/called without separate,
  // explicit approval — it creates a real 1688 order. Token unconfirmed.
  async createCrossOrder(_input: CreateCrossOrderInput): Promise<CreateCrossOrderResult> {
    throw new NotImplementedError(NOT_IMPLEMENTED);
  }
  // TODO: alibaba.trade.get.buyerView confirmed live (2026-09-29) to require
  // mainAccountAccessToken and the order's `idOfStr` field as the orderId
  // query param (NOT `baseInfo.id` — that field is not recognized at all).
  // Not implemented here yet — out of scope for this change; implement as a
  // separate, explicit task. When implemented, this identifier must be
  // handled as `string` end-to-end (idOfStr is a 19-digit integer that
  // exceeds Number.MAX_SAFE_INTEGER — never Number()/parseInt() it).
  //
  // DESIGN NOTE for that future implementation (not yet built — this is a
  // proposal, no getBuyerView call exists here): main-token-requiring
  // methods must fail with an explicit, distinguishable credential error
  // when this.config.mainAccountAccessToken is empty, rather than sending a
  // request with an empty access_token and letting 1688 return whatever
  // generic auth error it happens to give for that case (untested — 1688's
  // behavior for a blank access_token has not been observed live). Proposed
  // shape: a dedicated error type/class (e.g. `Alibaba1688MissingCredentialError`,
  // alongside the existing `NotImplementedError` in ../../shared/errors.ts)
  // thrown BEFORE the network call — `if (!this.config.mainAccountAccessToken) throw new
  // Alibaba1688MissingCredentialError('getBuyerView requires ALIBABA_1688_MAIN_ACCESS_TOKEN')`
  // — so a missing env var produces a clear, greppable error distinct from
  // both NotImplementedError (method not built) and a real 1688 API error
  // (method built, call failed). This keeps the existing pattern where
  // missing sub-account config falls back to the stub adapter at boot time
  // (app.ts's buildAlibaba1688Adapter) consistent for the main-token case
  // too, but at call time instead of boot time, since only some methods on
  // this adapter need the main token while others (queryProductDetail) don't.
  async getBuyerViewOrder(_alibabaOrderId: string): Promise<BuyerViewOrder> {
    throw new NotImplementedError(NOT_IMPLEMENTED);
  }
  // TODO: token unconfirmed for getLogisticsInfos.buyerView / getLogisticsTraceInfo.buyerView.
  async getLogisticsInfo(_alibabaOrderId: string): Promise<LogisticsInfo[]> {
    throw new NotImplementedError(NOT_IMPLEMENTED);
  }
}
