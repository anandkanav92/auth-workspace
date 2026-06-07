import { describe, it, expect, vi } from 'vitest';
import { resolveTickerWith, type ResolveTickerDeps } from '../../src/importers/resolveTicker';
import type { SymbolProfile as ProviderProfile, SearchResult } from '../../src/providers/types';

function makeDeps(overrides: {
  byIsin?: (isin: string) => Promise<unknown>;
  search?: (q: string) => Promise<SearchResult[]>;
  profile?: (t: string) => Promise<ProviderProfile | null>;
  upsert?: (d: unknown) => Promise<unknown>;
}): ResolveTickerDeps & {
  search: ReturnType<typeof vi.fn>;
  upsert: ReturnType<typeof vi.fn>;
  profile: ReturnType<typeof vi.fn>;
} {
  const search = vi.fn(overrides.search ?? (async () => []));
  const profile = vi.fn(overrides.profile ?? (async () => null));
  const upsert = vi.fn(overrides.upsert ?? (async (d) => d));
  const getByIsin = vi.fn(overrides.byIsin ?? (async () => null));
  return {
    profiles: { getByIsin, upsert } as never,
    provider: { search, profile } as never,
    search,
    upsert,
    profile,
  };
}

const FULL_PROFILE: ProviderProfile = {
  ticker: 'AAPL',
  isin: 'US0378331005',
  name: 'Apple Inc.',
  exchange: 'NMS',
  assetType: 'stock',
  listingCurrency: 'USD',
  sector: 'Technology',
};

