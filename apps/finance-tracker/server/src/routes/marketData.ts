// Shared market-data read endpoints (Task 11.x BFF). The M11 portfolio hook
// (web/src/tiles/usePortfolioData.ts) joins per-user holdings/accounts with three
// SHARED market-data sources; these endpoints expose those sources:
//
//   GET /api/prices    [?tickers=AAPL,MSFT] → price_cache rows
//   GET /api/profiles  [?tickers= | ?isins=] → symbol_profiles rows
//   GET /api/fx        [?date=YYYY-MM-DD]     → one fx_rates row (latest by default)
//
// Like /api/search these are mounted behind authMiddleware (every /api/* needs a
// valid Firebase token) but are NOT user-scoped: the data is shared across all
// users (read-all, BFF-written), so there is no requireOwned ownership check —
// the same model as the search route.
//
// RESPONSE SHAPES (must match the web contract, see usePortfolioData.ts/types.ts):
//   /api/prices   → PriceQuote[]   (bare array)
//   /api/profiles → SymbolProfile[] (bare array)
//   /api/fx       → FxRates | null  (single object, NOT an array; { rates: {...} })
// The repos return full PocketBase records (with id/created/updated + extra
// cache fields); the web types read only a subset, so the extra fields are inert.
//
// Dependencies are injected so the handlers are unit-testable without PocketBase
// or the network; the production binding wires the real shared repos lazily (so
// importing this module in a unit test does not require the PB admin env vars).

import { Hono } from 'hono';
import type { PriceCacheRepo } from '../db/priceCache';
import type { SymbolProfilesRepo } from '../db/symbolProfiles';
import type { FxRatesRepo } from '../db/fxRates';
import type { PriceCache, SymbolProfile, FxRates } from '../db/schemas';

type Vars = { Variables: { uid: string; email: string; pbUserId: string } };

export interface MarketDataDeps {
  prices: Pick<PriceCacheRepo, 'list'>;
  profiles: Pick<SymbolProfilesRepo, 'list'>;
  fxRates: Pick<FxRatesRepo, 'get' | 'getLatest'>;
}

/**
 * Parse a comma-separated query param (`?tickers=AAPL,MSFT`) into a trimmed,
 * non-empty, upper-cased set — or null when the param is absent/blank (meaning
 * "no filter, return everything"). Tickers are compared case-insensitively.
 */
function parseCsvSet(raw: string | undefined): Set<string> | null {
  if (!raw) return null;
  const items = raw
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter((s) => s.length > 0);
  return items.length ? new Set(items) : null;
}

/** Cached spot prices, optionally filtered to `?tickers=`. */
export async function listPricesWith(
  tickersParam: string | undefined,
  deps: Pick<MarketDataDeps, 'prices'>,
): Promise<PriceCache[]> {
  const rows = await deps.prices.list();
  const wanted = parseCsvSet(tickersParam);
  if (!wanted) return rows;
  return rows.filter((r) => wanted.has(r.ticker.toUpperCase()));
}

/**
 * Symbol profiles, optionally filtered to `?tickers=` and/or `?isins=`. When
 * both are supplied a row matches if EITHER its ticker OR its isin is wanted
 * (union) — the web hook joins by ticker, but ISIN is the canonical statement
 * key, so both lookups are supported.
 */
export async function listProfilesWith(
  tickersParam: string | undefined,
  isinsParam: string | undefined,
  deps: Pick<MarketDataDeps, 'profiles'>,
): Promise<SymbolProfile[]> {
  const rows = await deps.profiles.list();
  const wantedTickers = parseCsvSet(tickersParam);
  const wantedIsins = parseCsvSet(isinsParam);
  if (!wantedTickers && !wantedIsins) return rows;
  return rows.filter(
    (r) =>
      (wantedTickers?.has(r.ticker.toUpperCase()) ?? false) ||
      (wantedIsins != null && r.isin
        ? wantedIsins.has(r.isin.toUpperCase())
        : false),
  );
}

/**
 * The fx_rates row for `?date=` (exact match), or the latest row when no date is
 * given. Returns null when there is no matching row (web hook treats a 1.0 EUR
 * default for unknown currencies, but the row itself may legitimately be absent
 * before the first FX cron run).
 */
export async function getFxWith(
  dateParam: string | undefined,
  deps: Pick<MarketDataDeps, 'fxRates'>,
): Promise<FxRates | null> {
  const date = dateParam?.trim();
  if (date) return deps.fxRates.get(date);
  return deps.fxRates.getLatest();
}

// --- Production binding: real shared repos ----------------------------------
// Constructed LAZILY on first request so importing this module (e.g. in a unit
// test of the *With helpers) does not require the PB admin env vars — pb.ts
// throws at import time without them.
let prodDeps: MarketDataDeps | undefined;
async function getProdDeps(): Promise<MarketDataDeps> {
  if (!prodDeps) {
    const { priceCacheRepo } = await import('../db/priceCache');
    const { symbolProfilesRepo } = await import('../db/symbolProfiles');
    const { fxRatesRepo } = await import('../db/fxRates');
    prodDeps = {
      prices: priceCacheRepo,
      profiles: symbolProfilesRepo,
      fxRates: fxRatesRepo,
    };
  }
  return prodDeps;
}

export const marketDataRoutes = new Hono<Vars>()
  // GET /api/prices?tickers=AAPL,MSFT — cached spot prices (PriceQuote[]).
  .get('/prices', async (c) => {
    const rows = await listPricesWith(c.req.query('tickers'), await getProdDeps());
    return c.json(rows);
  })
  // GET /api/profiles?tickers=&isins= — symbol profiles (SymbolProfile[]).
  .get('/profiles', async (c) => {
    const rows = await listProfilesWith(
      c.req.query('tickers'),
      c.req.query('isins'),
      await getProdDeps(),
    );
    return c.json(rows);
  })
  // GET /api/fx?date=YYYY-MM-DD — one fx_rates row (latest by default).
  .get('/fx', async (c) => {
    const row = await getFxWith(c.req.query('date'), await getProdDeps());
    return c.json(row);
  });
