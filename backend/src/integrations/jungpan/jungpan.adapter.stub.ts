import { NotImplementedError } from '../../shared/errors.js';
import type {
  JungpanChargeDetail,
  JungpanCharge,
  JungpanCodeItem,
  JungpanCreateOrderInput,
  JungpanCreateOrderResult,
  JungpanInspectionPhoto,
  JungpanOrderDetail,
  JungpanOrderListFilter,
  JungpanOrderListItem,
  JungpanOrderProduct,
  JungpanPaymentNotification,
  JungpanPaymentResult,
  JungpanPort,
} from './jungpan.port.js';

export interface JungpanAdapterConfig {
  baseUrl: string;
  siteCd: string;
  apiKey: string;
}

const NOT_CONFIGURED_HINT =
  '중판(Jungpan) API credentials (JUNGPAN_BASE_URL / JUNGPAN_SITE_CD / JUNGPAN_API_KEY) ' +
  'are not set. See docs/agent-handoff/AVOCARD_AGENT_HANDOFF/08_OPEN_QUESTIONS_AND_BLOCKERS.md ' +
  'item P0-6 / 23.';

/**
 * Stub adapter: no live HTTP calls are made in this slice. Every method
 * throws NotImplementedError so callers cannot mistake a stub response for a
 * real one. When credentials arrive, implement and verify the read-only (GET)
 * methods first — write methods (createOrder, notifyPayment) must not be
 * called against the test server until their effect is explicitly confirmed.
 */
export class JungpanStubAdapter implements JungpanPort {
  constructor(private readonly config: JungpanAdapterConfig) {}

  private notImplemented(operation: string): never {
    const configured = Boolean(this.config.baseUrl && this.config.siteCd && this.config.apiKey);
    throw new NotImplementedError(
      configured
        ? `Jungpan adapter method "${operation}" is not implemented yet.`
        : `Jungpan adapter method "${operation}" is not implemented yet. ${NOT_CONFIGURED_HINT}`,
    );
  }

  async getAuth(): Promise<{ ok: boolean }> {
    this.notImplemented('getAuth');
  }
  async getDlvrTypes(): Promise<JungpanCodeItem[]> {
    this.notImplemented('getDlvrTypes');
  }
  async getConsAddrTypes(): Promise<JungpanCodeItem[]> {
    this.notImplemented('getConsAddrTypes');
  }
  async getCtmsTypes(): Promise<JungpanCodeItem[]> {
    this.notImplemented('getCtmsTypes');
  }
  async getCtmsList(): Promise<JungpanCodeItem[]> {
    this.notImplemented('getCtmsList');
  }
  async getOrderStatus(): Promise<JungpanCodeItem[]> {
    this.notImplemented('getOrderStatus');
  }
  async getOrderList(_filter: JungpanOrderListFilter): Promise<JungpanOrderListItem[]> {
    this.notImplemented('getOrderList');
  }
  async getOrderDetail(_ordSeq: string): Promise<JungpanOrderDetail> {
    this.notImplemented('getOrderDetail');
  }
  async getOrderProducts(_ordSeq: string): Promise<JungpanOrderProduct[]> {
    this.notImplemented('getOrderProducts');
  }
  async getOrderCharges(_ordSeq: string): Promise<JungpanCharge[]> {
    this.notImplemented('getOrderCharges');
  }
  async getOrderChargeDetail(_chaSeq: string): Promise<JungpanChargeDetail[]> {
    this.notImplemented('getOrderChargeDetail');
  }
  async getInspectionPhotos(_ordSeq: string): Promise<JungpanInspectionPhoto[]> {
    this.notImplemented('getInspectionPhotos');
  }
  async createOrder(_input: JungpanCreateOrderInput): Promise<JungpanCreateOrderResult> {
    this.notImplemented('createOrder');
  }
  async notifyPayment(_input: JungpanPaymentNotification): Promise<JungpanPaymentResult> {
    this.notImplemented('notifyPayment');
  }
}
