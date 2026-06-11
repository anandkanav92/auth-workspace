import { describe, it, expect } from 'vitest';
import { z } from 'zod';

import { buildSnapshot, type SnapshotInputs } from '../../src/export/portfolioSnapshot';
import type { Holding, PriceCache, SymbolProfile } from '../../src/db/schemas';

// --- the consumer's authoritative contract schema (copied verbatim) ----------
// investment_research_lab validates every snapshot with this and hard-fails on
// any violation. If this test passes, the lab's loader accepts our output.
const Holding_ = z.object({
  ticker: z.string(),
  name: z.string(),
  assetType: z.enum(['stock', 'etf', 'bond', 'cash', 'other']),
  quantity: z.number(),
  valueEur: z.number(),
  costEur: z.number().nullable(),
  weight: z.number(),
  currency: z.string(),
  sector: z.string(),
  country: z.string(),
});
const pct = z.record(z.string(), z.number());
const PortfolioSnapshot = z
  .object({
    schemaVersion: z.literal(1),
    asOf: z.string().datetime(),
    baseCurrency: z.literal('EUR'),
    totals: z.object({
      valueEur: z.number(),
      costEur: z.number(),
      unrealisedEur: z.number(),
      unrealisedPct: z.number(),
      positionsWithCost: z.number().int(),
      positionsWithoutCost: z.number().int(),
    }),
    concentration: z.object({
      topPositionPct: z.number(),
      top5Pct: z.number(),
      bySector: pct,
      byCountry: pct,
      byCurrency: pct,
      byAssetType: pct,
    }),
    holdings: z.array(Holding_).min(1),
  })
  .strip();

// --- fixtures (no network; all data inline) ----------------------------------
// 1 EUR = 1.10 USD; GBP rate present for pence handling.
const FX = { EUR: 1, USD: 1.1, GBP: 0.85 };

function holding(p: Partial<Holding> & { ticker: string }): Holding {
  return {
    id: `h-${p.ticker}`,
    created: '',
    updated: '',
    user: 'u1',
    account: 'a1',
    quantity: 10,
    source: 'manual',
    ...p,
  } as Holding;
}

function price(ticker: string, price: number, currency = 'USD'): PriceCache {
  return { id: `p-${ticker}`, created: '', updated: '', ticker, price, currency } as PriceCache;
}

function profile(
  ticker: string,
  p: Partial<SymbolProfile> = {},
): SymbolProfile {
  return {
    id: `pr-${ticker}`,
    created: '',
    updated: '',
    ticker,
    name: `${ticker} Inc`,
    asset_type: 'stock',
    ...p,
  } as SymbolProfile;
}

const NOW = new Date('2026-06-11T08:00:00.000Z');

/** A representative book: 2 USD stocks, 1 EUR stock, 1 ETF, 1 null-cost holding. */
function sampleInputs(): SnapshotInputs {
  return {
    now: NOW,
    fxRates: FX,
    holdings: [
      holding({ ticker: 'NVDA', quantity: 10, cost_basis: 1000, cost_currency: 'USD' }),
      holding({ ticker: 'AAPL', quantity: 20, cost_basis: 2000, cost_currency: 'USD' }),
      holding({ ticker: 'ASML', quantity: 2, cost_basis: 1200, cost_currency: 'EUR' }),
      holding({ ticker: 'IWDA', quantity: 30, cost_basis: 2400, cost_currency: 'EUR' }),
      // null-cost (e.g. transferred-in): cost_currency empty → excluded from cost math.
      holding({ ticker: 'GLD', quantity: 5, cost_currency: '' }),
      // closed position — must be excluded entirely.
      holding({ ticker: 'OLD', quantity: 0, cost_basis: 50, cost_currency: 'USD' }),
    ],
    prices: [
      price('NVDA', 110, 'USD'), // 10 * 110 / 1.1 = 1000 EUR
      price('AAPL', 220, 'USD'), // 20 * 220 / 1.1 = 4000 EUR
      price('ASML', 900, 'EUR'), // 2 * 900 = 1800 EUR
      price('IWDA', 100, 'EUR'), // 30 * 100 = 3000 EUR
      price('GLD', 40, 'EUR'), //   5 * 40  = 200 EUR (no cost)
      price('OLD', 5, 'USD'),
    ],
    profiles: [
      profile('NVDA', { sector: 'Technology', country: 'United States' }),
      profile('AAPL', { sector: 'Technology', country: 'United States' }),
      profile('ASML', { sector: 'Technology', country: 'Netherlands' }),
      profile('IWDA', { asset_type: 'etf', name: 'iShares Core MSCI World' }),
      profile('GLD', { asset_type: 'etf', name: 'iShares Physical Gold' }),
    ],
  };
}

