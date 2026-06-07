import { describe, it, expect, vi, afterEach } from 'vitest';
import YahooFinance from 'yahoo-finance2';
import aaplFixture from '../fixtures/yahoo-aapl-quoteSummary.json';
import vwrlProfileFixture from '../fixtures/yahoo-vwrl-quoteSummary.json';
import vwrlTopHoldingsFixture from '../fixtures/yahoo-vwrl-topHoldings.json';
import { YahooPriceProvider } from '../../src/providers/yahoo';

// yahoo-finance2 v3 exposes quoteSummary/search as prototype methods on the
// YahooFinance class. The provider constructs its own instance, so we spy on
// the prototype to intercept calls offline against committed fixtures.
function mockQuoteSummary(impl: (ticker: string, opts: { modules: string[] }) => unknown) {
  return vi
    .spyOn(YahooFinance.prototype, 'quoteSummary')
    .mockImplementation((async (ticker: string, opts: { modules: string[] }) =>
      impl(ticker, opts)) as never);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('YahooPriceProvider', () => {
  it('maps an equity quoteSummary to Quote + SymbolProfile (AAPL)', async () => {
    mockQuoteSummary(() => aaplFixture);
    const p = new YahooPriceProvider();

    const q = await p.quote('AAPL');
    expect(q?.ticker).toBe('AAPL');
    expect(q?.price).toBeGreaterThan(0);
    expect(q?.currency).toBe('USD');
    expect(q?.asOf).toBeInstanceOf(Date);

    const prof = await p.profile('AAPL');
    expect(prof?.assetType).toBe('stock');
    expect(prof?.name).toBe('Apple Inc.');
    expect(prof?.sector).toBe('Technology');
    expect(prof?.country).toBe('United States');
    expect(prof?.marketCap).toBeGreaterThan(0);
    expect(prof?.peRatio).toBeGreaterThan(0);
    expect(prof?.beta).toBeGreaterThan(0);
    expect(prof?.sectorWeightings).toBeUndefined(); // equities don't get look-through
  });

  it('maps an ETF profile with sector look-through (VWRL.L)', async () => {
    // ETF: assetProfile sector/country come back null; topHoldings carries
    // sectorWeightings. The provider must branch on quoteType and fetch
    // topHoldings additionally.
    mockQuoteSummary((_ticker, opts) =>
      opts.modules.includes('topHoldings') ? vwrlTopHoldingsFixture : vwrlProfileFixture,
    );
    const p = new YahooPriceProvider();

    const prof = await p.profile('VWRL.L');
    expect(prof?.assetType).toBe('etf');
    expect(prof?.sector).toBeUndefined(); // null from assetProfile — expected
    expect(prof?.country).toBeUndefined();
    expect(prof?.sectorWeightings).toBeDefined();
    expect(Object.keys(prof!.sectorWeightings!).length).toBeGreaterThan(0);
    expect(prof?.sectorWeightings?.technology).toBeCloseTo(0.2901, 4);
  });

  it('normalises a pence-quoted LSE price (GBp) to GBP ÷ 100', async () => {
    mockQuoteSummary(() => ({
      price: { regularMarketPrice: 6459, currency: 'GBp', regularMarketTime: new Date() },
    }));
    const p = new YahooPriceProvider();
    const q = await p.quote('SGLN.L');
    expect(q?.price).toBeCloseTo(64.59, 2);
    expect(q?.currency).toBe('GBP');
  });

  it('returns null for an unknown ticker (quoteSummary throws)', async () => {
    mockQuoteSummary(() => {
      throw new Error('Not Found');
    });
    const p = new YahooPriceProvider();
    expect(await p.quote('NOPE')).toBeNull();
    expect(await p.profile('NOPE')).toBeNull();
  });
});
