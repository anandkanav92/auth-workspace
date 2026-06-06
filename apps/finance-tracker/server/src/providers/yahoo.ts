import YahooFinance from 'yahoo-finance2';
import type { PriceProvider, Quote, SymbolProfile, SearchResult } from './types';

// Spike 3 findings (see docs/spikes/2026-06-06-spikes-3-4-results.md):
//   1. yahoo-finance2 v3 requires `new YahooFinance()` — the v2 default-singleton
//      import throws. We construct ONE instance in the constructor.
//   2. ETFs return NULL sector/country/marketCap via assetProfile. For ETFs we
//      branch on quoteType and pull topHoldings.sectorWeightings so the
//      Allocation tile can do sector look-through (VWRL.L, IWDA.AS, etc).
export class YahooPriceProvider implements PriceProvider {
  name = 'yahoo' as const;
  private yf = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

  private async getSummary(ticker: string, modules: string[]) {
    try {
      return await this.yf.quoteSummary(ticker, { modules: modules as never });
    } catch {
      return null;
    }
  }

  async quote(ticker: string): Promise<Quote | null> {
    const s = await this.getSummary(ticker, ['price']);
    if (!s?.price?.regularMarketPrice) return null;
    return {
      ticker,
      price: s.price.regularMarketPrice,
      currency: s.price.currency!,
      asOf: new Date((s.price.regularMarketTime as Date) || Date.now()),
    };
  }

  async profile(ticker: string): Promise<SymbolProfile | null> {
    const s = await this.getSummary(ticker, [
      'price',
      'summaryDetail',
      'assetProfile',
      'defaultKeyStatistics',
      'quoteType',
    ]);
    if (!s?.price) return null;

    const assetType: SymbolProfile['assetType'] =
      s.quoteType?.quoteType === 'ETF'
        ? 'etf'
        : s.quoteType?.quoteType === 'EQUITY'
          ? 'stock'
          : 'other';

    let sectorWeightings: Record<string, number> | undefined;
    if (assetType === 'etf') {
      const th = await this.getSummary(ticker, ['topHoldings']);
      const raw = th?.topHoldings?.sectorWeightings;
      if (raw) {
        sectorWeightings = {};
        for (const entry of raw) {
          const [k, v] = Object.entries(entry)[0] as [string, number];
          sectorWeightings[k] = v;
        }
      }
    }

    return {
      ticker,
      assetType,
      name: s.price.longName || s.price.shortName || ticker,
      exchange: s.price.exchangeName!,
      listingCurrency: s.price.currency!,
      sector: s.assetProfile?.sector, // null for ETFs — expected
      industry: s.assetProfile?.industry,
      country: s.assetProfile?.country, // null for ETFs — expected
      marketCap: s.price.marketCap,
      peRatio: s.summaryDetail?.trailingPE,
      beta: s.defaultKeyStatistics?.beta,
      dividendYield: s.summaryDetail?.dividendYield,
      sectorWeightings, // populated only for ETFs
    };
  }

  async search(query: string): Promise<SearchResult[]> {
    const res = await this.yf.search(query, { quotesCount: 10, newsCount: 0 });
    const results: SearchResult[] = [];
    for (const raw of res.quotes || []) {
      // The search-quote union mixes equities, ETFs, indices and (suppressed)
      // news items; only symbol-bearing entries are tradeable instruments.
      const q = raw as { symbol?: string; longname?: string; shortname?: string; exchange?: string };
      if (!q.symbol) continue;
      results.push({
        ticker: q.symbol,
        name: q.longname || q.shortname || q.symbol,
        exchange: q.exchange || '',
      });
    }
    return results;
  }
}
