// Unit tests for the Zod schemas mirroring the 8 PocketBase collections.
// Pure (no PocketBase) — they assert valid payloads parse and invalid ones are
// rejected, with focus on the tricky nullability the design calls out:
//   - holdings.cost_basis / cost_currency are nullable
//   - symbol_profiles has asset_type + sector_weightings
import { describe, it, expect } from 'vitest';
import {
  accountSchema,
  accountCreateSchema,
  holdingSchema,
  holdingCreateSchema,
  transactionCreateSchema,
  importCreateSchema,
  holdingsSnapshotCreateSchema,
  symbolProfileSchema,
  symbolProfileCreateSchema,
  priceCacheCreateSchema,
  fxRatesCreateSchema,
} from '../../src/db/schemas';

describe('accountSchema', () => {
  it('parses a valid persisted account record', () => {
    const r = accountSchema.parse({
      id: 'acc1',
      created: '2026-06-06 00:00:00Z',
      updated: '2026-06-06 00:00:00Z',
      user: 'u1',
      source: 'manual',
      label: 'Manual EUR',
    });
    expect(r.currency).toBeUndefined();
  });

  it('rejects an unknown source', () => {
    expect(() =>
      accountCreateSchema.parse({ user: 'u1', source: 'coinbase', label: 'x' }),
    ).toThrow();
  });

  it('rejects an empty label', () => {
    expect(() =>
      accountCreateSchema.parse({ user: 'u1', source: 'manual', label: '' }),
    ).toThrow();
  });
});

describe('holdingSchema', () => {
  it('accepts a null cost_basis + cost_currency (Revolut PDF case)', () => {
    const r = holdingSchema.parse({
      id: 'h1',
      created: '2026-06-06 00:00:00Z',
      updated: '2026-06-06 00:00:00Z',
      user: 'u1',
      account: 'a1',
      ticker: 'AAPL',
      quantity: 10,
      cost_basis: null,
      cost_currency: null,
      source: 'revolut',
    });
    expect(r.cost_basis).toBeNull();
    expect(r.cost_currency).toBeNull();
  });

  it('accepts a numeric cost_basis with cost_currency (manual case)', () => {
    const r = holdingCreateSchema.parse({
      user: 'u1',
      account: 'a1',
      ticker: 'MSFT',
      quantity: 5,
      cost_basis: 1500,
      cost_currency: 'USD',
      source: 'manual',
    });
    expect(r.cost_basis).toBe(1500);
  });

  it('rejects a non-numeric quantity', () => {
    expect(() =>
      holdingCreateSchema.parse({
        user: 'u1',
        account: 'a1',
        ticker: 'AAPL',
        quantity: '10',
        source: 'manual',
      }),
    ).toThrow();
  });

  it('rejects a missing ticker', () => {
    expect(() =>
      holdingCreateSchema.parse({
        user: 'u1',
        account: 'a1',
        quantity: 1,
        source: 'manual',
      }),
    ).toThrow();
  });
});

describe('transactionCreateSchema', () => {
  it('parses a valid buy transaction', () => {
    const r = transactionCreateSchema.parse({
      user: 'u1',
      account: 'a1',
      type: 'buy',
      ticker: 'AAPL',
      quantity: 3,
      price: 200,
      currency: 'USD',
      occurred_at: '2026-06-06 00:00:00Z',
      source: 'manual',
    });
    expect(r.type).toBe('buy');
  });

  it('rejects an unknown transaction type', () => {
    expect(() =>
      transactionCreateSchema.parse({
        user: 'u1',
        account: 'a1',
        type: 'transfer',
        ticker: 'AAPL',
        quantity: 1,
        price: 1,
        currency: 'USD',
        occurred_at: '2026-06-06 00:00:00Z',
        source: 'manual',
      }),
    ).toThrow();
  });
});

