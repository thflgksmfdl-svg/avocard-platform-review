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

export interface Alibaba1688LiveAdapterConfig extends Alibaba1688GatewayConfig {
  /** The 1688 sub-account (子账号) access_token — required for product/order APIs. */
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
 */
export class Alibaba1688LiveAdapter implements Alibaba1688Port {
  constructor(private readonly config: Alibaba1688LiveAdapterConfig) {}

  async queryProductDetail(input: QueryProductDetailInput): Promise<ProductDetail> {
    const offerDetailParam = JSON.stringify({
      offerId: Number(input.offerId),
      country: input.country ?? 'ko',
    });

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

  async searchByKeyword(_input: KeywordSearchInput): Promise<ProductSummary[]> {
    throw new NotImplementedError(NOT_IMPLEMENTED);
  }
  async searchByImage(_input: ImageSearchInput): Promise<ProductSummary[]> {
    throw new NotImplementedError(NOT_IMPLEMENTED);
  }
  async estimateFreight(_input: FreightEstimateInput): Promise<FreightEstimate> {
    throw new NotImplementedError(NOT_IMPLEMENTED);
  }
  async previewOrder(_input: PreviewOrderInput): Promise<OrderPreview> {
    throw new NotImplementedError(NOT_IMPLEMENTED);
  }
  async createCrossOrder(_input: CreateCrossOrderInput): Promise<CreateCrossOrderResult> {
    throw new NotImplementedError(NOT_IMPLEMENTED);
  }
  async getBuyerViewOrder(_alibabaOrderId: string): Promise<BuyerViewOrder> {
    throw new NotImplementedError(NOT_IMPLEMENTED);
  }
  async getLogisticsInfo(_alibabaOrderId: string): Promise<LogisticsInfo[]> {
    throw new NotImplementedError(NOT_IMPLEMENTED);
  }
}
