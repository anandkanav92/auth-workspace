import { describe, it, expect, vi } from 'vitest';
import { runRefreshPricesWith, type RefreshPricesDeps } from '../../src/cron/refreshPrices';
import type { Holding, PriceCacheCreate } from '../../src/db/schemas';
import type { Quote } from '../../src/providers/types';

function holding(partial: Partial<Holding> & { ticker: string }): Holding {
  return {
    id: `h-${partial.ticker}-${Math.random().toString(36).slice(2)}`,
    created: '',
    updated: '',
    user: 'u1',
    account: 'a1',
    quantity: 10,
    source: 'manual',
    ...partial,
  };
}

function quote(ticker: string, price: number, source?: Quote['source']): Quote {
  return { ticker, price, currency: 'USD', asOf: new Date('2026-06-01T00:00:00Z'), source };
}

function makeDeps(overrides: {
  open?: Holding[];
  quote?: (t: string) => Promise<Quote | null>;
  upsert?: (d: PriceCacheCreate) => Promise<unknown>;
}): RefreshPricesDeps & {
  listAllOpen: ReturnType<typeof vi.fn>;
  quoteFn: ReturnType<typeof vi.fn>;
  upsert: ReturnType<typeof vi.fn>;
} {
  const listAllOpen = vi.fn(async () => overrides.open ?? []);
  const quoteFn = vi.fn(overrides.quote ?? (async (t: string) => quote(t, 100)));
  const upsert = vi.fn(overrides.upsert ?? (async (d) => d));
  return {
    holdings: { listAllOpen } as never,
    priceCache: { upsert } as never,
    provider: { quote: quoteFn } as never,
    listAllOpen,
    quoteFn,
    upsert,
  };
}

describe('runRefreshPricesWith', () => {
  it('upserts a price for each DISTINCT ticker across all open holdings', async () => {
    const deps = makeDeps({
      open: [
        holding({ ticker: 'AAPL', user: 'u1' }),
        holding({ ticker: 'AAPL', user: 'u2' }), // same ticker, different user → deduped
        holding({ ticker: 'MSFT', user: 'u1' }),
      ],
    });
    const res = await runRefreshPricesWith(deps);

    expect(res.tickers).toBe(2); // AAPL + MSFT, deduped across users
    expect(res.refreshed).toBe(2);
    expect(deps.quoteFn).toHaveBeenCalledTimes(2);
    expect(deps.upsert).toHaveBeenCalledTimes(2);
    const tickers = deps.upsert.mock.calls.map((c) => (c[0] as PriceCacheCreate).ticker).sort();
    expect(tickers).toEqual(['AAPL', 'MSFT']);
  });

  it('persists the TRUE provenance from the quote, not a hardcoded source', async () => {
    const deps = makeDeps({
      open: [holding({ ticker: 'AAPL' })],
      quote: async (t) => quote(t, 200, 'finnhub'), // chain answered via finnhub
    });
    await runRefreshPricesWith(deps);
    const row = deps.upsert.mock.calls[0][0] as PriceCacheCreate;
    expect(row.data_source).toBe('finnhub');
  });

  it("defaults data_source to 'yahoo' when the quote omits source", async () => {
    const deps = makeDeps({
      open: [holding({ ticker: 'AAPL' })],
      quote: async (t) => quote(t, 200), // no source
    });
    await runRefreshPricesWith(deps);
    expect((deps.upsert.mock.calls[0][0] as PriceCacheCreate).data_source).toBe('yahoo');
  });

  it('counts a null quote as a miss and does not upsert it', async () => {
    const deps = makeDeps({
      open: [holding({ ticker: 'AAPL' }), holding({ ticker: 'NOPE' })],
      quote: async (t) => (t === 'NOPE' ? null : quote(t, 100)),
    });
    const res = await runRefreshPricesWith(deps);
    expect(res.refreshed).toBe(1);
    expect(res.missed).toBe(1);
    expect(deps.upsert).toHaveBeenCalledTimes(1);
  });

  it('a per-ticker failure does not abort the batch (one failure isolated)', async () => {
    const deps = makeDeps({
      open: [holding({ ticker: 'BAD' }), holding({ ticker: 'GOOD' })],
      quote: async (t) => {
        if (t === 'BAD') throw new Error('upstream 500');
        return quote(t, 100);
      },
    });
    const res = await runRefreshPricesWith(deps);
    expect(res.failed).toBe(1);
    expect(res.refreshed).toBe(1); // GOOD still refreshed
  });

  it('idempotent: re-running upserts the SAME ticker key (no duplicates)', async () => {
    const deps = makeDeps({ open: [holding({ ticker: 'AAPL' })] });
    await runRefreshPricesWith(deps);
    await runRefreshPricesWith(deps);
    // Both runs target the same ticker key — price_cache upsert overwrites.
    const keys = deps.upsert.mock.calls.map((c) => (c[0] as PriceCacheCreate).ticker);
    expect(keys).toEqual(['AAPL', 'AAPL']);
  });
});
