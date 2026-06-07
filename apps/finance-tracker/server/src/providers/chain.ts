import type { PriceProvider, Quote, SymbolProfile, SearchResult } from './types';

// Tries providers in order, returning the first non-null quote/profile and the
// first non-empty search result. A provider that throws is treated as a miss so
// one flaky upstream never breaks the chain.
//
// PROVENANCE (M2/M3 follow-up): the chain is a composite, so its own `name` is
// nominal only — it does NOT identify which upstream actually answered. Each
// Quote / SymbolProfile now carries its own `source` (set by the answering
// provider), so callers that persist `data_source` MUST read `result.source`,
// never `chain.name`. `name` stays 'yahoo' purely to satisfy the interface.
export class ProviderChain implements PriceProvider {
  name = 'yahoo' as const;
  constructor(private providers: PriceProvider[]) {}

  async quote(ticker: string): Promise<Quote | null> {
    return this.firstNonNull((p) => p.quote(ticker));
  }

  async profile(ticker: string): Promise<SymbolProfile | null> {
    return this.firstNonNull((p) => p.profile(ticker));
  }

  async search(query: string): Promise<SearchResult[]> {
    for (const p of this.providers) {
      const r = await p.search(query).catch(() => []);
      if (r.length) return r;
    }
    return [];
  }

  private async firstNonNull<T>(fn: (p: PriceProvider) => Promise<T | null>): Promise<T | null> {
    for (const p of this.providers) {
      const r = await fn(p).catch(() => null);
      if (r) return r;
    }
    return null;
  }
}
