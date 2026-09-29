import { describe, expect, it } from 'vitest';
import { normalizeOrderId } from '../../src/integrations/alibaba1688/alibaba1688.order-id.js';

// Real value confirmed live 2026-09-29 (alibaba.trade.get.buyerView response
// for a pre-existing order) — a 19-digit order id string.
const REAL_ID_OF_STR = '3316466102248194582';

describe('normalizeOrderId', () => {
  it('passes a string idOfStr through unchanged', () => {
    expect(normalizeOrderId(REAL_ID_OF_STR)).toBe(REAL_ID_OF_STR);
  });

  it('survives a JSON.stringify/JSON.parse round trip when kept as a string', () => {
    const original = { idOfStr: REAL_ID_OF_STR };
    const roundTripped = JSON.parse(JSON.stringify(original)) as { idOfStr: string };

    expect(normalizeOrderId(roundTripped.idOfStr)).toBe(REAL_ID_OF_STR);
    expect(normalizeOrderId(roundTripped.idOfStr)).toBe(normalizeOrderId(original.idOfStr));
  });

  it('demonstrates why the raw value must never be parsed as a JSON number: precision is lost before normalizeOrderId is even called', () => {
    // This mirrors baseInfo.id in the same live response: 3316466102248194600,
    // a 19-digit integer JSON *number* (not string) — exceeds
    // Number.MAX_SAFE_INTEGER and is corrupted by JSON.parse itself.
    const corruptedByJsonParse = JSON.parse('{"id": 3316466102248194600}') as { id: number };

    // Number.isSafeInteger(false) is the reliable signal that precision may
    // already be lost — the string representation can coincidentally match
    // the original for some inputs (IEEE 754 rounding doesn't always change
    // the printed digits), so this test asserts on the safe-integer check
    // itself rather than a potentially-coincidental string comparison.
    expect(Number.isSafeInteger(corruptedByJsonParse.id)).toBe(false);
    expect(corruptedByJsonParse.id).toBeGreaterThan(Number.MAX_SAFE_INTEGER);
  });

  it('throws rather than silently returning a corrupted value when given an out-of-range number', () => {
    expect(() => normalizeOrderId(3316466102248194600)).toThrow(/MAX_SAFE_INTEGER/);
  });

  it('accepts an in-range number defensively (e.g. a short/legacy numeric id)', () => {
    expect(normalizeOrderId(12345)).toBe('12345');
  });

  it('throws on null', () => {
    expect(() => normalizeOrderId(null)).toThrow(/null\/undefined/);
  });

  it('throws on undefined', () => {
    expect(() => normalizeOrderId(undefined)).toThrow(/null\/undefined/);
  });

  it('throws on an empty string', () => {
    expect(() => normalizeOrderId('')).toThrow(/empty string/);
  });

  it('throws on a decimal (fractional) number', () => {
    expect(() => normalizeOrderId(3316466102248194.5)).toThrow(/non-integer/);
  });

  it('throws on an exponential-notation number that is out of safe-integer range', () => {
    // 1688's real 19-digit order ids, if ever mis-parsed as a JS number,
    // print in exponential notation at this magnitude — e.g. 3.3164661022481946e+18.
    const exponential = 3.3164661022481946e18;
    expect(() => normalizeOrderId(exponential)).toThrow(/MAX_SAFE_INTEGER/);
  });

  it('accepts a small exponential-notation number that is still a safe integer', () => {
    expect(normalizeOrderId(1.2345e4)).toBe('12345');
  });
});
