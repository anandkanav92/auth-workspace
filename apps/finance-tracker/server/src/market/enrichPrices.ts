// Shared price enrichment (bug fix: "sync/import shows €0").
//
// `buildPortfolio` values a position at `quantity × (price_cache price) → EUR`,
// so a holding whose ticker has NO price_cache row values to €0 — dragging the
// total (and its return → a fake −100%) down. The statement-import path already
// fetches a live quote per imported ticker; the Trading 212 SYNC path did not,
// so freshly-synced tickers stayed €0 until the next refreshPrices cron run
// (the "value was half, then jumped overnight" report).
//
// This is the single place that does "fetch a quote → upsert price_cache", used
// by BOTH the import route and the sync service, so the two never drift. It is
// BEST-EFFORT by design: a failed quote for one ticker must not abort the others
// or fail the surrounding sync/import (prices also get refreshed by the cron).
//
// Deps are injected so the core is unit-testable without the network or
// PocketBase; `enrichPrices()` binds the real Yahoo provider + price_cache repo.

import type { PriceProvider } from '../providers/types';
import type { PriceCacheRepo } from '../db/priceCache';

export interface EnrichPricesDeps {
  provider: Pick<PriceProvider, 'quote'>;
  prices: Pick<PriceCacheRepo, 'upsert'>;
}

/**
 * Fetch a live quote for each (unique, non-blank) ticker and upsert it into
 * price_cache. Returns once every ticker has been attempted; individual
 * failures are swallowed (the cron is the backstop).
 */
export async function enrichPricesWith(
  tickers: string[],
  deps: EnrichPricesDeps,
): Promise<void> {
  const unique = [...new Set(tickers.map((t) => t.trim()).filter(Boolean))];
  await Promise.all(
    unique.map(async (ticker) => {
      const quote = await deps.provider.quote(ticker).catch(() => null);
      if (!quote) return;
      await deps.prices
        .upsert({
          ticker: quote.ticker,
          price: quote.price,
          currency: quote.currency,
          as_of: quote.asOf.toISOString(),
          last_fetched_at: new Date().toISOString(),
          data_source: quote.source ?? 'yahoo',
        })
        .catch(() => undefined);
    }),
  );
}

// --- production binding -------------------------------------------------------
let prodDeps: EnrichPricesDeps | undefined;
async function getProdDeps(): Promise<EnrichPricesDeps> {
  if (!prodDeps) {
    const { YahooPriceProvider } = await import('../providers/yahoo');
    const { priceCacheRepo } = await import('../db/priceCache');
    prodDeps = { provider: new YahooPriceProvider(), prices: priceCacheRepo };
  }
  return prodDeps;
}

/** Enrich price_cache for the given tickers using the real Yahoo provider. */
export async function enrichPrices(tickers: string[]): Promise<void> {
  return enrichPricesWith(tickers, await getProdDeps());
}
