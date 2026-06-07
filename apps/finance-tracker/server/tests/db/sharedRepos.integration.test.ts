// INTEGRATION TEST (not a unit test): exercises the three shared market-data
// repos (symbol_profiles, price_cache, fx_rates) against a real, locally-
// spawned PocketBase v0.23.11 with our committed migrations applied (see
// tests/pb-test-server.ts globalSetup).
//
// Asserts per repo:
//   1. upsert creates a new row when the key is absent.
//   2. upsert UPDATES the existing row (no duplicate) when the key is present —
//      this also proves the parameterized key filter matches the stored value.
//   3. get(key) returns the row, and null for an unknown key.
//   4. list() returns all rows.
//
// Writes go through pbAdmin() (admin token); globalSetup points
// PB_ADMIN_EMAIL/PB_ADMIN_PASSWORD at the seeded superuser.

import { describe, it, expect } from 'vitest';
import { symbolProfilesRepo } from '../../src/db/symbolProfiles';
import { priceCacheRepo } from '../../src/db/priceCache';
import { fxRatesRepo } from '../../src/db/fxRates';

describe('SymbolProfilesRepo', () => {
  it('upserts (create then update), gets, and lists', async () => {
    const ticker = 'AAPL';
    const created = await symbolProfilesRepo.upsert({
      ticker,
      name: 'Apple Inc.',
      asset_type: 'stock',
      sector: 'Technology',
      country: 'United States',
      data_source: 'yahoo',
    });
    expect(created.id).toBeTruthy();
    expect(created.sector).toBe('Technology');

    // Second upsert with same ticker must UPDATE, not create a duplicate.
    const updated = await symbolProfilesRepo.upsert({
      ticker,
      name: 'Apple Inc.',
      asset_type: 'stock',
      sector: 'Information Technology',
      data_source: 'yahoo',
    });
    expect(updated.id).toBe(created.id); // same row
    expect(updated.sector).toBe('Information Technology');

    const got = await symbolProfilesRepo.get(ticker);
    expect(got?.id).toBe(created.id);

    const all = await symbolProfilesRepo.list();
    expect(all.filter((p) => p.ticker === ticker)).toHaveLength(1); // no dup
  });

  it('preserves ETF sector_weightings through upsert', async () => {
    const got = await symbolProfilesRepo.upsert({
      ticker: 'VWRL.L',
      name: 'Vanguard FTSE All-World',
      asset_type: 'etf',
      sector_weightings: { technology: 0.24, financials: 0.16 },
      data_source: 'yahoo',
    });
    const read = await symbolProfilesRepo.get('VWRL.L');
    expect(read?.asset_type).toBe('etf');
    expect(read?.sector_weightings?.technology).toBe(0.24);
    expect(got.id).toBe(read?.id);
  });

  it('get returns null for an unknown ticker', async () => {
    expect(await symbolProfilesRepo.get('NOPE-XYZ')).toBeNull();
  });
});

describe('PriceCacheRepo', () => {
  it('upserts (create then update), gets, and lists', async () => {
    const ticker = 'MSFT';
    const created = await priceCacheRepo.upsert({
      ticker,
      price: 400,
      currency: 'USD',
      data_source: 'yahoo',
    });
    expect(created.price).toBe(400);

    const updated = await priceCacheRepo.upsert({
      ticker,
      price: 415.5,
      currency: 'USD',
      data_source: 'yahoo',
    });
    expect(updated.id).toBe(created.id);
    expect(updated.price).toBe(415.5);

    const got = await priceCacheRepo.get(ticker);
    expect(got?.price).toBe(415.5);

    const all = await priceCacheRepo.list();
    expect(all.filter((p) => p.ticker === ticker)).toHaveLength(1);
  });
});

describe('FxRatesRepo', () => {
  it('upserts by date (create then update), gets, and lists', async () => {
    const date = '2026-06-06 00:00:00.000Z';
    const created = await fxRatesRepo.upsert({
      date,
      rates: { EUR: 1, USD: 1.08, GBP: 0.85 },
    });
    expect(created.id).toBeTruthy();
    expect(created.rates.USD).toBe(1.08);

    // Same date → update (the daily refresh re-running), not a new row.
    const updated = await fxRatesRepo.upsert({
      date,
      rates: { EUR: 1, USD: 1.09, GBP: 0.86, JPY: 170 },
    });
    expect(updated.id).toBe(created.id);
    expect(updated.rates.USD).toBe(1.09);
    expect(updated.rates.JPY).toBe(170);

    const got = await fxRatesRepo.get(date);
    expect(got?.id).toBe(created.id);

    const all = await fxRatesRepo.list();
    expect(all.filter((r) => r.id === created.id)).toHaveLength(1);
  });
});
