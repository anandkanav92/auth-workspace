import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import {
  listPricesWith,
  listProfilesWith,
  getFxWith,
} from '../../src/routes/marketData';
import type {
  PriceCache,
  SymbolProfile,
  FxRates,
} from '../../src/db/schemas';

// --- fixtures ---------------------------------------------------------------

function priceRow(over: Partial<PriceCache>): PriceCache {
  return {
    id: `pc-${over.ticker ?? 'x'}`,
    created: '',
    updated: '',
    ticker: 'AAPL',
    price: 100,
    currency: 'USD',
    ...over,
  };
}

function profileRow(over: Partial<SymbolProfile>): SymbolProfile {
  return {
    id: `sp-${over.ticker ?? 'x'}`,
    created: '',
    updated: '',
    ticker: 'AAPL',
    name: 'Apple Inc.',
    asset_type: 'stock',
    ...over,
  };
}

function fxRow(over: Partial<FxRates>): FxRates {
  return {
    id: `fx-${over.date ?? 'x'}`,
    created: '',
    updated: '',
    date: '2026-06-07',
    rates: { USD: 1.08, GBP: 0.85 },
    ...over,
  };
}

// --- listPricesWith ---------------------------------------------------------

describe('listPricesWith', () => {
  it('returns all cached rows when no tickers filter is given', async () => {
    const rows = [priceRow({ ticker: 'AAPL' }), priceRow({ ticker: 'MSFT' })];
    const deps = { prices: { list: vi.fn(async () => rows) } };

    expect(await listPricesWith(undefined, deps)).toEqual(rows);
    expect(deps.prices.list).toHaveBeenCalledTimes(1);
  });

  it('filters to the requested tickers (case-insensitive)', async () => {
    const rows = [
      priceRow({ ticker: 'AAPL' }),
      priceRow({ ticker: 'MSFT' }),
      priceRow({ ticker: 'GOOG' }),
    ];
    const deps = { prices: { list: vi.fn(async () => rows) } };

    const result = await listPricesWith('aapl,msft', deps);
    expect(result.map((r) => r.ticker)).toEqual(['AAPL', 'MSFT']);
  });

  it('treats a blank/whitespace filter as "no filter"', async () => {
    const rows = [priceRow({ ticker: 'AAPL' })];
    const deps = { prices: { list: vi.fn(async () => rows) } };
    expect(await listPricesWith('  ,  ', deps)).toEqual(rows);
  });
});

// --- listProfilesWith -------------------------------------------------------

describe('listProfilesWith', () => {
  it('returns all profiles when neither tickers nor isins is given', async () => {
    const rows = [profileRow({ ticker: 'AAPL' }), profileRow({ ticker: 'MSFT' })];
    const deps = { profiles: { list: vi.fn(async () => rows) } };
    expect(await listProfilesWith(undefined, undefined, deps)).toEqual(rows);
  });

  it('filters by tickers', async () => {
    const rows = [profileRow({ ticker: 'AAPL' }), profileRow({ ticker: 'MSFT' })];
    const deps = { profiles: { list: vi.fn(async () => rows) } };
    const result = await listProfilesWith('MSFT', undefined, deps);
    expect(result.map((r) => r.ticker)).toEqual(['MSFT']);
  });

  it('filters by isins (union with tickers)', async () => {
    const rows = [
      profileRow({ ticker: 'AAPL', isin: 'US0378331005' }),
      profileRow({ ticker: 'MSFT', isin: 'US5949181045' }),
      profileRow({ ticker: 'GOOG', isin: 'US02079K3059' }),
    ];
    const deps = { profiles: { list: vi.fn(async () => rows) } };
    // ticker AAPL OR isin matching MSFT's isin → both rows.
    const result = await listProfilesWith('AAPL', 'us5949181045', deps);
    expect(result.map((r) => r.ticker).sort()).toEqual(['AAPL', 'MSFT']);
  });

  it('returns empty when a filter matches nothing', async () => {
    const rows = [profileRow({ ticker: 'AAPL' })];
    const deps = { profiles: { list: vi.fn(async () => rows) } };
    expect(await listProfilesWith('NOPE', undefined, deps)).toEqual([]);
  });
});

// --- getFxWith --------------------------------------------------------------

