// Weekly profile-refresh cron (M8.5). Finds symbol_profiles whose
// last_refreshed_at is older than 7 days (or never set) and re-fetches each via
// the provider chain, upserting the fresh data back into symbol_profiles.
//
// Idempotency: symbol_profiles is keyed on `ticker` (SharedRepo.upsert), so a
// refresh overwrites the existing row and bumps last_refreshed_at — a re-run on
// the same day finds nothing stale and does no work. Per-ticker try/catch keeps
// one bad symbol from aborting the batch; a null provider result is left
// untouched (we don't clobber good cached data with nothing).
//
// data_source records the TRUE provenance from the answering provider (the chain
// stamps each profile's `source`), falling back to 'yahoo'.
//
// Deps are injected for unit testing; runRefreshProfiles() binds the real repo +
// Yahoo→Finnhub chain.

import type { SymbolProfilesRepo } from '../db/symbolProfiles';
import type { PriceProvider, SymbolProfile as ProviderProfile } from '../providers/types';
import type { SymbolProfile, SymbolProfileCreate } from '../db/schemas';
import { isoDaysAgo } from './time';

const STALE_AFTER_DAYS = 7;

export interface RefreshProfilesDeps {
  profiles: Pick<SymbolProfilesRepo, 'listStale' | 'upsert'>;
  provider: Pick<PriceProvider, 'profile'>;
  /** Injectable clock for deterministic tests; defaults to now. */
  now?: () => Date;
}

export interface RefreshProfilesResult {
  /** Stale profiles considered. */
  stale: number;
  /** Profiles successfully re-fetched + upserted. */
  refreshed: number;
  /** Profiles the provider returned null for (left untouched). */
  missed: number;
  /** Profiles that threw during fetch/upsert (logged, not fatal). */
  failed: number;
}

/**
 * Refresh every symbol_profiles row not updated in the last 7 days. Never throws
 * on a per-ticker failure.
 */
export async function runRefreshProfilesWith(
  deps: RefreshProfilesDeps,
): Promise<RefreshProfilesResult> {
  const now = deps.now?.() ?? new Date();
  const cutoff = isoDaysAgo(STALE_AFTER_DAYS, now);
  const stale = await deps.profiles.listStale(cutoff);

  let refreshed = 0;
  let missed = 0;
  let failed = 0;

  for (const existing of stale) {
    try {
      const fresh = await deps.provider.profile(existing.ticker);
      if (!fresh) {
        // Don't clobber a good cached row with nothing — leave it for next week.
        missed++;
        continue;
      }
      await deps.profiles.upsert(toCreate(existing, fresh, now));
      refreshed++;
    } catch (err) {
      failed++;
      console.error(`[cron:refreshProfiles] ${existing.ticker} failed:`, err);
    }
  }

  return { stale: stale.length, refreshed, missed, failed };
}

/**
 * Merge a freshly fetched provider profile onto the existing cached row,
 * preserving the canonical `ticker` + `isin` join keys and bumping
 * last_refreshed_at.
 */
function toCreate(
  existing: SymbolProfile,
  fresh: ProviderProfile,
  now: Date,
): SymbolProfileCreate {
  return {
    ticker: existing.ticker,
    isin: fresh.isin ?? existing.isin,
    name: fresh.name,
    exchange: fresh.exchange,
    asset_type: fresh.assetType,
    listing_currency: fresh.listingCurrency,
    sector: fresh.sector,
    industry: fresh.industry,
    country: fresh.country,
    market_cap: fresh.marketCap,
    pe_ratio: fresh.peRatio,
    beta: fresh.beta,
    dividend_yield: fresh.dividendYield,
    sector_weightings: fresh.sectorWeightings ?? null,
    data_source: fresh.source ?? 'yahoo', // true provenance from the chain
    last_refreshed_at: now.toISOString(),
  };
}

// --- Production binding: real repo + Yahoo→Finnhub chain ----------------------
let prodDeps: RefreshProfilesDeps | undefined;
async function getProdDeps(): Promise<RefreshProfilesDeps> {
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

export async function runRefreshProfiles(): Promise<RefreshProfilesResult> {
  return runRefreshProfilesWith(await getProdDeps());
}
