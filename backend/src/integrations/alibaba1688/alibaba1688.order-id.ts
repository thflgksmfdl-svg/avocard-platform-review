/**
 * Normalization for 1688 order identifiers (e.g. `idOfStr` from
 * alibaba.trade.get.buyerView / alibaba.trade.getBuyerOrderList, and
 * whatever identifier field(s) alibaba.trade.createCrossOrder eventually
 * returns). These values are up to 19-digit integers that exceed
 * Number.MAX_SAFE_INTEGER (9007199254740991) — confirmed live 2026-09-29
 * with a real order's `idOfStr: "3316466102248194582"`. Passing such a
 * value through Number()/parseInt() or any arithmetic silently corrupts it.
 *
 * This is the one place order-identifier values should pass through before
 * being stored, logged, or returned in a DTO. It does not validate that the
 * input is a well-formed 1688 order id (that's 1688's problem); it only
 * guarantees the value survives as an exact string, whether it arrived as a
 * JSON string or (defensively) a JSON number.
 *
 * Do NOT use this for product-catalog identifiers (offerId, skuId) — those
 * are within the safe integer range and 1688's own request schemas require
 * some of them (e.g. offerId in queryProductDetail's offerDetailParam) as
 * JSON numbers, not strings. This module is order-identifier-specific.
 */
export function normalizeOrderId(raw: string | number | null | undefined): string {
  if (raw === null || raw === undefined) {
    throw new Error('normalizeOrderId received null/undefined — the caller must check for a missing order id before calling this function; it never returns a placeholder value.');
  }

  if (typeof raw === 'number') {
    if (!Number.isInteger(raw)) {
      // Covers both non-integer decimals (e.g. 3.5) and exponential-notation
      // numbers that evaluate to a non-integer — 1688 order ids are always
      // integers, so a fractional value indicates the caller passed the
      // wrong field or a parsing bug upstream, not a valid (if unusual) id.
      throw new Error(
        `normalizeOrderId received a non-integer number (${raw}) — 1688 order ids are always integers. ` +
          'This usually means the wrong field was passed in, not a valid order id.',
      );
    }
    if (!Number.isSafeInteger(raw)) {
      throw new Error(
        `normalizeOrderId received a number (${raw}) outside Number.MAX_SAFE_INTEGER — ` +
          'the value has likely already lost precision before reaching this function. ' +
          'The caller must be changed to read this field as a string upstream (e.g. via a ' +
          'custom JSON reviver, or by re-fetching the raw response text) rather than letting ' +
          'JSON.parse coerce it to a number first.',
      );
    }
    return String(raw);
  }

  if (raw === '') {
    throw new Error('normalizeOrderId received an empty string — the caller must check for a missing order id before calling this function; it never returns a placeholder value.');
  }

  return raw;
}
