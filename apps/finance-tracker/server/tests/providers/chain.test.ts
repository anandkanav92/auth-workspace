import { describe, it, expect, vi } from 'vitest';
import type { PriceProvider, Quote, SymbolProfile, SearchResult } from '../../src/providers/types';
import { ProviderChain } from '../../src/providers/chain';

function makeQuote(ticker: string, price: number): Quote {
  return { ticker, price, currency: 'USD', asOf: new Date(0) };
}

function makeProfile(ticker: string, name: string): SymbolProfile {
  return { ticker, name, exchange: 'X', assetType: 'stock', listingCurrency: 'USD' };
}

// Minimal fake honoring the PriceProvider contract. Each method is a vi.fn so
// we can assert call/skip behavior of the fallback chain.
function fakeProvider(
  name: PriceProvider['name'],
  overrides: Partial<{
    quote: Quote | null;
    profile: SymbolProfile | null;
    search: SearchResult[];
  }>,
): PriceProvider {
  return {
    name,
    quote: vi.fn().mockResolvedValue(overrides.quote ?? null),
    profile: vi.fn().mockResolvedValue(overrides.profile ?? null),
    search: vi.fn().mockResolvedValue(overrides.search ?? []),
  };
}

describe('ProviderChain', () => {
  it('uses the first provider (yahoo) when it returns a quote', async () => {
    const yahoo = fakeProvider('yahoo', { quote: makeQuote('AAPL', 100) });
    const finnhub = fakeProvider('finnhub', { quote: makeQuote('AAPL', 999) });
    const chain = new ProviderChain([yahoo, finnhub]);

    const q = await chain.quote('AAPL');
    expect(q?.price).toBe(100);
    expect(finnhub.quote).not.toHaveBeenCalled(); // short-circuits on first hit
  });

  it('falls back to finnhub when yahoo returns null', async () => {
    const yahoo = fakeProvider('yahoo', { quote: null });
    const finnhub = fakeProvider('finnhub', { quote: makeQuote('AAPL', 250) });
    const chain = new ProviderChain([yahoo, finnhub]);

    const q = await chain.quote('AAPL');
    expect(q?.price).toBe(250);
    expect(yahoo.quote).toHaveBeenCalledOnce();
  });

  it('falls back to finnhub when yahoo throws', async () => {
    const yahoo: PriceProvider = {
      name: 'yahoo',
      quote: vi.fn().mockRejectedValue(new Error('boom')),
      profile: vi.fn().mockResolvedValue(null),
      search: vi.fn().mockResolvedValue([]),
    };
    const finnhub = fakeProvider('finnhub', { quote: makeQuote('AAPL', 42) });
    const chain = new ProviderChain([yahoo, finnhub]);

    expect((await chain.quote('AAPL'))?.price).toBe(42);
  });

  it('returns null when all providers return null', async () => {
    const chain = new ProviderChain([
      fakeProvider('yahoo', { quote: null }),
      fakeProvider('finnhub', { quote: null }),
    ]);
    expect(await chain.quote('NOPE')).toBeNull();
  });

  it('uses first non-null profile (falls back to finnhub)', async () => {
    const yahoo = fakeProvider('yahoo', { profile: null });
    const finnhub = fakeProvider('finnhub', { profile: makeProfile('AAPL', 'Apple Inc') });
    const chain = new ProviderChain([yahoo, finnhub]);

    const prof = await chain.profile('AAPL');
    expect(prof?.name).toBe('Apple Inc');
  });

  it('returns first non-empty search result', async () => {
    const yahoo = fakeProvider('yahoo', { search: [] });
    const finnhub = fakeProvider('finnhub', {
      search: [{ ticker: 'AAPL', name: 'Apple', exchange: '' }],
    });
    const chain = new ProviderChain([yahoo, finnhub]);

    const results = await chain.search('apple');
    expect(results).toHaveLength(1);
    expect(results[0].ticker).toBe('AAPL');
  });
});
