import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';

import type { Holding, PriceCache, SymbolProfile, FxRates } from '../../src/db/schemas';

// Mock the repos the route lazily imports, so no PocketBase/env is needed. Each
// test sets the data via these module-level fns.
let holdingsOut: Holding[] = [];
let pricesOut: PriceCache[] = [];
let profilesOut: SymbolProfile[] = [];
let fxOut: FxRates | null = null;

vi.mock('../../src/db/holdings', () => ({
  holdingsRepo: { listForUser: vi.fn(async () => holdingsOut) },
}));
vi.mock('../../src/db/priceCache', () => ({
  priceCacheRepo: { list: vi.fn(async () => pricesOut) },
}));
vi.mock('../../src/db/symbolProfiles', () => ({
  symbolProfilesRepo: { list: vi.fn(async () => profilesOut) },
}));
vi.mock('../../src/db/fxRates', () => ({
  fxRatesRepo: { getLatest: vi.fn(async () => fxOut) },
}));

// Import AFTER the mocks are registered.
const { portfolioRoutes } = await import('../../src/routes/portfolio');

/** App with pbUserId injected (authMiddleware's job in prod). */
function app() {
  return new Hono()
    .use('*', async (c, next) => {
      c.set('pbUserId', 'u1');
      await next();
    })
    .route('/api/portfolio', portfolioRoutes);
}

function holding(p: Partial<Holding> & { ticker: string }): Holding {
  return {
    id: `h-${p.ticker}`, created: '', updated: '', user: 'u1', account: 'a1',
    quantity: 10, source: 'manual', ...p,
  } as Holding;
}

describe('GET /api/portfolio/snapshot', () => {
  it('returns 200 with a contract snapshot for the signed-in user', async () => {
    holdingsOut = [holding({ ticker: 'NVDA', quantity: 10, cost_basis: 1000, cost_currency: 'USD' })];
    pricesOut = [{ id: 'p', created: '', updated: '', ticker: 'NVDA', price: 110, currency: 'USD' } as PriceCache];
    profilesOut = [{ id: 'pr', created: '', updated: '', ticker: 'NVDA', name: 'NVIDIA', asset_type: 'stock' } as SymbolProfile];
    fxOut = { id: 'fx', created: '', updated: '', date: '2026-06-11', rates: { EUR: 1, USD: 1.1 } } as FxRates;

    const res = await app().request('/api/portfolio/snapshot');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.schemaVersion).toBe(1);
    expect(body.baseCurrency).toBe('EUR');
    expect(body.holdings).toHaveLength(1);
    expect(body.totals.valueEur).toBeCloseTo(1000, 2); // 10 * 110 / 1.1
  });

  it('returns 422 (not 500) when the user has no open holdings', async () => {
    holdingsOut = [];
    pricesOut = [];
    profilesOut = [];
    fxOut = { id: 'fx', created: '', updated: '', date: '2026-06-11', rates: { EUR: 1 } } as FxRates;

    const res = await app().request('/api/portfolio/snapshot');
    expect(res.status).toBe(422);
  });

  it('returns 422 when FX is missing for a non-EUR holding (no distorted snapshot)', async () => {
    holdingsOut = [holding({ ticker: 'NVDA', quantity: 10, cost_basis: 1000, cost_currency: 'USD' })];
    pricesOut = [{ id: 'p', created: '', updated: '', ticker: 'NVDA', price: 110, currency: 'USD' } as PriceCache];
    profilesOut = [{ id: 'pr', created: '', updated: '', ticker: 'NVDA', name: 'NVIDIA', asset_type: 'stock' } as SymbolProfile];
    fxOut = null; // no FX row at all

    const res = await app().request('/api/portfolio/snapshot');
    expect(res.status).toBe(422);
  });
});