describe('buildSnapshot — contract conformance', () => {
  it('produces output that parses against the consumer zod schema', () => {
    const snap = buildSnapshot(sampleInputs());
    expect(() => PortfolioSnapshot.parse(snap)).not.toThrow();
    expect(snap.schemaVersion).toBe(1);
    expect(snap.baseCurrency).toBe('EUR');
    expect(snap.asOf).toBe('2026-06-11T08:00:00.000Z');
    expect(snap.holdings.length).toBeGreaterThanOrEqual(1);
  });

  it('weights sum to ~1 (within +/-0.001)', () => {
    const snap = buildSnapshot(sampleInputs());
    const sum = snap.holdings.reduce((s, h) => s + h.weight, 0);
    expect(Math.abs(sum - 1)).toBeLessThanOrEqual(0.001);
  });
});

describe('buildSnapshot — EUR + totals math', () => {
  it('FX-converts value to EUR and excludes null-cost from cost/unrealised', () => {
    const snap = buildSnapshot(sampleInputs());
    // total value = 1000 + 4000 + 1800 + 3000 + 200 = 10000
    expect(snap.totals.valueEur).toBe(10000);
    // cost is in each holding's cost_currency, FX-converted:
    // NVDA 1000USD/1.1=909.09 + AAPL 2000USD/1.1=1818.18 + ASML 1200 + IWDA 2400
    expect(snap.totals.costEur).toBeCloseTo(6327.27, 2);
    // cost-bearing value 9800 - cost 6327.27
    expect(snap.totals.unrealisedEur).toBeCloseTo(3472.73, 2);
    expect(snap.totals.unrealisedPct).toBeCloseTo(3472.73 / 6327.27, 4);
    expect(snap.totals.positionsWithCost).toBe(4);
    expect(snap.totals.positionsWithoutCost).toBe(1); // GLD only (OLD is closed)
  });

  it('excludes closed (quantity 0) positions entirely', () => {
    const snap = buildSnapshot(sampleInputs());
    expect(snap.holdings.find((h) => h.ticker === 'OLD')).toBeUndefined();
    expect(snap.holdings).toHaveLength(5);
  });

  it('records null costEur for a holding with no cost basis', () => {
    const snap = buildSnapshot(sampleInputs());
    const gld = snap.holdings.find((h) => h.ticker === 'GLD')!;
    expect(gld.costEur).toBeNull();
    expect(gld.valueEur).toBe(200);
  });

  it('normalises GBp pence prices to GBP and divides by 100', () => {
    const snap = buildSnapshot({
      now: NOW,
      fxRates: FX,
      holdings: [holding({ ticker: 'SGLN', quantity: 100, cost_basis: 0, cost_currency: 'GBP' })],
      // 100 shares * 5000 pence = 500000 pence = 5000 GBP; /0.85 = 5882.35 EUR
      prices: [price('SGLN', 5000, 'GBp')],
      profiles: [profile('SGLN', { asset_type: 'etf' })],
    });
    const sgln = snap.holdings[0];
    expect(sgln.valueEur).toBeCloseTo(5882.35, 1);
    expect(sgln.currency).toBe('GBP'); // pence code normalised for grouping
    expect(snap.concentration.byCurrency['GBP']).toBeCloseTo(1, 6);
  });
});

