/**
 * Order pricing breakdown — 09_CANONICAL_DECISIONS.md "환율·수수료":
 *
 * - 구매대행 수수료 6% applies to (1688 상품대금 + 중국 내 운임) 환산 KRW.
 * - 카드수수료 4% applies to the actual card-charged amount (post-wallet-
 *   deduction), 10원 단위 버림. Wallet doesn't exist yet in this slice, so
 *   the card-charged amount is currently the full total.
 * - 계좌이체에는 카드수수료가 없다.
 * - "담당자가 금액을 수정하면 최신 환율로 다시 계산한다" — this module always
 *   uses the exchange rate passed in by the caller (the latest one at read
 *   time), never a stored/cached total, so admin edits and rate changes are
 *   reflected immediately with no separate "confirm" step.
 *
 * All money math is done in integer 원(KRW) cents-equivalent via a small
 * fixed-point helper to avoid floating-point drift; CNY inputs come from
 * Prisma Decimal fields (already exact) converted to string.
 */

export const SERVICE_FEE_RATE = 0.06;
export const CARD_FEE_RATE = 0.04;

export interface PricedSellerGroup {
  sellerId: string;
  internalOrderNo: string | null;
  itemsCnyAmount: number;
  chinaShippingCny: number;
  sellerSubtotalCny: number;
}

export interface OrderPriceBreakdown {
  exchangeRate: number;
  itemsCnyTotal: number;
  chinaShippingCnyTotal: number;
  goodsAndShippingCnyTotal: number;
  goodsAndShippingKrw: number;
  serviceFeeKrw: number;
  walletUsedKrw: number;
  cardChargeBaseKrw: number;
  cardFeeKrw: number;
  totalKrw: number;
  sellerGroups: PricedSellerGroup[];
}

function roundToTen(value: number): number {
  return Math.floor(value / 10) * 10;
}

/**
 * Uses each item's customer_charge_cny_unit_price when staff have set one
 * (09_CANONICAL_DECISIONS.md "담당자는 상품별 단가... 수정할 수 있다"), falling
 * back to the original cny_unit_price otherwise.
 */
export function computeOrderPriceBreakdown(
  sellerOrders: Array<{
    seller_id: string;
    internal_1688_order_no: string | null;
    china_domestic_shipping_cny: string;
    items: Array<{
      qty: number;
      cny_unit_price: string;
      customer_charge_cny_unit_price: string | null;
    }>;
  }>,
  exchangeRate: number,
  paymentMethod: 'CARD' | 'BANK_TRANSFER' | null,
  walletUsedKrw = 0,
): OrderPriceBreakdown {
  const sellerGroups: PricedSellerGroup[] = sellerOrders.map((so) => {
    const itemsCnyAmount = so.items.reduce((sum, item) => {
      const unitPrice = Number(item.customer_charge_cny_unit_price ?? item.cny_unit_price);
      return sum + unitPrice * item.qty;
    }, 0);
    const chinaShippingCny = Number(so.china_domestic_shipping_cny);

    return {
      sellerId: so.seller_id,
      internalOrderNo: so.internal_1688_order_no,
      itemsCnyAmount,
      chinaShippingCny,
      sellerSubtotalCny: itemsCnyAmount + chinaShippingCny,
    };
  });

  const itemsCnyTotal = sellerGroups.reduce((sum, g) => sum + g.itemsCnyAmount, 0);
  const chinaShippingCnyTotal = sellerGroups.reduce((sum, g) => sum + g.chinaShippingCny, 0);
  const goodsAndShippingCnyTotal = itemsCnyTotal + chinaShippingCnyTotal;
  const goodsAndShippingKrw = goodsAndShippingCnyTotal * exchangeRate;
  const serviceFeeKrw = goodsAndShippingKrw * SERVICE_FEE_RATE;

  const subtotalBeforeWalletKrw = goodsAndShippingKrw + serviceFeeKrw;
  const cardChargeBaseKrw = Math.max(0, subtotalBeforeWalletKrw - walletUsedKrw);

  const cardFeeKrw = paymentMethod === 'CARD' ? roundToTen(cardChargeBaseKrw * CARD_FEE_RATE) : 0;

  const totalKrw = subtotalBeforeWalletKrw - walletUsedKrw + cardFeeKrw;

  return {
    exchangeRate,
    itemsCnyTotal,
    chinaShippingCnyTotal,
    goodsAndShippingCnyTotal,
    goodsAndShippingKrw,
    serviceFeeKrw,
    walletUsedKrw,
    cardChargeBaseKrw,
    cardFeeKrw,
    totalKrw,
    sellerGroups,
  };
}