describe('resolveTickerWith', () => {
  it('returns the cached ticker on an ISIN cache hit (no network)', async () => {
    const deps = makeDeps({ byIsin: async () => ({ ticker: 'AAPL' }) });
    const ticker = await resolveTickerWith('US0378331005', 'AAPL', deps);
    expect(ticker).toBe('AAPL');
    expect(deps.search).not.toHaveBeenCalled();
    expect(deps.upsert).not.toHaveBeenCalled();
  });

  it('on cache miss, resolves via Yahoo search + caches the fetched profile', async () => {
    const deps = makeDeps({
      byIsin: async () => null,
      search: async () => [{ ticker: 'AAPL', name: 'Apple Inc.', exchange: 'NMS' }],
      profile: async () => FULL_PROFILE,
    });
    const ticker = await resolveTickerWith('US0378331005', 'AAPL', deps);
    expect(ticker).toBe('AAPL');
    expect(deps.search).toHaveBeenCalledWith('US0378331005');
    expect(deps.upsert).toHaveBeenCalledTimes(1);
    expect(deps.upsert.mock.calls[0][0]).toMatchObject({
      ticker: 'AAPL',
      isin: 'US0378331005',
      asset_type: 'stock',
      data_source: 'yahoo',
    });
  });

  it('falls back to the broker symbol when Yahoo cannot resolve the ISIN', async () => {
    const deps = makeDeps({ byIsin: async () => null, search: async () => [] });
    const ticker = await resolveTickerWith('XX0000000000', 'WEIRD', deps);
    expect(ticker).toBe('WEIRD');
    expect(deps.upsert).not.toHaveBeenCalled();
  });

  it('still returns + caches the ticker when profile enrichment fails', async () => {
    const deps = makeDeps({
      byIsin: async () => null,
      search: async () => [{ ticker: 'AAPL', name: 'Apple', exchange: '' }],
      profile: async () => null, // enrichment failed
    });
    const ticker = await resolveTickerWith('US0378331005', 'AAPL', deps);
    expect(ticker).toBe('AAPL');
    // Minimal stub still cached so the next import is a cache hit.
    expect(deps.upsert).toHaveBeenCalledTimes(1);
    expect(deps.upsert.mock.calls[0][0]).toMatchObject({
      ticker: 'AAPL',
      isin: 'US0378331005',
      asset_type: 'other',
    });
  });

  // --- currency-aware resolution (bug fix) ----------------------------------

  it('prefers the London listing for a GBP/GBX instrument over a same-named US hit', async () => {
    // iShares Physical Gold (IE00B4ND3602): Yahoo returns a bogus US "SGLN"
    // penny stock FIRST, then the real SGLN.L. With GBP expected we must pick .L.
    const deps = makeDeps({
      byIsin: async () => null,
      search: async () => [
        { ticker: 'SGLN', name: 'Singularity (US OTC)', exchange: 'PNK' },
        { ticker: 'SGLN.L', name: 'iShares Physical Gold', exchange: 'LSE' },
      ],
      profile: async () => ({ ...FULL_PROFILE, ticker: 'SGLN.L', listingCurrency: 'GBp' }),
    });
    const ticker = await resolveTickerWith('IE00B4ND3602', 'SGLN', deps, 'GBP');
    expect(ticker).toBe('SGLN.L');
  });

  it('ignores a cached hit whose currency disagrees with the statement (multi-listing ISIN)', async () => {
    // Cache holds the GBp listing (SGLN.L) for this ISIN, but THIS row is the USD
    // line (IGLN.L). The shared ISIN must not return the wrong-currency cache.
    const deps = makeDeps({
      byIsin: async () => ({ ticker: 'SGLN.L', listing_currency: 'GBP' }),
      search: async () => [{ ticker: 'IGLN.L', name: 'iShares Physical Gold USD', exchange: 'LSE' }],
      profile: async () => ({ ...FULL_PROFILE, ticker: 'IGLN.L', listingCurrency: 'USD' }),
    });
    const ticker = await resolveTickerWith('IE00B4ND3602', 'IGLN', deps, 'USD');
    expect(ticker).toBe('IGLN.L');
    expect(deps.search).toHaveBeenCalled(); // cache was rejected → searched
  });

  it('matches the broker symbol for a USD-denominated .L listing (IGLN.L, not a bare US hit)', async () => {
    // IGLN.L is USD but trades on the LSE with a ".L" suffix — the no-dot "USD"
    // venue rule alone would reject it, so the broker symbol must win.
    const deps = makeDeps({
      byIsin: async () => null,
      search: async () => [
        { ticker: 'SGLN', name: 'US OTC junk', exchange: 'PNK' },
        { ticker: 'IGLN.L', name: 'iShares Physical Gold USD', exchange: 'LSE' },
      ],
      profile: async () => ({ ...FULL_PROFILE, ticker: 'IGLN.L', listingCurrency: 'USD' }),
    });
    const ticker = await resolveTickerWith('IE00B4ND3602', 'IGLN', deps, 'USD');
    expect(ticker).toBe('IGLN.L');
  });

  it('trusts a cached hit when its currency matches the expectation (no search)', async () => {
    const deps = makeDeps({
      byIsin: async () => ({ ticker: 'AAPL', listing_currency: 'USD' }),
    });
    const ticker = await resolveTickerWith('US0378331005', 'AAPL', deps, 'USD');
    expect(ticker).toBe('AAPL');
    expect(deps.search).not.toHaveBeenCalled();
  });

  // --- constructed-symbol fallback (Yahoo ISIN search returns nothing) -------

  it('constructs <symbol>.L when ISIN search yields no hits (GBP gold ETC)', async () => {
    // Live behaviour: search('IE00B4ND3602') returns []. The real listing is
    // SGLN.L (GBp); bare "SGLN" is a US penny stock. We must construct SGLN.L.
    const deps = makeDeps({
      byIsin: async () => null,
      search: async () => [],
      profile: async (t) =>
        t === 'SGLN.L'
          ? { ...FULL_PROFILE, ticker: 'SGLN.L', listingCurrency: 'GBp' }
          : null,
    });
    const ticker = await resolveTickerWith('IE00B4ND3602', 'SGLN', deps, 'GBP');
    expect(ticker).toBe('SGLN.L');
    expect(deps.upsert).toHaveBeenCalledTimes(1);
  });

  it('probes EUR venues in order until one trades in EUR (IWDE.AS)', async () => {
    const deps = makeDeps({
      byIsin: async () => null,
      search: async () => [],
      profile: async (t) =>
        t === 'IWDE.AS'
          ? { ...FULL_PROFILE, ticker: 'IWDE.AS', listingCurrency: 'EUR' }
          : null,
    });
    const ticker = await resolveTickerWith('IE00B441G979', 'IWDE', deps, 'EUR');
    expect(ticker).toBe('IWDE.AS');
  });

  it('falls back to the broker symbol when no constructed candidate validates', async () => {
    const deps = makeDeps({
      byIsin: async () => null,
      search: async () => [],
      profile: async () => null, // nothing trades anywhere
    });
    const ticker = await resolveTickerWith('IE00B4ND3602', 'SGLN', deps, 'GBP');
    expect(ticker).toBe('SGLN');
    expect(deps.upsert).not.toHaveBeenCalled();
  });
});
