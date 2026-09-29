import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Alibaba1688LiveAdapter } from '../../src/integrations/alibaba1688/alibaba1688.adapter.live.js';
import { Alibaba1688MissingCredentialError } from '../../src/shared/errors.js';

/**
 * DB/network-free unit tests for Alibaba1688LiveAdapter.getBuyerViewOrder.
 * Mocks global.fetch (the only thing alibaba1688.gateway-client.ts's
 * callAlibaba1688Api calls out to) — no real 1688 API calls, no DB.
 *
 * Fixtures mirror the ACTUAL live response captured 2026-09-29 (order
 * idOfStr "3316466102248194582", id 3316466102248194600), not invented data.
 */

const baseConfig = {
  baseUrl: 'https://gw.open.1688.com',
  appKey: 'test-app-key',
  appSecret: 'test-app-secret',
};

function mockFetchOnce(status: number, body: unknown) {
  const fetchMock = vi.fn().mockResolvedValue({
    status,
    json: async () => body,
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Alibaba1688LiveAdapter.getBuyerViewOrder', () => {
  describe('credential guard', () => {
    it('throws Alibaba1688MissingCredentialError BEFORE any network call when mainAccountAccessToken is empty', async () => {
      const fetchMock = mockFetchOnce(200, {});
      const adapter = new Alibaba1688LiveAdapter({
        ...baseConfig,
        mainAccountAccessToken: '',
        subAccountAccessToken: 'sub-token-value',
      });

      await expect(adapter.getBuyerViewOrder('3316466102248194582')).rejects.toThrow(
        Alibaba1688MissingCredentialError,
      );
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('order id validation', () => {
    it('rejects an empty idOfStr before any network call', async () => {
      const fetchMock = mockFetchOnce(200, {});
      const adapter = new Alibaba1688LiveAdapter({
        ...baseConfig,
        mainAccountAccessToken: 'main-token-value',
        subAccountAccessToken: 'sub-token-value',
      });

      await expect(adapter.getBuyerViewOrder('')).rejects.toThrow(/empty string/);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('error response handling', () => {
    it('throws on an errorCode response (e.g. NOT_EXIST_DATA for baseInfo.id used as orderId)', async () => {
      mockFetchOnce(200, {
        errorCode: '004001',
        errorMessage: '{"errorCode":"004001","errorMessage":"DATA:NOT_EXIST_DATA:无法根据订单ID找到订单详情。","cause":""}',
        success: 'false',
      });
      const adapter = new Alibaba1688LiveAdapter({
        ...baseConfig,
        mainAccountAccessToken: 'main-token-value',
        subAccountAccessToken: 'sub-token-value',
      });

      await expect(adapter.getBuyerViewOrder('3316466102248194600')).rejects.toThrow(/004001/);
    });

    it('throws on a PEMISSION_ERROR response (1688\'s own misspelling, preserved as-is)', async () => {
      mockFetchOnce(200, {
        errorCode: 'PEMISSION_ERROR',
        errorMessage: '没有权限访问该订单详情(买家)。',
        success: 'false',
      });
      const adapter = new Alibaba1688LiveAdapter({
        ...baseConfig,
        mainAccountAccessToken: 'main-token-value',
        subAccountAccessToken: 'sub-token-value',
      });

      await expect(adapter.getBuyerViewOrder('3316466102248194582')).rejects.toThrow(/PEMISSION_ERROR/);
    });

    it('throws on an unexpected shape (no baseInfo, no errorCode)', async () => {
      mockFetchOnce(200, { result: {} });
      const adapter = new Alibaba1688LiveAdapter({
        ...baseConfig,
        mainAccountAccessToken: 'main-token-value',
        subAccountAccessToken: 'sub-token-value',
      });

      await expect(adapter.getBuyerViewOrder('3316466102248194582')).rejects.toThrow(/unexpected shape/);
    });
  });

  describe('successful response mapping — baseInfo.id string-vs-number precision cases', () => {
    // Real live response fields (2026-09-29), abridged to what the adapter reads.
    const realProductItem = {
      productID: 739990579926,
      skuID: undefined,
      name: 'TPE弹力带瑜伽运动加厚阻力带拉力圈橡胶力量训练快速提臀弹力圈',
      price: 6.8,
      quantity: 10,
      status: 'waitbuyerpay',
      productImgUrl: ['http://cbu01.alicdn.com/img/ibank/example.jpg'],
    };

    it('CASE A: baseInfo.id arrives as a JSON STRING (no precision boundary crossed) — value preserved exactly', async () => {
      // Simulates a hypothetical response shape where 1688 sent id as a
      // JSON string (as it does for idOfStr) — this case has NO precision
      // risk at all, since strings never round-trip through IEEE 754.
      mockFetchOnce(200, {
        result: {
          baseInfo: {
            id: '3316466102248194600',
            idOfStr: '3316466102248194582',
            status: 'waitbuyerpay',
            totalAmount: 210,
            payTimeout: 432000,
            payTimeoutType: 0,
            tradeTypeCode: 'assureTrade',
            tradeTypeDesc: '担保交易',
            createTime: '20260929135647000+0800',
            buyerLoginId: 'jungpan88',
            sellerLoginId: '金华市亚博伦体育用品有限公司',
          },
          productItems: [realProductItem],
        },
      });
      const adapter = new Alibaba1688LiveAdapter({
        ...baseConfig,
        mainAccountAccessToken: 'main-token-value',
        subAccountAccessToken: 'sub-token-value',
      });

      const order = await adapter.getBuyerViewOrder('3316466102248194582');

      // String input, no parsing boundary crossed — exact value preserved.
      expect(order.id).toBe('3316466102248194600');
      expect(order.idOfStr).toBe('3316466102248194582');
    });

    it('CASE B: baseInfo.id arrives as a JSON NUMBER that already lost precision during JSON.parse — mapped as a possibly-lossy observed value, NOT claimed exact', async () => {
      // This mirrors the ACTUAL live response: 1688 sends baseInfo.id as a
      // JSON number (3316466102248194600), a 19-digit integer that exceeds
      // Number.MAX_SAFE_INTEGER. By the time our mock's `json()` (which,
      // like Response.json() and JSON.parse, uses the standard JS number
      // parser) hands this value to the adapter, precision may already be
      // lost — this test does NOT assert the value equals the original
      // digit-for-digit, only that the adapter (a) does not throw for this
      // field specifically (unlike idOfStr, which DOES throw on unsafe
      // values via normalizeOrderId), and (b) the result is flagged/treated
      // as an observed, not-guaranteed-exact value per the port's own doc
      // comment on BuyerViewOrder.id.
      const lossyId = 3316466102248194600; // literal; JS may already round this
      mockFetchOnce(200, {
        result: {
          baseInfo: {
            id: lossyId,
            idOfStr: '3316466102248194582',
            status: 'waitbuyerpay',
            totalAmount: 210,
            payTimeout: 432000,
            payTimeoutType: 0,
            tradeTypeCode: 'assureTrade',
            tradeTypeDesc: '担保交易',
            createTime: '20260929135647000+0800',
          },
          productItems: [realProductItem],
        },
      });
      const adapter = new Alibaba1688LiveAdapter({
        ...baseConfig,
        mainAccountAccessToken: 'main-token-value',
        subAccountAccessToken: 'sub-token-value',
      });

      const order = await adapter.getBuyerViewOrder('3316466102248194582');

      // Does not throw for baseInfo.id (unlike idOfStr, which is held to a
      // stricter standard because it gates reconciliation queries) — it
      // returns a best-effort String(number) of whatever was actually
      // observed after parsing.
      expect(order.id).toBe(String(lossyId));
      expect(Number.isSafeInteger(lossyId)).toBe(false);
      // idOfStr, arriving as a string, is unaffected by this and stays exact.
      expect(order.idOfStr).toBe('3316466102248194582');
    });

    it('rejects the response outright if idOfStr itself is missing/empty (idOfStr is held to the strict order-id standard, unlike baseInfo.id)', async () => {
      mockFetchOnce(200, {
        result: {
          baseInfo: {
            id: 3316466102248194600,
            idOfStr: '',
            status: 'waitbuyerpay',
            totalAmount: 210,
            payTimeout: 432000,
            payTimeoutType: 0,
            createTime: '20260929135647000+0800',
          },
          productItems: [],
        },
      });
      const adapter = new Alibaba1688LiveAdapter({
        ...baseConfig,
        mainAccountAccessToken: 'main-token-value',
        subAccountAccessToken: 'sub-token-value',
      });

      await expect(adapter.getBuyerViewOrder('3316466102248194582')).rejects.toThrow(/empty string/);
    });

    it('maps payTimeout/payTimeoutType as-is (seconds, raw code) — never converted to a day count', async () => {
      mockFetchOnce(200, {
        result: {
          baseInfo: {
            id: '3316466102248194600',
            idOfStr: '3316466102248194582',
            status: 'waitbuyerpay',
            totalAmount: 210,
            payTimeout: 432000,
            payTimeoutType: 0,
            createTime: '20260929135647000+0800',
          },
          productItems: [],
        },
      });
      const adapter = new Alibaba1688LiveAdapter({
        ...baseConfig,
        mainAccountAccessToken: 'main-token-value',
        subAccountAccessToken: 'sub-token-value',
      });

      const order = await adapter.getBuyerViewOrder('3316466102248194582');

      expect(order.payTimeoutSeconds).toBe(432000);
      expect(order.payTimeoutType).toBe(0);
      // No derived "4일"/"5일"/days field anywhere on the result.
      expect(order).not.toHaveProperty('payTimeoutDays');
      expect(order).not.toHaveProperty('deadlineDays');
    });

    it('maps status/totalAmount/createTime verbatim without reformatting', async () => {
      mockFetchOnce(200, {
        result: {
          baseInfo: {
            id: '3316466102248194600',
            idOfStr: '3316466102248194582',
            status: 'waitbuyerpay',
            totalAmount: 210,
            payTimeout: 432000,
            payTimeoutType: 0,
            createTime: '20260929135647000+0800',
          },
          productItems: [],
        },
      });
      const adapter = new Alibaba1688LiveAdapter({
        ...baseConfig,
        mainAccountAccessToken: 'main-token-value',
        subAccountAccessToken: 'sub-token-value',
      });

      const order = await adapter.getBuyerViewOrder('3316466102248194582');

      expect(order.status).toBe('waitbuyerpay');
      expect(order.totalAmountCny).toBe('210');
      // 1688's own timestamp format is preserved, not parsed to ISO 8601.
      expect(order.createTime).toBe('20260929135647000+0800');
    });

    it('maps productItems, coercing productID/skuID to string without Number()/parseInt() corruption risk', async () => {
      mockFetchOnce(200, {
        result: {
          baseInfo: {
            id: '3316466102248194600',
            idOfStr: '3316466102248194582',
            status: 'waitbuyerpay',
            totalAmount: 210,
            payTimeout: 432000,
            payTimeoutType: 0,
            createTime: '20260929135647000+0800',
          },
          productItems: [realProductItem],
        },
      });
      const adapter = new Alibaba1688LiveAdapter({
        ...baseConfig,
        mainAccountAccessToken: 'main-token-value',
        subAccountAccessToken: 'sub-token-value',
      });

      const order = await adapter.getBuyerViewOrder('3316466102248194582');

      expect(order.items).toHaveLength(1);
      expect(order.items[0].productId).toBe('739990579926');
      expect(order.items[0].skuId).toBeUndefined();
      expect(order.items[0].name).toBe(realProductItem.name);
      expect(order.items[0].priceCny).toBe('6.8');
      expect(order.items[0].quantity).toBe(10);
      expect(order.items[0].imageUrls).toEqual(realProductItem.productImgUrl);
    });
  });

  describe('request shape', () => {
    it('calls the API with the MAIN account token, not the sub-account token', async () => {
      const fetchMock = mockFetchOnce(200, {
        result: {
          baseInfo: {
            id: '3316466102248194600',
            idOfStr: '3316466102248194582',
            status: 'waitbuyerpay',
            totalAmount: 210,
            payTimeout: 432000,
            payTimeoutType: 0,
            createTime: '20260929135647000+0800',
          },
          productItems: [],
        },
      });
      const adapter = new Alibaba1688LiveAdapter({
        ...baseConfig,
        mainAccountAccessToken: 'the-main-token',
        subAccountAccessToken: 'the-sub-token',
      });

      await adapter.getBuyerViewOrder('3316466102248194582');

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const calledUrl = fetchMock.mock.calls[0][0] as string;
      expect(calledUrl).toContain('access_token=the-main-token');
      expect(calledUrl).not.toContain('access_token=the-sub-token');
    });

    it('uses idOfStr as the orderId query param, not baseInfo.id', async () => {
      const fetchMock = mockFetchOnce(200, {
        result: {
          baseInfo: {
            id: '3316466102248194600',
            idOfStr: '3316466102248194582',
            status: 'waitbuyerpay',
            totalAmount: 210,
            payTimeout: 432000,
            payTimeoutType: 0,
            createTime: '20260929135647000+0800',
          },
          productItems: [],
        },
      });
      const adapter = new Alibaba1688LiveAdapter({
        ...baseConfig,
        mainAccountAccessToken: 'the-main-token',
        subAccountAccessToken: 'the-sub-token',
      });

      await adapter.getBuyerViewOrder('3316466102248194582');

      const calledUrl = fetchMock.mock.calls[0][0] as string;
      expect(calledUrl).toContain('orderId=3316466102248194582');
      expect(calledUrl).not.toContain('orderId=3316466102248194600');
    });
  });
});
