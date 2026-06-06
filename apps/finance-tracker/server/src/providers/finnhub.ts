import type { PriceProvider, Quote, SymbolProfile, SearchResult } from './types';

// Finnhub's API is trivial — plain fetch, no SDK dependency needed.
// Docs: https://finnhub.io/docs/api
//   /quote          -> { c, h, l, o, pc, t }
//   /stock/profile2 -> { name, exchange, currency, country, marketCapitalization, ... }
//   /search         -> { count, result: [{ symbol, description, ... }] }
export class FinnhubPriceProvider implements PriceProvider {
  name = 'finnhub' as const;
  constructor(private apiKey = process.env.FINNHUB_API_KEY!) {}

  async quote(ticker: string): Promise<Quote | null> {
    const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${this.apiKey}`);
    if (!r.ok) return null;
    const j = (await r.json()) as { c?: number; t?: number };
    if (!j.c) return null;
    return { ticker, price: j.c, currency: 'USD', asOf: new Date((j.t ?? 0) * 1000) };
  }

  async profile(ticker: string): Promise<SymbolProfile | null> {
    const r = await fetch(
      `https://finnhub.io/api/v1/stock/profile2?symbol=${ticker}&token=${this.apiKey}`,
    );
    if (!r.ok) return null;
    const j = (await r.json()) as {
      name?: string;
      exchange?: string;
      currency?: string;
      country?: string;
      marketCapitalization?: number;
    };
    return {
      ticker,
      name: j.name ?? ticker,
      exchange: j.exchange ?? '',
      assetType: 'other',
      listingCurrency: j.currency ?? '',
      country: j.country,
      marketCap: j.marketCapitalization != null ? j.marketCapitalization * 1_000_000 : undefined,
    };
  }

  async search(query: string): Promise<SearchResult[]> {
    const r = await fetch(
      `https://finnhub.io/api/v1/search?q=${encodeURIComponent(query)}&token=${this.apiKey}`,
    );
    if (!r.ok) return [];
    const j = (await r.json()) as { result?: Array<{ symbol: string; description: string }> };
    return (j.result || []).map((s) => ({ ticker: s.symbol, name: s.description, exchange: '' }));
  }
}
