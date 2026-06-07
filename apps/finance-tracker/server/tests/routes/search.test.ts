import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { searchTickersWith, type SearchDeps } from '../../src/routes/search';
import type { SymbolProfile as CachedProfile } from '../../src/db/schemas';
import type { SearchResult } from '../../src/providers/types';

// A cached symbol_profiles row with only the fields toSearchResult reads.
function cachedRow(over: Partial<CachedProfile>): CachedProfile {
  return {
    id: `sp-${over.ticker ?? 'x'}`,
    created: '',
    updated: '',
    ticker: 'AAPL',
    name: 'Apple Inc.',
    exchange: 'NMS',
    asset_type: 'stock',
    ...over,
  };
}

// Build injectable deps with spies. Caller supplies the cache + provider results.
function makeDeps(opts: {
  cache?: CachedProfile[];
  providerHits?: SearchResult[];
}): SearchDeps & {
  profiles: { search: ReturnType<typeof vi.fn>; upsert: ReturnType<typeof vi.fn> };
  provider: { search: ReturnType<typeof vi.fn> };
} {
  return {
    profiles: {
      search: vi.fn(async () => opts.cache ?? []),
      upsert: vi.fn(async (data) => ({ id: 'sp-new', created: '', updated: '', ...data })),
    },
    provider: {
      search: vi.fn(async () => opts.providerHits ?? []),
    },
  };
}

describe('searchTickersWith — cache HIT', () => {
  it('returns cached rows and does NOT call the provider', async () => {
    const deps = makeDeps({
      cache: [
        cachedRow({ ticker: 'AAPL', name: 'Apple Inc.', exchange: 'NMS' }),
        cachedRow({ ticker: 'APLE', name: 'Apple Hospitality REIT', exchange: 'NYQ' }),
      ],
    });

    const results = await searchTickersWith('apple', deps);

    expect(results).toEqual([
      { ticker: 'AAPL', name: 'Apple Inc.', exchange: 'NMS' },
      { ticker: 'APLE', name: 'Apple Hospitality REIT', exchange: 'NYQ' },
    ]);
    // The whole point of the cache: no upstream call on a hit.
    expect(deps.provider.search).not.toHaveBeenCalled();
    // And nothing new to upsert.
    expect(deps.profiles.upsert).not.toHaveBeenCalled();
  });
});

describe('searchTickersWith — cache MISS', () => {
  it('calls the provider EXACTLY once and upserts each new hit', async () => {
    const deps = makeDeps({
      cache: [], // miss
      providerHits: [
        { ticker: 'AAPL', name: 'Apple Inc.', exchange: 'NMS' },
        { ticker: 'MSFT', name: 'Microsoft Corp.', exchange: 'NMS' },
      ],
    });

    const results = await searchTickersWith('apple', deps);

    // Provider consulted once, with the trimmed query.
    expect(deps.provider.search).toHaveBeenCalledTimes(1);
    expect(deps.provider.search).toHaveBeenCalledWith('apple');

    // Each new hit cached as a minimal symbol_profiles row.
    expect(deps.profiles.upsert).toHaveBeenCalledTimes(2);
    expect(deps.profiles.upsert).toHaveBeenCalledWith({
      ticker: 'AAPL',
      name: 'Apple Inc.',
      exchange: 'NMS',
      asset_type: 'other',
    });

    // Provider hits are returned as-is.
    expect(results).toEqual([
      { ticker: 'AAPL', name: 'Apple Inc.', exchange: 'NMS' },
      { ticker: 'MSFT', name: 'Microsoft Corp.', exchange: 'NMS' },
    ]);
  });

  it('caches nothing when the provider also returns no hits', async () => {
    const deps = makeDeps({ cache: [], providerHits: [] });
    const results = await searchTickersWith('zzzznotaticker', deps);
    expect(deps.provider.search).toHaveBeenCalledTimes(1);
    expect(deps.profiles.upsert).not.toHaveBeenCalled();
    expect(results).toEqual([]);
  });
});

describe('searchTickersWith — empty / whitespace query', () => {
  it('short-circuits without touching the cache or provider', async () => {
    const deps = makeDeps({});
    expect(await searchTickersWith('   ', deps)).toEqual([]);
    expect(deps.profiles.search).not.toHaveBeenCalled();
    expect(deps.provider.search).not.toHaveBeenCalled();
  });
});

// --- HTTP route wiring -------------------------------------------------------
// Mock the prod-binding modules the route imports lazily, then drive it over
// HTTP to assert it reads ?q=, requires the authed context, and JSON-encodes
// the SearchResult[].

const repoSearch = vi.fn();
const repoUpsert = vi.fn(async (data) => ({ id: 'sp', ...data }));
const providerSearch = vi.fn();

vi.mock('../../src/db/symbolProfiles', () => ({
  symbolProfilesRepo: {
    search: (...a: unknown[]) => repoSearch(...a),
    upsert: (...a: unknown[]) => repoUpsert(...a),
  },
}));
vi.mock('../../src/providers/chain', () => ({
  // Stand-in chain: delegates straight to the providerSearch spy.
  ProviderChain: class {
    search(q: string) {
      return providerSearch(q);
    }
  },
}));
vi.mock('../../src/providers/yahoo', () => ({ YahooPriceProvider: class {} }));
vi.mock('../../src/providers/finnhub', () => ({ FinnhubPriceProvider: class {} }));

function appAs(pbUserId: string) {
  const app = new Hono();
  app.use('/api/*', async (c, next) => {
    c.set('uid', `fb-${pbUserId}`);
    c.set('email', `${pbUserId}@test`);
    c.set('pbUserId', pbUserId);
    await next();
  });
  // searchRoutes is imported after the mocks above are registered.
  return app;
}

describe('GET /api/search', () => {
  beforeEach(() => {
    repoSearch.mockReset();
    providerSearch.mockReset();
    repoUpsert.mockClear();
  });

  it('serves cached results without calling the provider', async () => {
    repoSearch.mockResolvedValue([cachedRow({ ticker: 'AAPL', name: 'Apple Inc.', exchange: 'NMS' })]);
    const { searchRoutes } = await import('../../src/routes/search');
    const app = appAs('u1');
    app.route('/api/search', searchRoutes);

    const res = await app.request('/api/search?q=apple');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([{ ticker: 'AAPL', name: 'Apple Inc.', exchange: 'NMS' }]);
    expect(providerSearch).not.toHaveBeenCalled();
  });

  it('returns an empty array for a blank query', async () => {
    const { searchRoutes } = await import('../../src/routes/search');
    const app = appAs('u1');
    app.route('/api/search', searchRoutes);

    const res = await app.request('/api/search?q=');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
    expect(repoSearch).not.toHaveBeenCalled();
  });
});
