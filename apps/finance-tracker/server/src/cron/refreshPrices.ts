// Hourly price-refresh cron (M8.2). Collects the DISTINCT tickers across ALL
// users' OPEN holdings, fetches a fresh quote for each through the provider
// chain, and upserts price_cache keyed by ticker.
//
// Idempotency: price_cache is keyed on `ticker` (SharedRepo.upsert), so a re-run
// simply overwrites the same row — never duplicates. Per-ticker try/catch means
// one flaky upstream (or one delisted symbol) cannot abort the whole batch; the
// rest still refresh.
//
// `data_source` records the TRUE provenance: the answering provider stamps each
// Quote with `source`, and ProviderChain preserves it. We persist `quote.source`
// (NOT the chain's nominal `name`, which is always 'yahoo') so the cache shows
// which upstream actually answered. Falls back to 'yahoo' only if a fake/older
// provider omitted it.
//
// Deps are injected so the job is unit-testable without PocketBase or the
// network; runRefreshPrices() binds the real repos + Yahoo→Finnhub chain.

import type { HoldingsRepo } from '../db/holdings';
import type { PriceCacheRepo } from '../db/priceCache';
import type { PriceProvider } from '../providers/types';

export interface RefreshPricesDeps {
  holdings: Pick<HoldingsRepo, 'listAllOpen'>;
  priceCache: Pick<PriceCacheRepo, 'upsert'>;
  provider: Pick<PriceProvider, 'quote'>;
}

export interface RefreshPricesResult {
  /** Distinct tickers considered. */
  tickers: number;
  /** Tickers whose quote was fetched + cached. */
  refreshed: number;
  /** Tickers the provider chain couldn't price (null quote). */
  missed: number;
  /** Tickers that threw during fetch/upsert (logged, not fatal). */
  failed: number;
}

/**
 * Refresh price_cache for every distinct ticker held (qty > 0) across all users.
 *
 * @returns counts for logging/monitoring. Never throws on a per-ticker failure.
 */
export async function runRefreshPricesWith(
  deps: RefreshPricesDeps,
): Promise<RefreshPricesResult> {
  const openHoldings = await deps.holdings.listAllOpen();
  const tickers = [...new Set(openHoldings.map((h) => h.ticker))];

  let refreshed = 0;
  let missed = 0;
  let failed = 0;

  for (const ticker of tickers) {
    try {
      const quote = await deps.provider.quote(ticker);
      if (!quote) {
        missed++;
        continue;
      }
      await deps.priceCache.upsert({
        ticker,
        price: quote.price,
        currency: quote.currency,
        as_of: quote.asOf.toISOString(),
        last_fetched_at: new Date().toISOString(),
        data_source: quote.source ?? 'yahoo', // true provenance from the chain
      });
      refreshed++;
    } catch (err) {
      // One failure must not abort the batch — log and move on.
      failed++;
      console.error(`[cron:refreshPrices] ${ticker} failed:`, err);
    }
  }

  return { tickers: tickers.length, refreshed, missed, failed };
}

// --- Production binding: real repos + Yahoo→Finnhub chain --------------------
// Built LAZILY on first run so importing this module (e.g. in a unit test of
// runRefreshPricesWith) does not require the PB admin env vars — pb.ts throws at
// import time without them.
let prodDeps: RefreshPricesDeps | undefined;
async function getProdDeps(): Promise<RefreshPricesDeps> {
  if (!prodDeps) {
    const { holdingsRepo } = await import('../db/holdings');
    const { priceCacheRepo } = await import('../db/priceCache');
    const { ProviderChain } = await import('../providers/chain');
    const { YahooPriceProvider } = await import('../providers/yahoo');
    const { FinnhubPriceProvider } = await import('../providers/finnhub');
    const provider = new ProviderChain([
      new YahooPriceProvider(),
      new FinnhubPriceProvider(),
    ]);
    prodDeps = { holdings: holdingsRepo, priceCache: priceCacheRepo, provider };
  }
  return prodDeps;
}

export async function runRefreshPrices(): Promise<RefreshPricesResult> {
  return runRefreshPricesWith(await getProdDeps());
}
