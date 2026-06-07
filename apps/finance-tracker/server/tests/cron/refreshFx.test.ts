import { describe, it, expect, vi } from 'vitest';
import { runRefreshFxWith, type RefreshFxDeps } from '../../src/cron/refreshFx';
import type { FxRatesCreate } from '../../src/db/schemas';

function makeDeps(overrides: {
  rates?: Record<string, number>;
  latest?: () => Promise<Record<string, number>>;
  upsert?: (d: FxRatesCreate) => Promise<unknown>;
  now?: () => Date;
}): RefreshFxDeps & {
  latest: ReturnType<typeof vi.fn>;
  upsert: ReturnType<typeof vi.fn>;
} {
  const latest = vi.fn(
    overrides.latest ?? (async () => overrides.rates ?? { EUR: 1, USD: 1.085, GBP: 0.85 }),
  );
  const upsert = vi.fn(overrides.upsert ?? (async (d) => d));
  return {
    fx: { latest } as never,
    fxRates: { upsert } as never,
    now: overrides.now,
    latest,
    upsert,
  };
}

describe('runRefreshFxWith', () => {
  it('upserts the fetched ECB rates keyed by today (Amsterdam date)', async () => {
    // 2026-06-01 12:00 UTC = 14:00 Amsterdam (CEST) → date 2026-06-01.
    const deps = makeDeps({ now: () => new Date('2026-06-01T12:00:00Z') });
    const res = await runRefreshFxWith(deps);

    expect(res.date).toBe('2026-06-01');
    expect(res.currencies).toBe(3);
    const row = deps.upsert.mock.calls[0][0] as FxRatesCreate;
    expect(row.date).toBe('2026-06-01');
    expect(row.rates.USD).toBe(1.085);
  });

  it('keys the date in Amsterdam TZ (late-UTC instant rolls into the local day)', async () => {
    // 2026-06-01 23:30 UTC = 2026-06-02 01:30 Amsterdam → date is the 2nd.
    const deps = makeDeps({ now: () => new Date('2026-06-01T23:30:00Z') });
    const res = await runRefreshFxWith(deps);
    expect(res.date).toBe('2026-06-02');
  });

  it('idempotent: re-running the same day upserts the SAME date key (no duplicate)', async () => {
    const now = () => new Date('2026-06-01T12:00:00Z');
    const deps = makeDeps({ now });
    await runRefreshFxWith(deps);
    await runRefreshFxWith(deps);
    const dates = deps.upsert.mock.calls.map((c) => (c[0] as FxRatesCreate).date);
    expect(dates).toEqual(['2026-06-01', '2026-06-01']); // same key → upsert overwrites
  });

  it('propagates an ECB fetch failure (no partial write)', async () => {
    const deps = makeDeps({
      latest: async () => {
        throw new Error('ECB FX fetch failed: 503');
      },
    });
    await expect(runRefreshFxWith(deps)).rejects.toThrow('ECB FX fetch failed');
    expect(deps.upsert).not.toHaveBeenCalled();
  });
});
