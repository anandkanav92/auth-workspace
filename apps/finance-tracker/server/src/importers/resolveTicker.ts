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
  //    pick the listing that best matches the broker symbol + expected currency.
  const hits = await deps.provider.search(isin).catch(() => []);
  let ticker = pickHit(hits, brokerSymbol, want)?.ticker;
  let profile = ticker
    ? await deps.provider.profile(ticker).catch(() => null)
    : null;

  // 3. Validate against the statement currency. Yahoo's ISIN search is patchy —
  //    it returns NOTHING for many ETC/ETF ISINs (the gold ETC IE00B4ND3602, the
  //    EUR-hedged world ETF IE00B441G979) and a same-named US PENNY STOCK for
  //    others ("SGLN" → SurgLine, $0.0001). When the picked hit can't be
  //    confirmed in the right currency, probe symbols CONSTRUCTED from the broker
  //    symbol + the venue for that currency (SGLN+GBP → SGLN.L) and keep the
  //    first whose listing currency actually matches.
  if (want && !currencyMatches(profile?.listingCurrency, want)) {
    const probed = await probeConstructed(brokerSymbol, want, deps.provider);
    if (probed) {
      ticker = probed.ticker;
      profile = probed.profile;
    }
  }

  if (!ticker) return brokerSymbol; // 4. unresolved — fall back.

  // Enrich + cache the profile so future imports/tiles skip the network. A
  // failed enrichment must not fail the import, so we still return the ticker.
  await deps.profiles
    .upsert(toCreate(ticker, isin, profile))
    .catch(() => undefined);

  return ticker;
}

/** Yahoo exchange suffixes to try for each currency, most-likely first. */
const CURRENCY_SUFFIXES: Record<string, string[]> = {
  GBP: ['.L'],
  USD: ['', '.L'], // bare US listing, or a USD line on the LSE (e.g. IGLN.L)
  EUR: ['.AS', '.DE', '.MI', '.PA', '.F'],
};

/**
 * Probe symbols built from `brokerSymbol` + each candidate venue suffix and
 * return the first whose fetched profile actually trades in `want`. Best-effort;
 * returns null if none validate (caller then falls back to the broker symbol).
 */
async function probeConstructed(
  brokerSymbol: string,
  want: string,
  provider: Pick<PriceProvider, 'profile'>,
): Promise<{ ticker: string; profile: ProviderProfile } | null> {
  for (const suffix of CURRENCY_SUFFIXES[want] ?? ['']) {
    const candidate = brokerSymbol + suffix;
    const profile = await provider.profile(candidate).catch(() => null);
    if (profile && normalizeCurrencyCode(profile.listingCurrency) === want) {
      return { ticker: candidate, profile };
    }
  }
  return null;
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
 * Choose the best search hit, in priority order:
 *   1. matches the broker symbol AND the expected currency's venue
 *   2. matches the broker symbol (it's what the user actually holds — strongest
 *      signal, and the only way to tell apart same-ISIN lines that share a suffix,
 *      e.g. IGLN.L (USD) vs SGLN.L (GBp), since search hits carry no currency)
 *   3. matches the expected currency's venue
 *   4. Yahoo's first hit (the previous behaviour — strictly a safe fallback)
 *
 * A hit "matches the broker symbol" when its ticker equals the symbol or is that
 * symbol plus an exchange suffix (SGLN → SGLN.L).
 */
function pickHit(
  hits: SearchResult[],
  brokerSymbol: string,
  want: string | undefined,
): SearchResult | undefined {
  if (hits.length === 0) return undefined;
  const sym = brokerSymbol.toUpperCase();
  const symMatch = (h: SearchResult) => {
    const t = h.ticker.toUpperCase();
    return t === sym || t.startsWith(sym + '.');
  };
  const venueMatch = (h: SearchResult) =>
    want ? venueMatchesCurrency(h, want) : false;
  return (
    hits.find((h) => symMatch(h) && venueMatch(h)) ??
    hits.find((h) => symMatch(h)) ??
    hits.find((h) => venueMatch(h)) ??
    hits[0]
  );
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
