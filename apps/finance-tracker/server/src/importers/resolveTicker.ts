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
import type {
  PriceProvider,
  SymbolProfile as ProviderProfile,
  SearchResult,
} from '../providers/types';
import type { SymbolProfileCreate } from '../db/schemas';
import { normalizeCurrencyCode } from '../providers/currency';

export interface ResolveTickerDeps {
  profiles: Pick<SymbolProfilesRepo, 'getByIsin' | 'upsert'>;
  provider: Pick<PriceProvider, 'search' | 'profile'>;
}

/**
 * Resolve a broker symbol + ISIN to the canonical ticker, caching a freshly
 * fetched profile when the ISIN wasn't already known.
 *
 * CURRENCY-AWARENESS (bug fix): a single ISIN can have several listings in
 * different currencies (e.g. iShares Physical Gold IE00B4ND3602 trades as SGLN.L
 * in GBp AND IGLN.L in USD), and Yahoo's ISIN search frequently returns an
 * unrelated same-named US penny stock as the FIRST hit (e.g. bare "SGLN"). Both
 * cases silently produced wrong prices/profiles. So when the statement tells us
 * the instrument currency we (a) only trust a cached hit whose listing currency
 * matches, and (b) prefer the search hit whose venue matches that currency.
 *
 * @param isin          ISO 6166 id from the statement (the lookup key).
 * @param brokerSymbol  the symbol the broker printed; used as the fallback
 *                      ticker when Yahoo can't resolve the ISIN.
 * @param expectedCurrency the statement's instrument currency (already pence-
 *                      normalised by the caller); steers listing selection.
 * @returns the resolved ticker (never throws — falls back to brokerSymbol).
 */
export async function resolveTickerWith(
  isin: string,
  brokerSymbol: string,
  deps: ResolveTickerDeps,
  expectedCurrency?: string,
): Promise<string> {
  const want = normalizeCurrencyCode(expectedCurrency);

  // 1. Cache hit — but only trust it when its listing currency matches the
  //    statement (so multi-listing ISINs don't cross-contaminate).
  const cached = await deps.profiles.getByIsin(isin).catch(() => null);
  if (cached?.ticker && currencyMatches(cached.listing_currency, want)) {
    return cached.ticker;
  }

  // 2. Cache miss / currency mismatch → discover via Yahoo's ISIN search and
  //    pick the listing whose venue matches the expected currency.
  const hits = await deps.provider.search(isin).catch(() => []);
  const ticker = pickHit(hits, want)?.ticker;
  if (!ticker) return brokerSymbol; // 3. unresolved — fall back.

  // Enrich + cache the profile so future imports/tiles skip the network. A
  // failed enrichment must not fail the import, so we still return the ticker.
  const profile = await deps.provider.profile(ticker).catch(() => null);
  await deps.profiles
    .upsert(toCreate(ticker, isin, profile))
    .catch(() => undefined);

  return ticker;
}

/** True when no currency expectation, or the (normalised) listing matches it. */
function currencyMatches(
  listingCurrency: string | undefined,
  want: string | undefined,
): boolean {
  if (!want) return true; // no expectation → any cached hit is fine
  return normalizeCurrencyCode(listingCurrency) === want;
}

/**
 * Choose the search hit whose venue best matches the expected currency. With no
 * expectation (or no venue match) we keep Yahoo's first hit — the previous
 * behaviour — so this is strictly safer, never worse.
 */
function pickHit(
  hits: SearchResult[],
  want: string | undefined,
): SearchResult | undefined {
  if (hits.length === 0) return undefined;
  if (!want) return hits[0];
  return hits.find((h) => venueMatchesCurrency(h, want)) ?? hits[0];
}

/**
 * Heuristic: does this hit's ticker suffix / exchange match the target currency?
 *  - GBP → London (".L" suffix or LSE exchange)
 *  - USD → a US listing (no exchange suffix on Yahoo, e.g. "AAPL")
 *  - EUR → a Euronext/Xetra/Borsa listing (".DE/.AS/.PA/.MI/…")
 */
function venueMatchesCurrency(hit: SearchResult, want: string): boolean {
  const t = hit.ticker;
  const x = (hit.exchange || '').toUpperCase();
  switch (want) {
    case 'GBP':
      return t.endsWith('.L') || x.includes('LSE') || x.includes('LON');
    case 'USD':
      return !t.includes('.');
    case 'EUR':
      return (
        /\.(DE|AS|PA|MI|F|BR|LS|MC|VI|HE|IR|AT|DU|MU|SG|HM)$/i.test(t) ||
        /GER|XETRA|AMS|PAR|MIL|FRA|EBR|LIS|MCE|WBO|HEL|ISE|ATH/.test(x)
      );
    default:
      return false;
  }
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
    data_source: profile.source ?? 'yahoo', // true provenance from the chain
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
  expectedCurrency?: string,
): Promise<string> {
  return resolveTickerWith(
    isin,
    brokerSymbol,
    await getProdDeps(),
    expectedCurrency,
  );
}