describe('importCreateSchema', () => {
  it('parses a valid import row', () => {
    const r = importCreateSchema.parse({
      user: 'u1',
      account: 'a1',
      source: 'trading212',
      filename: 'statement.pdf',
      file_hash: 'abc123',
      status: 'success',
    });
    expect(r.status).toBe('success');
  });

  it('rejects "manual" as an import source (statement-only enum)', () => {
    expect(() =>
      importCreateSchema.parse({
        user: 'u1',
        account: 'a1',
        source: 'manual',
        filename: 'x.pdf',
        file_hash: 'h',
        status: 'success',
      }),
    ).toThrow();
  });
});

describe('holdingsSnapshotCreateSchema', () => {
  it('parses a valid snapshot row', () => {
    const r = holdingsSnapshotCreateSchema.parse({
      user: 'u1',
      account: 'a1',
      ticker: 'AAPL',
      quantity: 10,
      eur_value: 1800,
      date: '2026-06-06 00:00:00Z',
    });
    expect(r.eur_value).toBe(1800);
  });

  it('rejects a missing eur_value', () => {
    expect(() =>
      holdingsSnapshotCreateSchema.parse({
        user: 'u1',
        account: 'a1',
        ticker: 'AAPL',
        quantity: 10,
        date: '2026-06-06 00:00:00Z',
      }),
    ).toThrow();
  });
});

describe('symbolProfileSchema', () => {
  it('parses an ETF profile with asset_type + sector_weightings', () => {
    const r = symbolProfileSchema.parse({
      id: 'sp1',
      created: '2026-06-06 00:00:00Z',
      updated: '2026-06-06 00:00:00Z',
      ticker: 'VWRL.L',
      name: 'Vanguard FTSE All-World',
      asset_type: 'etf',
      sector_weightings: { technology: 0.24, financials: 0.16 },
      data_source: 'yahoo',
    });
    expect(r.asset_type).toBe('etf');
    expect(r.sector_weightings?.technology).toBe(0.24);
  });

  it('parses a stock profile with null sector_weightings and no sector', () => {
    const r = symbolProfileCreateSchema.parse({
      ticker: 'AAPL',
      name: 'Apple Inc.',
      asset_type: 'stock',
      sector: 'Technology',
      country: 'United States',
      market_cap: 3_000_000_000_000,
    });
    expect(r.sector).toBe('Technology');
  });

  it('rejects an unknown asset_type', () => {
    expect(() =>
      symbolProfileCreateSchema.parse({
        ticker: 'AAPL',
        name: 'Apple Inc.',
        asset_type: 'crypto',
      }),
    ).toThrow();
  });

  it('rejects non-numeric sector_weightings values', () => {
    expect(() =>
      symbolProfileCreateSchema.parse({
        ticker: 'VWRL.L',
        name: 'x',
        asset_type: 'etf',
        sector_weightings: { technology: 'lots' },
      }),
    ).toThrow();
  });
});

describe('priceCacheCreateSchema', () => {
  it('parses a valid price row', () => {
    const r = priceCacheCreateSchema.parse({
      ticker: 'AAPL',
      price: 201.5,
      currency: 'USD',
      data_source: 'yahoo',
    });
    expect(r.price).toBe(201.5);
  });

  it('rejects a missing price', () => {
    expect(() =>
      priceCacheCreateSchema.parse({ ticker: 'AAPL', currency: 'USD' }),
    ).toThrow();
  });
});

describe('fxRatesCreateSchema', () => {
  it('parses a valid rates map', () => {
    const r = fxRatesCreateSchema.parse({
      date: '2026-06-06',
      rates: { EUR: 1, USD: 1.08, GBP: 0.85 },
    });
    expect(r.rates.USD).toBe(1.08);
  });

  it('rejects a non-numeric rate value', () => {
    expect(() =>
      fxRatesCreateSchema.parse({
        date: '2026-06-06',
        rates: { USD: 'a lot' },
      }),
    ).toThrow();
  });
});
