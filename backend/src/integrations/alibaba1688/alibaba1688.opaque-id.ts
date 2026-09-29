/**
 * Normalization for opaque 1688 identifier fields in general — order ids
 * (idOfStr, baseInfo.id), product ids (productID), sku ids (skuID), and any
 * other numeric-looking id 1688 returns. These values are opaque to AVOCARD
 * (never used in arithmetic) and some — order ids in particular — are
 * 19-digit integers that exceed Number.MAX_SAFE_INTEGER (9007199254740991),
 * confirmed live 2026-09-29 with a real order's `idOfStr: "3316466102248194582"`.
 *
 * IMPORTANT PRECISION CAVEAT: by the time a value reaches this function as a
 * JS `number`, precision may ALREADY be lost — this happens inside
 * `JSON.parse` itself (or `Response.json()`, which uses the same engine
 * parser), before any application code runs. This function does not, and
 * cannot, recover the original digits once that has happened; it can only
 * (a) pass through values that arrived as JSON strings untouched, since
 * those never had a numeric-precision boundary to cross, and (b) detect,
 * for values that arrived as JSON numbers, whether they are *provably*
 * unsafe (Number.isSafeInteger() === false) so the caller can label the
 * result as a lossy/observed value rather than claim it is the exact
 * original. A value that both arrived as a JSON number AND happens to be
 * within the safe integer range is NOT provably lossy, but this function
 * still cannot guarantee 1688's original value matched what arrived —
 * it can only report what was actually observed after parsing.
 *
 * Use `normalizeOpaqueId()` directly for product/sku ids and any other
 * general 1688 identifier. Use the order-id-specific wrapper in
 * alibaba1688.order-id.ts for order identifiers specifically, where the
 * error messages and doc comments are phrased around that specific,
 * higher-stakes use case (order ids gate financial reconciliation; product/
 * sku ids do not carry the same risk if occasionally imprecise).
 */
export interface NormalizedOpaqueId {
  value: string;
  /**
   * true if this value arrived as a JSON number that was NOT provably safe
   * (Number.isSafeInteger() === false at the point this function received
   * it) — meaning precision was very likely already lost upstream (inside
   * JSON.parse/Response.json()) before this function ever saw the value.
   * false does NOT mean "guaranteed accurate" — it only means no proof of
   * loss was detected; a value that arrived as a JSON string is also
   * `possiblyLossy: false` (strings never cross the numeric-precision
   * boundary), and a value that arrived as an in-range JSON number is also
   * `possiblyLossy: false` even though 1688's original digits are still not
   * independently verifiable from this function alone.
   */
  possiblyLossy: boolean;
}

export function normalizeOpaqueId(raw: string | number | null | undefined, fieldLabel: string): NormalizedOpaqueId {
  if (raw === null || raw === undefined) {
    throw new Error(`normalizeOpaqueId(${fieldLabel}) received null/undefined — the caller must check for a missing id before calling this function; it never returns a placeholder value.`);
  }

  if (typeof raw === 'number') {
    if (!Number.isInteger(raw)) {
      throw new Error(
        `normalizeOpaqueId(${fieldLabel}) received a non-integer number (${raw}) — 1688 ids are always integers. ` +
          'This usually means the wrong field was passed in, not a valid id.',
      );
    }
    const safe = Number.isSafeInteger(raw);
    return { value: String(raw), possiblyLossy: !safe };
  }

  if (raw === '') {
    throw new Error(`normalizeOpaqueId(${fieldLabel}) received an empty string — the caller must check for a missing id before calling this function; it never returns a placeholder value.`);
  }

  return { value: raw, possiblyLossy: false };
}
