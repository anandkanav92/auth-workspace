import { describe, it, expect, vi } from 'vitest';
import {
  runRefreshProfilesWith,
  type RefreshProfilesDeps,
} from '../../src/cron/refreshProfiles';
import type { SymbolProfile, SymbolProfileCreate } from '../../src/db/schemas';
import type { SymbolProfile as ProviderProfile } from '../../src/providers/types';

function cached(p: Partial<SymbolProfile> & { ticker: string }): SymbolProfile {
  return {
    id: `sp-${p.ticker}`,
    created: '',
    updated: '',
    name: p.ticker,
    asset_type: 'stock',
    ...p,
  };
}

function providerProfile(
  ticker: string,
  source?: ProviderProfile['source'],
): ProviderProfile {
  return {
    ticker,
    isin: 'US0378331005',
    name: 'Apple Inc.',
    exchange: 'NMS',
    assetType: 'stock',
    listingCurrency: 'USD',
    sector: 'Technology',
    source,
  };
}

function makeDeps(overrides: {
  stale?: SymbolProfile[];
  profile?: (t: string) => Promise<ProviderProfile | null>;
  upsert?: (d: SymbolProfileCreate) => Promise<unknown>;
  now?: () => Date;
}): RefreshProfilesDeps & {
  listStale: ReturnType<typeof vi.fn>;
  profileFn: ReturnType<typeof vi.fn>;
  upsert: ReturnType<typeof vi.fn>;
} {
  const listStale = vi.fn(async () => overrides.stale ?? []);
  const profileFn = vi.fn(overrides.profile ?? (async (t: string) => providerProfile(t)));
  const upsert = vi.fn(overrides.upsert ?? (async (d) => d));
  return {
    profiles: { listStale, upsert } as never,
    provider: { profile: profileFn } as never,
    now: overrides.now ?? (() => new Date('2026-06-08T00:00:00Z')),
    listStale,
    profileFn,
    upsert,
  };
}

describe('runRefreshProfilesWith', () => {
  it('queries staleness with a 7-day cutoff', async () => {
    const deps = makeDeps({ now: () => new Date('2026-06-08T00:00:00Z') });
    await runRefreshProfilesWith(deps);
    const cutoff = deps.listStale.mock.calls[0][0] as string;
    expect(cutoff).toBe(new Date('2026-06-01T00:00:00Z').toISOString());
  });

  it('refreshes each stale profile via the provider and upserts it', async () => {
    const deps = makeDeps({ stale: [cached({ ticker: 'AAPL' }), cached({ ticker: 'MSFT' })] });
    const res = await runRefreshProfilesWith(deps);
    expect(res.stale).toBe(2);
    expect(res.refreshed).toBe(2);
    expect(deps.upsert).toHaveBeenCalledTimes(2);
  });

  it('preserves the ticker key and bumps last_refreshed_at', async () => {
    const deps = makeDeps({
      stale: [cached({ ticker: 'AAPL' })],
      now: () => new Date('2026-06-08T09:00:00Z'),
    });
    await runRefreshProfilesWith(deps);
    const row = deps.upsert.mock.calls[0][0] as SymbolProfileCreate;
    expect(row.ticker).toBe('AAPL');
    expect(row.last_refreshed_at).toBe(new Date('2026-06-08T09:00:00Z').toISOString());
    expect(row.sector).toBe('Technology');
  });

  it('persists the TRUE provenance from the fetched profile', async () => {
    const deps = makeDeps({
      stale: [cached({ ticker: 'AAPL' })],
      profile: async (t) => providerProfile(t, 'finnhub'),
    });
    await runRefreshProfilesWith(deps);
    expect((deps.upsert.mock.calls[0][0] as SymbolProfileCreate).data_source).toBe('finnhub');
  });

  it('a null provider result is left untouched (does not clobber cached data)', async () => {
    const deps = makeDeps({
      stale: [cached({ ticker: 'DEAD' })],
      profile: async () => null,
    });
    const res = await runRefreshProfilesWith(deps);
    expect(res.missed).toBe(1);
    expect(deps.upsert).not.toHaveBeenCalled();
  });

  it('a per-ticker failure does not abort the batch', async () => {
    const deps = makeDeps({
      stale: [cached({ ticker: 'BAD' }), cached({ ticker: 'GOOD' })],
      profile: async (t) => {
        if (t === 'BAD') throw new Error('upstream 500');
        return providerProfile(t);
      },
    });
    const res = await runRefreshProfilesWith(deps);
    expect(res.failed).toBe(1);
    expect(res.refreshed).toBe(1);
  });

  it('idempotent: an immediate re-run finds nothing stale (cutoff advanced)', async () => {
    // After a refresh, last_refreshed_at = now, so listStale (cutoff = now-7d)
    // returns []. Modeled by an empty stale list on the second run.
    const deps = makeDeps({ stale: [] });
    const res = await runRefreshProfilesWith(deps);
    expect(res.refreshed).toBe(0);
    expect(deps.upsert).not.toHaveBeenCalled();
  });
});
