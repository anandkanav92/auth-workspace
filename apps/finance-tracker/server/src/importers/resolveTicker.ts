// ISIN → ticker resolution (Task 6.1). Both broker PDFs always print an ISIN
// (spikes 1 & 2), so the ISIN is the canonical join key into symbol_profiles.
//
// Resolution order (cache-first to avoid hammering Yahoo on every import):
//   1. symbol_profiles cache hit by ISIN  → return its ticker.
//   2. Miss → YahooPriceProvider.search(isin) (Yahoo accepts ISINs in search)
//      to discover the ticker, then fetch the full profile and cache it so the
//      next import (and the allocation tiles) skip the network.
//   3. Yahoo can't resolve it → fall back to the broker's own symbol so the
//      import still completes; the profile/price simply stays unenriched.
//
// Dependencies are injected so the resolver is unit-testable without PocketBase
// or the network; resolveTicker() binds the real repo + provider.

import type { SymbolProfilesRepo } from '../db/symbolProfiles';
import type { PriceProvider, SymbolProfile as ProviderProfile } from '../providers/types';
import type { SymbolProfileCreate } from '../db/schemas';

export interface ResolveTickerDeps {
  profiles: Pick<SymbolProfilesRepo, 'getByIsin' | 'upsert'>;
  provider: Pick<PriceProvider, 'search' | 'profile'>;
}

/**
 * Resolve a broker symbol + ISIN to the canonical ticker, caching a freshly
 * fetched profile when the ISIN wasn't already known.
 *
 * @param isin          ISO 6166 id from the statement (the lookup key).
 * @param brokerSymbol  the symbol the broker printed; used as the fallback
 *                      ticker when Yahoo can't resolve the ISIN.
 * @returns the resolved ticker (never throws — falls back to brokerSymbol).
 */
export async function resolveTickerWith(
  isin: string,
  brokerSymbol: string,
  deps: ResolveTickerDeps,
): Promise<string> {
  // 1. Cache hit.
  const cached = await deps.profiles.getByIsin(isin).catch(() => null);
  if (cached?.ticker) return cached.ticker;

  // 2. Cache miss → discover the ticker via Yahoo's ISIN search.
  const hits = await deps.provider.search(isin).catch(() => []);
  const ticker = hits[0]?.ticker;
  if (!ticker) return brokerSymbol; // 3. unresolved — fall back.

  // Enrich + cache the profile so future imports/tiles skip the network. A
  // failed enrichment must not fail the import, so we still return the ticker.
  const profile = await deps.provider.profile(ticker).catch(() => null);
  await deps.profiles
    .upsert(toCreate(ticker, isin, profile))
    .catch(() => undefined);

  return ticker;
}

/** Map a provider profile (or a minimal stub) to a symbol_profiles create row. */
function toCreate(
  ticker: string,
  isin: string,
  profile: ProviderProfile | null,
): SymbolProfileCreate {
  if (!profile) {
    // Yahoo found the ticker via search but the profile fetch failed — cache the
    // ISIN→ticker mapping with the minimum required fields so the next import is
    // still a cache hit.
    return { ticker, isin, name: ticker, asset_type: 'other' };
  }
  return {
    ticker,
    isin,
    name: profile.name,
    exchange: profile.exchange,
    asset_type: profile.assetType,
    listing_currency: profile.listingCurrency,
    sector: profile.sector,
    industry: profile.industry,
    country: profile.country,
    market_cap: profile.marketCap,
    pe_ratio: profile.peRatio,
    beta: profile.beta,
    dividend_yield: profile.dividendYield,
    sector_weightings: profile.sectorWeightings ?? null,
    data_source: 'yahoo',
    last_refreshed_at: new Date().toISOString(),
  };
}

/** Production binding: real symbol_profiles repo + Yahoo provider.
 *
 * The real deps (symbol_profiles repo, Yahoo provider) are constructed LAZILY on
 * first use — importing this module for resolveTickerWith() must not require the
 * PB admin env vars (pb.ts throws at import without them), so unit tests can use
 * the injectable function freely. */
let prodDeps: ResolveTickerDeps | undefined;
async function getProdDeps(): Promise<ResolveTickerDeps> {
  if (!prodDeps) {
    const { symbolProfilesRepo } = await import('../db/symbolProfiles');
    const { YahooPriceProvider } = await import('../providers/yahoo');
    prodDeps = { profiles: symbolProfilesRepo, provider: new YahooPriceProvider() };
  }
  return prodDeps;
}

export async function resolveTicker(
  isin: string,
  brokerSymbol: string,
): Promise<string> {
  return resolveTickerWith(isin, brokerSymbol, await getProdDeps());
}
