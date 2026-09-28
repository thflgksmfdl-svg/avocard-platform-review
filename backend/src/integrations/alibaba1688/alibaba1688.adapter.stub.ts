import { NotImplementedError } from '../../shared/errors.js';
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
  ProductDetail,
  ProductSummary,
} from './alibaba1688.port.js';

const NOT_IMPLEMENTED =
  '1688 adapter is a stub in this slice. No live 1688 API calls are implemented yet — ' +
  'see docs/agent-handoff/AVOCARD_AGENT_HANDOFF/04_API_INTEGRATION_SPEC.md §2.';

export class Alibaba1688StubAdapter implements Alibaba1688Port {
  async searchByKeyword(_input: KeywordSearchInput): Promise<ProductSummary[]> {
    throw new NotImplementedError(NOT_IMPLEMENTED);
  }
  async searchByImage(_input: ImageSearchInput): Promise<ProductSummary[]> {
    throw new NotImplementedError(NOT_IMPLEMENTED);
  }
  async queryProductDetail(_offerId: string): Promise<ProductDetail> {
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