describe('getFxWith', () => {
  it('returns the latest row when no date is given', async () => {
    const latest = fxRow({ date: '2026-06-07' });
    const deps = {
      fxRates: {
        get: vi.fn(async () => null),
        getLatest: vi.fn(async () => latest),
      },
    };
    expect(await getFxWith(undefined, deps)).toEqual(latest);
    expect(deps.fxRates.getLatest).toHaveBeenCalledTimes(1);
    expect(deps.fxRates.get).not.toHaveBeenCalled();
  });

  it('returns the row for an explicit ?date= (no latest lookup)', async () => {
    const dated = fxRow({ date: '2026-06-01' });
    const deps = {
      fxRates: {
        get: vi.fn(async () => dated),
        getLatest: vi.fn(async () => null),
      },
    };
    expect(await getFxWith('2026-06-01', deps)).toEqual(dated);
    expect(deps.fxRates.get).toHaveBeenCalledWith('2026-06-01');
    expect(deps.fxRates.getLatest).not.toHaveBeenCalled();
  });

  it('returns null when there is no fx row at all', async () => {
    const deps = {
      fxRates: {
        get: vi.fn(async () => null),
        getLatest: vi.fn(async () => null),
      },
    };
    expect(await getFxWith(undefined, deps)).toBeNull();
  });
});

// --- HTTP route wiring ------------------------------------------------------
// Mock the lazily-imported prod repos, then drive the routes over HTTP to
// assert they read the query params, require the authed context, and JSON-encode
// the expected SHAPES (bare arrays for prices/profiles, single object for fx).

const pricesList = vi.fn();
const profilesList = vi.fn();
const fxGet = vi.fn();
const fxGetLatest = vi.fn();

vi.mock('../../src/db/priceCache', () => ({
  priceCacheRepo: { list: (...a: unknown[]) => pricesList(...a) },
}));
vi.mock('../../src/db/symbolProfiles', () => ({
  symbolProfilesRepo: { list: (...a: unknown[]) => profilesList(...a) },
}));
vi.mock('../../src/db/fxRates', () => ({
  fxRatesRepo: {
    get: (...a: unknown[]) => fxGet(...a),
    getLatest: (...a: unknown[]) => fxGetLatest(...a),
  },
}));

function authedApp() {
  const app = new Hono();
  app.use('/api/*', async (c, next) => {
    c.set('uid', 'fb-u1');
    c.set('email', 'u1@test');
    c.set('pbUserId', 'u1');
    await next();
  });
  return app;
}

describe('GET /api/prices | /api/profiles | /api/fx', () => {
  beforeEach(() => {
    pricesList.mockReset();
    profilesList.mockReset();
    fxGet.mockReset();
    fxGetLatest.mockReset();
  });

  it('GET /api/prices returns the cached rows as a bare array', async () => {
    pricesList.mockResolvedValue([priceRow({ ticker: 'AAPL' })]);
    const { marketDataRoutes } = await import('../../src/routes/marketData');
    const app = authedApp();
    app.route('/api', marketDataRoutes);

    const res = await app.request('/api/prices');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject({ ticker: 'AAPL', price: 100, currency: 'USD' });
  });

  it('GET /api/prices?tickers= filters the rows', async () => {
    pricesList.mockResolvedValue([
      priceRow({ ticker: 'AAPL' }),
      priceRow({ ticker: 'MSFT' }),
    ]);
    const { marketDataRoutes } = await import('../../src/routes/marketData');
    const app = authedApp();
    app.route('/api', marketDataRoutes);

    const res = await app.request('/api/prices?tickers=MSFT');
    const body = await res.json();
    expect(body.map((r: PriceCache) => r.ticker)).toEqual(['MSFT']);
  });

  it('GET /api/profiles returns a bare array', async () => {
    profilesList.mockResolvedValue([profileRow({ ticker: 'AAPL' })]);
    const { marketDataRoutes } = await import('../../src/routes/marketData');
    const app = authedApp();
    app.route('/api', marketDataRoutes);

    const res = await app.request('/api/profiles');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body[0]).toMatchObject({ ticker: 'AAPL', asset_type: 'stock' });
  });

  it('GET /api/fx returns the latest row as a single object (not an array)', async () => {
    fxGetLatest.mockResolvedValue(fxRow({ date: '2026-06-07' }));
    const { marketDataRoutes } = await import('../../src/routes/marketData');
    const app = authedApp();
    app.route('/api', marketDataRoutes);

    const res = await app.request('/api/fx');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(false);
    expect(body).toMatchObject({ date: '2026-06-07', rates: { USD: 1.08 } });
    expect(fxGet).not.toHaveBeenCalled();
  });

  it('GET /api/fx?date= looks up the exact date', async () => {
    fxGet.mockResolvedValue(fxRow({ date: '2026-06-01' }));
    const { marketDataRoutes } = await import('../../src/routes/marketData');
    const app = authedApp();
    app.route('/api', marketDataRoutes);

    const res = await app.request('/api/fx?date=2026-06-01');
    const body = await res.json();
    expect(body.date).toBe('2026-06-01');
    expect(fxGet).toHaveBeenCalledWith('2026-06-01');
  });
});