describe('buildSnapshot — concentration', () => {
  it('computes topPositionPct and top5Pct from weights', () => {
    const snap = buildSnapshot(sampleInputs());
    // AAPL is largest at 4000/10000 = 0.4
    expect(snap.concentration.topPositionPct).toBeCloseTo(0.4, 6);
    // 5 holdings → top5 covers all → ~1
    expect(snap.concentration.top5Pct).toBeCloseTo(1, 3);
  });

  it('groups bySector/byCountry with ETF Uncategorised / Multiple-Diversified, no look-through', () => {
    const snap = buildSnapshot(sampleInputs());
    // Tech = NVDA(0.1)+AAPL(0.4)+ASML(0.18) = 0.68; ETFs (IWDA 0.3 + GLD 0.02) = 0.32 Uncategorised
    expect(snap.concentration.bySector['Technology']).toBeCloseTo(0.68, 5);
    expect(snap.concentration.bySector['Uncategorised']).toBeCloseTo(0.32, 5);
    expect(snap.concentration.byCountry['United States']).toBeCloseTo(0.5, 5); // NVDA+AAPL
    expect(snap.concentration.byCountry['Netherlands']).toBeCloseTo(0.18, 5);
    expect(snap.concentration.byCountry['Multiple/Diversified']).toBeCloseTo(0.32, 5); // ETFs
  });

  it('groups byCurrency and byAssetType (lowercase enum keys)', () => {
    const snap = buildSnapshot(sampleInputs());
    expect(snap.concentration.byCurrency['USD']).toBeCloseTo(0.5, 5); // NVDA+AAPL
    expect(snap.concentration.byCurrency['EUR']).toBeCloseTo(0.5, 5); // ASML+IWDA+GLD
    expect(snap.concentration.byAssetType['stock']).toBeCloseTo(0.68, 5);
    expect(snap.concentration.byAssetType['etf']).toBeCloseTo(0.32, 5);
  });
});

describe('buildSnapshot — guards', () => {
  it('throws when there are no open holdings', () => {
    expect(() =>
      buildSnapshot({
        now: NOW,
        fxRates: FX,
        holdings: [holding({ ticker: 'OLD', quantity: 0 })],
        prices: [],
        profiles: [],
      }),
    ).toThrow(/no open holdings/i);
  });

  it('throws when FX is missing for a currency a holding uses (no silent 0)', () => {
    expect(() =>
      buildSnapshot({
        now: NOW,
        fxRates: { EUR: 1 }, // USD rate absent
        holdings: [holding({ ticker: 'NVDA', quantity: 10, cost_basis: 1000, cost_currency: 'USD' })],
        prices: [price('NVDA', 110, 'USD')],
        profiles: [profile('NVDA')],
      }),
    ).toThrow(/missing FX rate.*USD/i);
  });

  it('throws when the FX map is empty but a non-EUR holding exists', () => {
    expect(() =>
      buildSnapshot({
        now: NOW,
        fxRates: {},
        holdings: [holding({ ticker: 'NVDA', quantity: 10, cost_currency: 'USD' })],
        prices: [price('NVDA', 110, 'USD')],
        profiles: [profile('NVDA')],
      }),
    ).toThrow(/missing FX rate/i);
  });

  it('succeeds for an all-EUR portfolio even with NO FX rates', () => {
    const snap = buildSnapshot({
      now: NOW,
      fxRates: {}, // no rates needed when everything is EUR
      holdings: [holding({ ticker: 'IWDA', quantity: 10, cost_basis: 900, cost_currency: 'EUR' })],
      prices: [price('IWDA', 100, 'EUR')],
      profiles: [profile('IWDA', { asset_type: 'etf' })],
    });
    expect(snap.totals.valueEur).toBe(1000);
    expect(snap.concentration.byCurrency['EUR']).toBeCloseTo(1, 6);
  });

  it('throws when total value is 0 (nothing priced)', () => {
    expect(() =>
      buildSnapshot({
        now: NOW,
        fxRates: FX,
        holdings: [holding({ ticker: 'NVDA', quantity: 10, cost_currency: 'USD' })],
        prices: [], // no price → value 0
        profiles: [profile('NVDA')],
      }),
    ).toThrow(/total portfolio value is 0/i);
  });
});
