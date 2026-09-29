import { describe, expect, it } from 'vitest';
import { normalizeOpaqueId } from '../../src/integrations/alibaba1688/alibaba1688.opaque-id.js';

describe('normalizeOpaqueId', () => {
  it('passes a string id through unchanged, flagged not-lossy', () => {
    const result = normalizeOpaqueId('739990579926', 'test.field');
    expect(result).toEqual({ value: '739990579926', possiblyLossy: false });
  });

  it('accepts an in-range number, flagged not-lossy', () => {
    const result = normalizeOpaqueId(739990579926, 'test.field');
    expect(result).toEqual({ value: '739990579926', possiblyLossy: false });
  });

  it('accepts an out-of-range number WITHOUT throwing, but flags possiblyLossy', () => {
    const result = normalizeOpaqueId(3316466102248194600, 'test.field');
    expect(result.possiblyLossy).toBe(true);
    expect(typeof result.value).toBe('string');
  });

  it('throws on null', () => {
    expect(() => normalizeOpaqueId(null, 'test.field')).toThrow(/null\/undefined/);
  });

  it('throws on undefined', () => {
    expect(() => normalizeOpaqueId(undefined, 'test.field')).toThrow(/null\/undefined/);
  });

  it('throws on an empty string', () => {
    expect(() => normalizeOpaqueId('', 'test.field')).toThrow(/empty string/);
  });

  it('throws on a non-integer number', () => {
    expect(() => normalizeOpaqueId(3.5, 'test.field')).toThrow(/non-integer/);
  });

  it('includes the fieldLabel in error messages for traceability', () => {
    expect(() => normalizeOpaqueId(null, 'buyerView.baseInfo.id')).toThrow(/buyerView\.baseInfo\.id/);
  });
});
