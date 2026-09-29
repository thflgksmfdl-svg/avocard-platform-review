import { normalizeOpaqueId } from './alibaba1688.opaque-id.js';

/**
 * Normalization for 1688 ORDER identifiers specifically (e.g. `idOfStr` from
 * alibaba.trade.get.buyerView / alibaba.trade.getBuyerOrderList, and
 * whatever identifier field(s) alibaba.trade.createCrossOrder eventually
 * returns). Order ids gate financial reconciliation, so this wrapper is
 * intentionally stricter than the general-purpose `normalizeOpaqueId()` it's
 * built on (see alibaba1688.opaque-id.ts for the full precision-loss
 * explanation) — it throws on ANY detected precision risk rather than
 * returning a lossy value with a flag, since an order id must never be
 * silently treated as reliable when it might not be.
 *
 * Do NOT use this for product-catalog identifiers (offerId, skuId) — those
 * carry lower stakes if occasionally imprecise, and 1688's own request
 * schemas require some of them (e.g. offerId in queryProductDetail's
 * offerDetailParam) as JSON numbers, not strings. Use `normalizeOpaqueId()`
 * directly for those instead.
 */
export function normalizeOrderId(raw: string | number | null | undefined): string {
  const normalized = normalizeOpaqueId(raw, 'order id');
  if (normalized.possiblyLossy) {
    throw new Error(
      `normalizeOrderId received a number (${raw}) outside Number.MAX_SAFE_INTEGER — ` +
        'the value has likely already lost precision before reaching this function (this can ' +
        'happen inside JSON.parse/Response.json() itself, before any application code runs). ' +
        'The caller must be changed to read this field as a string upstream (e.g. via a custom ' +
        'JSON reviver, or by re-fetching the raw response text) rather than letting JSON.parse ' +
        'coerce it to a number first — normalizeOrderId refuses to return a value it cannot ' +
        'guarantee is not already corrupted.',
    );
  }
  return normalized.value;
}
