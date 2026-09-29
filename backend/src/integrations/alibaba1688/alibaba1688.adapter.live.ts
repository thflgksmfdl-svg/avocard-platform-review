import { Alibaba1688MissingCredentialError, NotImplementedError } from '../../shared/errors.js';
import { callAlibaba1688Api, type Alibaba1688GatewayConfig } from './alibaba1688.gateway-client.js';
import { normalizeOrderId } from './alibaba1688.order-id.js';
import { normalizeOpaqueId } from './alibaba1688.opaque-id.js';
import type {
  Alibaba1688Port,
  BuyerViewOrder,
  BuyerViewOrderItem,
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

// --- Raw response shapes from alibaba.trade.get.buyerView, captured from a
// live call against a real pre-existing order (2026-09-29), orderId =
// baseInfo.idOfStr, access_token = the MAIN account token (confirmed the
// only combination that succeeds — see the class-level token-selection rule
// below). Only the fields this adapter actually reads are typed; the real
// response has more (nativeLogistics, orderRateInfo, tradeTerms,
// orderBizInfo, guaranteesTerms, etc.) that AVOCARD does not currently need
// — and this exact field list was captured from a response that was itself
// truncated mid-stream during capture, so productItems[] in particular may
// have additional fields not listed here; treat this as the confirmed
// minimum, not a guaranteed-complete schema.
interface RawBuyerViewProductItem {
  productID: number | string;
  skuID?: number | string;
  name: string;
  price: number | string;
  quantity: number;
  status: string;
  productImgUrl?: string[];
}
interface RawBuyerViewBaseInfo {
  id: number | string;
  idOfStr: string;
  status: string;
  totalAmount: number | string;
  payTimeout: number;
  payTimeoutType: number;
  tradeTypeCode?: string;
  tradeTypeDesc?: string;
  createTime: string;
  buyerLoginId?: string;
  sellerLoginId?: string;
}
interface RawBuyerViewResult {
  baseInfo: RawBuyerViewBaseInfo;
  productItems?: RawBuyerViewProductItem[];
}
interface RawGetBuyerViewEnvelope {
  result?: RawBuyerViewResult;
  // Confirmed live: 1688 returns `success` as a STRING ("false") on error
  // responses for this API, not a boolean — do not compare with `=== false`.
  success?: string | boolean;
  errorCode?: string;
  errorMessage?: string;
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

function mapBuyerViewProductItem(raw: RawBuyerViewProductItem): BuyerViewOrderItem {
  return {
    // productId/skuId are product-catalog identifiers, not order
    // identifiers — normalizeOpaqueId() directly, not normalizeOrderId()
    // (which is order-id-specific and throws on any detected precision
    // risk; product/sku ids carry lower stakes here, so we surface the
    // parsed string even if possiblyLossy rather than hard-failing the
    // whole order lookup over a line-item's product id).
    productId: normalizeOpaqueId(raw.productID, 'buyerView.productItems[].productID').value,
    skuId: raw.skuID === undefined ? undefined : normalizeOpaqueId(raw.skuID, 'buyerView.productItems[].skuID').value,
    name: raw.name,
    priceCny: String(raw.price),
    quantity: raw.quantity,
    status: raw.status,
    imageUrls: raw.productImgUrl ?? [],
  };
}

function mapBuyerViewOrder(result: RawBuyerViewResult): BuyerViewOrder {
  const { baseInfo } = result;

  // baseInfo.id: kept as a best-effort, POSSIBLY-LOSSY observed value for
  // cross-reference/display only — never as a query key. It is a 19-digit
  // integer that can already be corrupted by the time it reaches this
  // function (JSON.parse/Response.json() itself can lose precision on such
  // values before any application code runs) — String(number) here is
  // "string-ify whatever we observed after parsing," not "recover 1688's
  // original exact digits." idOfStr below is the field with no such risk
  // (it arrives as a JSON string, confirmed in the live response) and is
  // the only field that should ever be used to query this API again.
  const idNormalized = normalizeOpaqueId(baseInfo.id, 'buyerView.baseInfo.id');

  return {
    id: idNormalized.value,
    idOfStr: normalizeOrderId(baseInfo.idOfStr),
    status: baseInfo.status,
    totalAmountCny: String(baseInfo.totalAmount),
    payTimeoutSeconds: baseInfo.payTimeout,
    payTimeoutType: baseInfo.payTimeoutType,
    tradeTypeCode: baseInfo.tradeTypeCode,
    tradeTypeDesc: baseInfo.tradeTypeDesc,
    createTime: baseInfo.createTime,
    buyerLoginId: baseInfo.buyerLoginId,
    sellerLoginId: baseInfo.sellerLoginId,
    items: (result.productItems ?? []).map(mapBuyerViewProductItem),
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
  /**
   * Verified live (2026-09-29) against a real, pre-existing order. Confirmed:
   *   - Requires mainAccountAccessToken — subAccountAccessToken gets
   *     PEMISSION_ERROR (1688's own misspelling) even with the correct
   *     identifier.
   *   - `idOfStr` must be used as the orderId query param — `baseInfo.id`
   *     is NOT recognized by this API at all (NOT_EXIST_DATA).
   * Only queryProductDetail and this method are implemented; every other
   * port method still throws NotImplementedError.
   */
  async getBuyerViewOrder(idOfStr: string): Promise<BuyerViewOrder> {
    if (!this.config.mainAccountAccessToken) {
      throw new Alibaba1688MissingCredentialError(
        'getBuyerViewOrder requires ALIBABA_1688_MAIN_ACCESS_TOKEN to be configured — ' +
          'subAccountAccessToken is confirmed insufficient for this API (PEMISSION_ERROR).',
      );
    }

    // idOfStr must already be a validated string order id — reject anything
    // that isn't (empty string, etc.) before spending a network call on it.
    const normalizedIdOfStr = normalizeOrderId(idOfStr);

    // Token: mainAccountAccessToken — confirmed working for getBuyerView (2026-09-29).
    const result = await callAlibaba1688Api<RawGetBuyerViewEnvelope>(
      this.config,
      'com.alibaba.trade',
      'alibaba.trade.get.buyerView',
      {
        access_token: this.config.mainAccountAccessToken,
        webSite: '1688',
        orderId: normalizedIdOfStr,
      },
    );

    const envelope = result.body;
    if (envelope.errorCode) {
      throw new Error(`1688 getBuyerView failed: ${envelope.errorCode} ${envelope.errorMessage ?? ''}`);
    }
    if (!envelope.result?.baseInfo) {
      throw new Error(
        `1688 getBuyerView returned an unexpected shape: ${JSON.stringify(envelope).slice(0, 500)}`,
      );
    }

    return mapBuyerViewOrder(envelope.result);
  }
  // TODO: token unconfirmed for getLogisticsInfos.buyerView / getLogisticsTraceInfo.buyerView.
  async getLogisticsInfo(_alibabaOrderId: string): Promise<LogisticsInfo[]> {
    throw new NotImplementedError(NOT_IMPLEMENTED);
  }
}
