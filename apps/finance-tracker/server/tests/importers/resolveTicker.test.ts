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
});
