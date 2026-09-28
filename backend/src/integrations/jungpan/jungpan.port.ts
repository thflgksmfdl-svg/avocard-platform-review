/**
 * 중판(Jungpan) 배송대행 API port. Method names follow
 * 04_API_INTEGRATION_SPEC.md §3's MVP-tagged endpoints.
 *
 * IMPORTANT (per user instruction): when a real implementation is added,
 * the read-only (GET) methods below must be implemented and verified against
 * the test server FIRST. Write (POST) methods — createOrder, notifyPayment —
 * create or mutate real data on the test server and must not be called until
 * their target and blast radius are explicitly confirmed. This file only
 * declares the interface; no implementation exists in this slice
 * (see jungpan.adapter.stub.ts).
 */
export interface JungpanPort {
  // --- read-only (GET) — implement/verify first ---
  getAuth(): Promise<{ ok: boolean }>;
  getDlvrTypes(): Promise<JungpanCodeItem[]>;
  getConsAddrTypes(): Promise<JungpanCodeItem[]>;
  getCtmsTypes(): Promise<JungpanCodeItem[]>;
  getCtmsList(): Promise<JungpanCodeItem[]>;
  getOrderStatus(): Promise<JungpanCodeItem[]>;
  getOrderList(filter: JungpanOrderListFilter): Promise<JungpanOrderListItem[]>;
  getOrderDetail(ordSeq: string): Promise<JungpanOrderDetail>;
  getOrderProducts(ordSeq: string): Promise<JungpanOrderProduct[]>;
  getOrderCharges(ordSeq: string): Promise<JungpanCharge[]>;
  getOrderChargeDetail(chaSeq: string): Promise<JungpanChargeDetail[]>;
  getInspectionPhotos(ordSeq: string): Promise<JungpanInspectionPhoto[]>;

  // --- write (POST) — creates/mutates real data; requires explicit approval before use ---
  createOrder(input: JungpanCreateOrderInput): Promise<JungpanCreateOrderResult>;
  notifyPayment(input: JungpanPaymentNotification): Promise<JungpanPaymentResult>;
}

export interface JungpanCodeItem {
  code: string;
  name: string;
}

export interface JungpanOrderListFilter {
  page?: number;
  pageSize?: number;
  stateCd?: string;
  orderNo?: string;
  proNo?: string;
  trkNo?: string;
  beginDate?: string;
  endDate?: string;
}

export interface JungpanOrderListItem {
  ordSeq: string;
  ordNo: string;
  partnerOrderNo?: string;
  ordStateCd: string;
  ordStateNm?: string;
  updDate?: string;
}

export interface JungpanOrderDetail {
  ordSeq: string;
  ordNo: string;
  partnerOrderNo?: string;
  ordStateCd: string;
  ivcNo?: string;
}

export interface JungpanOrderProduct {
  proNo: string;
  proIdx?: string;
  proNm?: string;
  trkNo?: string;
  arrivalStatusCode?: string;
}

export interface JungpanCharge {
  chaSeq: string;
  chaCd: string;
  chaNm?: string;
  costAmt: string;
  pmtAmt?: string;
  pmtYn: 'Y' | 'N';
}

export interface JungpanChargeDetail {
  chaSeq: string;
  detSeq: string;
  chaDetCd: string;
  chaDetNm?: string;
  costMny: string;
  krwPmtMny?: string;
}

export interface JungpanInspectionPhoto {
  picIdx: string;
  trkNo: string;
  imgUrl: string;
  picMemo?: string;
  scanDate?: string;
}

export interface JungpanCreateOrderInput {
  partnerOrderNo: string;
  dlvrTypeCd: string;
  consAddrTypeCd: string;
  ctmsTypeCd: string;
  consZip: string;
  consNm: string;
  consNmEn: string;
  consMob: string;
  consAddr: string;
  consAddrDet?: string;
  consAddrEn: string;
  consAddrDetEn?: string;
  ctmsTypeNumber: string;
  products: JungpanCreateOrderProductInput[];
}

export interface JungpanCreateOrderProductInput {
  proNm: string;
  proNmEn: string;
  proCost: string;
  proQty: number;
  currencyCd: 'CNY';
  arcSeq: string;
  imgUrl?: string;
  shopUrl?: string;
  proUrl?: string;
  shopOrdNo?: string;
}

export interface JungpanCreateOrderResult {
  ordSeq: string;
  ordNo: string;
}

export interface JungpanPaymentNotification {
  ordSeq: string;
  chaSeq: string;
  pmtMny: string;
  appNo: string;
}

export interface JungpanPaymentResult {
  ok: boolean;
}
