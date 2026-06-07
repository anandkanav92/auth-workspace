import { describe, it, expect } from 'vitest';
import { mergeBuy, applySell, applyAdjustment } from '../../src/db/costBasis';

describe('mergeBuy (weighted-average add)', () => {
  it('creates a fresh position when none exists', () => {
    const r = mergeBuy(null, { quantity: 10, cost_basis: 1500, cost_currency: 'EUR' });
    expect(r).toEqual({ quantity: 10, cost_basis: 1500, cost_currency: 'EUR' });
  });

  it('sums quantity and adds total cost (weighted average)', () => {
    // 10 @ 1500 total + 5 @ 1000 total → 15 shares, 2500 total cost.
    const r = mergeBuy(
      { quantity: 10, cost_basis: 1500, cost_currency: 'EUR' },
      { quantity: 5, cost_basis: 1000, cost_currency: 'EUR' },
    );
    expect(r.quantity).toBe(15);
    expect(r.cost_basis).toBe(2500); // old total + added total, NOT per-share avg
    expect(r.cost_currency).toBe('EUR');
  });

  it('yields null cost when the existing cost is unknown', () => {
    const r = mergeBuy(
      { quantity: 10, cost_basis: null, cost_currency: null },
      { quantity: 5, cost_basis: 1000, cost_currency: 'EUR' },
    );
    expect(r.quantity).toBe(15);
    expect(r.cost_basis).toBeNull();
  });

  it('yields null cost when the added cost is unknown', () => {
    const r = mergeBuy(
      { quantity: 10, cost_basis: 1500, cost_currency: 'EUR' },
      { quantity: 5, cost_basis: null, cost_currency: null },
    );
    expect(r.cost_basis).toBeNull();
  });
});

describe('applySell (proportional cost reduction)', () => {
  it('reduces cost_basis proportionally to the sold fraction', () => {
    // Sell 5 of 15 (1/3) from a 2500 total → keep 2/3 = 1666.67.
    const r = applySell({ quantity: 15, cost_basis: 2500 }, 5);
    expect(r.quantity).toBe(10);
    expect(r.cost_basis).toBeCloseTo(2500 * (10 / 15), 6);
  });

  it('zeros quantity and cost on a full sell (closed marker)', () => {
    const r = applySell({ quantity: 10, cost_basis: 2000 }, 10);
    expect(r.quantity).toBe(0);
    expect(r.cost_basis).toBe(0);
  });

  it('keeps cost null when unknown', () => {
    const r = applySell({ quantity: 10, cost_basis: null }, 4);
    expect(r.quantity).toBe(6);
    expect(r.cost_basis).toBeNull();
  });
});

describe('applyAdjustment', () => {
  it('scales cost_basis to preserve per-share cost when quantity changes', () => {
    // 10 shares @ 1500 total → 12 shares keeps 150/share → 1800 total.
    const r = applyAdjustment({ quantity: 10, cost_basis: 1500 }, { quantity: 12 });
    expect(r.quantity).toBe(12);
    expect(r.cost_basis).toBeCloseTo(1800, 6);
  });

  it('uses an explicit cost_basis when provided', () => {
    const r = applyAdjustment(
      { quantity: 10, cost_basis: 1500 },
      { quantity: 12, cost_basis: 999 },
    );
    expect(r.quantity).toBe(12);
    expect(r.cost_basis).toBe(999);
  });

  it('leaves cost untouched when only non-quantity fields change', () => {
    const r = applyAdjustment({ quantity: 10, cost_basis: 1500 }, { cost_basis: 1500 });
    expect(r.cost_basis).toBe(1500);
  });

  it('keeps cost null when unknown and quantity changes', () => {
    const r = applyAdjustment({ quantity: 10, cost_basis: null }, { quantity: 20 });
    expect(r.quantity).toBe(20);
    expect(r.cost_basis).toBeNull();
  });
});
