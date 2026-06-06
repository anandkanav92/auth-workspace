export type Quote = { ticker: string; price: number; currency: string; asOf: Date };

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
};

export type SearchResult = { ticker: string; name: string; exchange: string };

export interface PriceProvider {
  name: 'yahoo' | 'finnhub';
  quote(ticker: string): Promise<Quote | null>;
  profile(ticker: string): Promise<SymbolProfile | null>;
  search(query: string): Promise<SearchResult[]>;
}

export interface FxProvider {
  name: 'ecb';
  latest(): Promise<Record<string, number>>;
}
