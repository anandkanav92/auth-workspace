// Which upstream answered a given call. Set by each provider and PRESERVED by
// ProviderChain so callers writing price_cache / symbol_profiles can record the
// true `data_source` instead of mislabeling everything 'yahoo' (M2/M3 follow-up:
// the chain's own `name` was hardcoded 'yahoo'). Optional so older fixtures /
// fakes that omit it still type-check.
export type ProviderName = 'yahoo' | 'finnhub';

export type Quote = {
  ticker: string;
  price: number;
  currency: string;
  asOf: Date;
  source?: ProviderName;
};

export type SymbolProfile = {
  ticker: string;
  isin?: string;
  name: string;
  exchange: string;
  assetType: 'stock' | 'etf' | 'other'; // spike 3: drives allocation look-through
  listingCurrency: string;
  sector?: string;
  industry?: string;
  country?: string;
  marketCap?: number;
  peRatio?: number;
  beta?: number;
  dividendYield?: number;
  sectorWeightings?: Record<string, number>; // ETFs only: sector → weight
  source?: ProviderName;
};

export type SearchResult = { ticker: string; name: string; exchange: string };

export interface PriceProvider {
  name: ProviderName;
  quote(ticker: string): Promise<Quote | null>;
  profile(ticker: string): Promise<SymbolProfile | null>;
  search(query: string): Promise<SearchResult[]>;
}

export interface FxProvider {
  name: 'ecb';
  latest(): Promise<Record<string, number>>;
}
