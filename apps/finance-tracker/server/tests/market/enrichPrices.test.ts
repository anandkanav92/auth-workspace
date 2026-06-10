import { describe, it, expect, vi } from 'vitest';

import { enrichPricesWith } from '../../src/market/enrichPrices';
import type { Quote } from '../../src/providers/types';
import type { PriceCacheCreate } from '../../src/db/schemas';

/**
 * Shared price-enrichment helper (the fix for "sync values everything at €0").
 * Fetches a live quote per ticker and upserts it into price_cache. Best-effort:
 * a failed quote for one ticker must not abort the others or throw.
 */

function quote(over: Partial<Quote> & { ticker: string }): Quote {
  return {
    price: 100,
    currency: 'USD',
    asOf: new Date('2026-06-10T00:00:00Z'),
    source: 'yahoo',
    ...over,
  };
}

function makeDeps(quotes: Record<string, Quote | null>) {
  const upserts: PriceCacheCreate[] = [];
  return {
    upserts,
    deps: {
      provider: {
        quote: vi.fn(async (ticker: string) => quotes[ticker] ?? null),
      },
      prices: {
        upsert: vi.fn(async (row: PriceCacheCreate) => {
          upserts.push(row);
          return {} as never;
        }),
      },
    },
  };
}

describe('enrichPricesWith', () => {
  it('fetches a quote per ticker and upserts it into price_cache', async () => {
    const { deps, upserts } = makeDeps({
      AAPL: quote({ ticker: 'AAPL', price: 180, currency: 'USD' }),
      'VUKG.L': quote({ ticker: 'VUKG.L', price: 32.5, currency: 'GBP' }),
    });

    await enrichPricesWith(['AAPL', 'VUKG.L'], deps);

    expect(deps.provider.quote).toHaveBeenCalledTimes(2);
    expect(upserts).toHaveLength(2);
    const aapl = upserts.find((u) => u.ticker === 'AAPL')!;
    expect(aapl).toMatchObject({ price: 180, currency: 'USD', data_source: 'yahoo' });
    // carries the quote's as_of + a last_fetched_at stamp.
    expect(aapl.as_of).toBe('2026-06-10T00:00:00.000Z');
    expect(typeof aapl.last_fetched_at).toBe('string');
  });

  it('de-duplicates tickers so each is fetched once', async () => {
    const { deps } = makeDeps({ AAPL: quote({ ticker: 'AAPL' }) });
    await enrichPricesWith(['AAPL', 'AAPL', 'AAPL'], deps);
    expect(deps.provider.quote).toHaveBeenCalledTimes(1);
  });

  it('skips tickers with no quote and never throws (best-effort)', async () => {
    const { deps, upserts } = makeDeps({
      AAPL: quote({ ticker: 'AAPL' }),
      MISS: null,
    });
    await expect(enrichPricesWith(['AAPL', 'MISS'], deps)).resolves.toBeUndefined();
    expect(upserts.map((u) => u.ticker)).toEqual(['AAPL']);
  });

  it('a thrown quote for one ticker does not abort the rest', async () => {
    const { deps, upserts } = makeDeps({ AAPL: quote({ ticker: 'AAPL' }) });
    deps.provider.quote.mockImplementation(async (ticker: string) => {
      if (ticker === 'BOOM') throw new Error('rate limited');
      return quote({ ticker });
    });
    await expect(
      enrichPricesWith(['BOOM', 'AAPL'], deps),
    ).resolves.toBeUndefined();
    expect(upserts.map((u) => u.ticker)).toContain('AAPL');
  });

  it('ignores empty/blank tickers', async () => {
    const { deps } = makeDeps({});
    await enrichPricesWith(['', '  '], deps);
    expect(deps.provider.quote).not.toHaveBeenCalled();
  });
});
