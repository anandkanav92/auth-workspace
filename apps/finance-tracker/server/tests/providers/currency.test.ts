import { describe, it, expect } from 'vitest';
import { normalizePence, normalizeCurrencyCode } from '../../src/providers/currency';

describe('normalizePence', () => {
  it('converts GBX (Trading 212 pence) to GBP ÷ 100', () => {
    expect(normalizePence(5000, 'GBX')).toEqual({ amount: 50, currency: 'GBP' });
  });

  it('converts GBp (Yahoo pence) to GBP ÷ 100', () => {
    expect(normalizePence(6459, 'GBp')).toEqual({ amount: 64.59, currency: 'GBP' });
  });

  it('leaves GBP (pounds) untouched — case matters', () => {
    expect(normalizePence(50, 'GBP')).toEqual({ amount: 50, currency: 'GBP' });
  });

  it('passes through USD / EUR unchanged', () => {
    expect(normalizePence(100, 'USD')).toEqual({ amount: 100, currency: 'USD' });
    expect(normalizePence(100, 'EUR')).toEqual({ amount: 100, currency: 'EUR' });
  });

  it('passes through an undefined currency', () => {
    expect(normalizePence(100, undefined)).toEqual({ amount: 100, currency: undefined });
  });
});

describe('normalizeCurrencyCode', () => {
  it('folds pence codes to GBP', () => {
    expect(normalizeCurrencyCode('GBX')).toBe('GBP');
    expect(normalizeCurrencyCode('GBp')).toBe('GBP');
  });
  it('leaves majors and undefined untouched', () => {
    expect(normalizeCurrencyCode('GBP')).toBe('GBP');
    expect(normalizeCurrencyCode('USD')).toBe('USD');
    expect(normalizeCurrencyCode(undefined)).toBeUndefined();
  });
});
