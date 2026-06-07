import { describe, it, expect, vi, afterEach } from 'vitest';
import quoteFixture from '../fixtures/finnhub-quote.json';
import profileFixture from '../fixtures/finnhub-profile2.json';
import searchFixture from '../fixtures/finnhub-search.json';
import { FinnhubPriceProvider } from '../../src/providers/finnhub';

// NOTE: Finnhub fixtures are HAND-AUTHORED from the documented response shapes
//   /quote          -> { c, h, l, o, pc, t }
//   /stock/profile2 -> { name, exchange, currency, country, marketCapitalization }
//   /search         -> { count, result: [{ symbol, description, ... }] }
// (no Finnhub API key available to live-capture). The network is mocked.

function mockFetch(routes: Record<string, { ok?: boolean; body: unknown }>) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation((async (url: string | URL) => {
    const href = url.toString();
    const match = Object.entries(routes).find(([fragment]) => href.includes(fragment));
    if (!match) throw new Error(`unexpected fetch: ${href}`);
    const { ok = true, body } = match[1];
    return {
      ok,
      status: ok ? 200 : 500,
      json: async () => body,
    } as Response;
  }) as never);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('FinnhubPriceProvider', () => {
  it('maps /quote to a Quote (USD)', async () => {
    mockFetch({ '/quote': { body: quoteFixture } });
    const p = new FinnhubPriceProvider('test-key');
    const q = await p.quote('AAPL');
    expect(q?.ticker).toBe('AAPL');
    expect(q?.price).toBe(307.34);
    expect(q?.currency).toBe('USD');
    expect(q?.asOf.getTime()).toBe(1749153601 * 1000);
  });

  it('returns null when /quote has no current price (c=0)', async () => {
    mockFetch({ '/quote': { body: { c: 0, t: 0 } } });
    const p = new FinnhubPriceProvider('test-key');
    expect(await p.quote('NOPE')).toBeNull();
  });

  it('returns null when /quote responds non-ok', async () => {
    mockFetch({ '/quote': { ok: false, body: {} } });
    const p = new FinnhubPriceProvider('test-key');
    expect(await p.quote('AAPL')).toBeNull();
  });

  it('skips non-US (suffixed) tickers without hitting the network', async () => {
    const spy = mockFetch({ '/quote': { body: quoteFixture } });
    const p = new FinnhubPriceProvider('test-key');
    // Finnhub free tier is US-only and always says USD — a ".L"/".DE" ticker
    // would get a wrong, USD-mislabeled price, so it must short-circuit to null.
    expect(await p.quote('SGLN.L')).toBeNull();
    expect(await p.quote('NQSE.DE')).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });

  it('maps /stock/profile2 to a SymbolProfile with marketCap in absolute units', async () => {
    mockFetch({ '/stock/profile2': { body: profileFixture } });
    const p = new FinnhubPriceProvider('test-key');
    const prof = await p.profile('AAPL');
    expect(prof?.name).toBe('Apple Inc');
    expect(prof?.country).toBe('US');
    expect(prof?.listingCurrency).toBe('USD');
    // 4514011.676672 (millions) * 1e6 => ~4.5e12 absolute
    expect(prof?.marketCap).toBeCloseTo(4514011676672, 0);
  });

  it('maps /search results to SearchResult[]', async () => {
    mockFetch({ '/search': { body: searchFixture } });
    const p = new FinnhubPriceProvider('test-key');
    const results = await p.search('apple');
    expect(results.length).toBe(2);
    expect(results[0]).toEqual({ ticker: 'AAPL', name: 'APPLE INC', exchange: '' });
  });

  it('returns [] when /search responds non-ok', async () => {
    mockFetch({ '/search': { ok: false, body: {} } });
    const p = new FinnhubPriceProvider('test-key');
    expect(await p.search('apple')).toEqual([]);
  });
});
