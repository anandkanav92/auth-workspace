// Ticker search endpoint (Task 7.1). `GET /api/search?q=apple` returns matching
// instruments for the add-position UX (M13). Mounted behind authMiddleware +
// rateLimit — it's an authed endpoint — but the results are SHARED market data
// (symbol_profiles), not per-user, so no ownership scoping applies to them.
//
// Resolution order (cache-first to avoid hammering the providers on every
// keystroke; the frontend debounces, M13):
//   1. symbol_profiles cache: substring match on ticker OR name.
//   2. Empty cache result → fall back to the provider chain's search()
//      (Yahoo → Finnhub). Each new hit is upserted into symbol_profiles so the
//      next search for the same term is a cache hit.
//
// Dependencies are injected so the handler is unit-testable without PocketBase
// or the network; searchTickers() binds the real repo + provider chain lazily.

import { Hono } from 'hono';
import type { SymbolProfilesRepo } from '../db/symbolProfiles';
import type { SymbolProfile as CachedProfile, SymbolProfileCreate } from '../db/schemas';
import type { PriceProvider, SearchResult } from '../providers/types';

type Vars = { Variables: { uid: string; email: string; pbUserId: string } };

export interface SearchDeps {
  profiles: Pick<SymbolProfilesRepo, 'search' | 'upsert'>;
  provider: Pick<PriceProvider, 'search'>;
}

/**
 * Search tickers by name/symbol, cache-first.
 *
 * @returns the matching instruments as `SearchResult[]` (ticker, name,
 *          exchange). Never throws on a provider/cache failure — a failed
 *          upstream simply yields fewer (or zero) results.
 */
export async function searchTickersWith(
  query: string,
  deps: SearchDeps,
): Promise<SearchResult[]> {
  const q = query.trim();
  if (!q) return [];

  // 1. Cache hit — return without touching the provider.
  const cached = await deps.profiles.search(q).catch(() => [] as CachedProfile[]);
  if (cached.length) return cached.map(toSearchResult);

  // 2. Cache miss → provider chain (Yahoo → Finnhub).
  const hits = await deps.provider.search(q).catch(() => [] as SearchResult[]);

  // Cache each new hit so the next identical search skips the network. A failed
  // upsert must not fail the request, so we swallow per-row errors.
  await Promise.all(
    hits.map((hit) => deps.profiles.upsert(toCreate(hit)).catch(() => undefined)),
  );

  return hits;
}

/** Cached symbol_profiles row → the public SearchResult shape. */
function toSearchResult(p: CachedProfile): SearchResult {
  return { ticker: p.ticker, name: p.name, exchange: p.exchange ?? '' };
}

/**
 * Map a provider search hit to a symbol_profiles create row. Search hits carry
 * only ticker/name/exchange — `asset_type` is required by the schema, so we seed
 * 'other'; the weekly profile-refresh cron (M8) enriches it later.
 */
function toCreate(hit: SearchResult): SymbolProfileCreate {
  return {
    ticker: hit.ticker,
    name: hit.name || hit.ticker,
    exchange: hit.exchange || undefined,
    asset_type: 'other',
  };
}

// --- Production binding: real symbol_profiles repo + Yahoo→Finnhub chain ------
// Constructed LAZILY on first request so importing this module (e.g. in a unit
// test of searchTickersWith) does not require the PB admin env vars — pb.ts
// throws at import time without them.
let prodDeps: SearchDeps | undefined;
async function getProdDeps(): Promise<SearchDeps> {
  if (!prodDeps) {
    const { symbolProfilesRepo } = await import('../db/symbolProfiles');
    const { ProviderChain } = await import('../providers/chain');
    const { YahooPriceProvider } = await import('../providers/yahoo');
    const { FinnhubPriceProvider } = await import('../providers/finnhub');
    const provider = new ProviderChain([
      new YahooPriceProvider(),
      new FinnhubPriceProvider(),
    ]);
    prodDeps = { profiles: symbolProfilesRepo, provider };
  }
  return prodDeps;
}

export const searchRoutes = new Hono<Vars>()
  // GET /api/search?q=... — ticker search (cache-first, provider fallback).
  .get('/', async (c) => {
    const q = c.req.query('q') ?? '';
    const results = await searchTickersWith(q, await getProdDeps());
    return c.json(results);
  });
