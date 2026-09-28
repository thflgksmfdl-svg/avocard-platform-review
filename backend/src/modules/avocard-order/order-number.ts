import { randomInt } from 'node:crypto';

/**
 * Generates an AVOCARD order number: AV + YYMMDD + 4 random digits, e.g.
 * AV2609170123. Confirmed format per user decision (2026-09-17). Immutable
 * once assigned — never regenerated for an existing order.
 */
export function generateOrderNo(now: Date = new Date()): string {
  const yy = String(now.getUTCFullYear()).slice(-2);
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  const random = String(randomInt(0, 10000)).padStart(4, '0');
  return `AV${yy}${mm}${dd}${random}`;
}
