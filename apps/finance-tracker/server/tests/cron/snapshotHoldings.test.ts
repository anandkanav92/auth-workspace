import { describe, it, expect, vi } from 'vitest';
import {
  runSnapshotHoldingsWith,
  type SnapshotHoldingsDeps,
} from '../../src/cron/snapshotHoldings';
import type {
  Holding,
  HoldingsSnapshot,
  HoldingsSnapshotCreate,
  PriceCache,
  FxRates,
} from '../../src/db/schemas';

function holding(p: Partial<Holding> & { ticker: string }): Holding {
  return {
    id: `h-${p.ticker}-${Math.random().toString(36).slice(2)}`,
    created: '',
    updated: '',
    user: 'u1',
    account: 'a1',
    quantity: 10,
    source: 'manual',
    ...p,
  };
}

function price(ticker: string, price: number, currency = 'USD'): PriceCache {
  return { id: `p-${ticker}`, created: '', updated: '', ticker, price, currency };
}

function snapshot(p: Partial<HoldingsSnapshot> & { ticker: string }): HoldingsSnapshot {
  return {
    id: `s-${p.ticker}`,
    created: '',
    updated: '',
    user: 'u1',
    account: 'a1',
    quantity: 10,
    eur_value: 0,
    date: '2026-06-01',
    ...p,
  };
}

function makeDeps(overrides: {
  open?: Holding[];
  todays?: HoldingsSnapshot[];
  prices?: PriceCache[];
  fx?: Record<string, number> | null;
  now?: () => Date;
  create?: (d: HoldingsSnapshotCreate) => Promise<unknown>;
}): SnapshotHoldingsDeps & {
  create: ReturnType<typeof vi.fn>;
  listAllByDateRange: ReturnType<typeof vi.fn>;
} {
  const create = vi.fn(overrides.create ?? (async (d) => d));
  const listAllByDateRange = vi.fn(async () => overrides.todays ?? []);
  const fxRow: FxRates | null =
    overrides.fx === null
      ? null
      : { id: 'fx', created: '', updated: '', date: '2026-06-01', rates: overrides.fx ?? { EUR: 1, USD: 2 } };
  return {
    holdings: { listAllOpen: vi.fn(async () => overrides.open ?? []) } as never,
    snapshots: { listAllByDateRange, create } as never,
    priceCache: { list: vi.fn(async () => overrides.prices ?? []) } as never,
    fxRates: { get: vi.fn(async () => fxRow) } as never,
    now: overrides.now ?? (() => new Date('2026-06-01T01:00:00Z')),
    create,
    listAllByDateRange,
  };
}

describe('runSnapshotHoldingsWith', () => {
  it('inserts one snapshot per open holding with eur_value = qty × price × fxToEur', async () => {
    // USD rate 2 → 1 EUR = 2 USD → a USD value halves into EUR.
    const deps = makeDeps({
      open: [holding({ ticker: 'AAPL', quantity: 10 })], // 10 × 50 USD = 500 USD
      prices: [price('AAPL', 50, 'USD')],
      fx: { EUR: 1, USD: 2 },
    });
    const res = await runSnapshotHoldingsWith(deps);

    expect(res.inserted).toBe(1);
    const row = deps.create.mock.calls[0][0] as HoldingsSnapshotCreate;
    expect(row.eur_value).toBe(250); // 500 USD / 2 = 250 EUR
    expect(row.date).toBe('2026-06-01');
  });

  it('EUR-denominated price is taken at par (rate 1)', async () => {
    const deps = makeDeps({
      open: [holding({ ticker: 'IWDA', quantity: 4 })],
      prices: [price('IWDA', 100, 'EUR')],
      fx: { EUR: 1, USD: 2 },
    });
    await runSnapshotHoldingsWith(deps);
    expect((deps.create.mock.calls[0][0] as HoldingsSnapshotCreate).eur_value).toBe(400);
  });

  it('idempotent: skips a holding already snapshotted today', async () => {
    const deps = makeDeps({
      open: [
        holding({ ticker: 'AAPL', user: 'u1', account: 'a1' }),
        holding({ ticker: 'MSFT', user: 'u1', account: 'a1' }),
      ],
      todays: [snapshot({ ticker: 'AAPL', user: 'u1', account: 'a1' })], // AAPL already done
      prices: [price('AAPL', 50), price('MSFT', 50)],
    });
    const res = await runSnapshotHoldingsWith(deps);
    expect(res.skipped).toBe(1);
    expect(res.inserted).toBe(1);
    expect((deps.create.mock.calls[0][0] as HoldingsSnapshotCreate).ticker).toBe('MSFT');
  });

  it('idempotent across a full re-run (all rows now exist → inserts nothing)', async () => {
    const open = [holding({ ticker: 'AAPL', user: 'u1', account: 'a1' })];
    const deps = makeDeps({
      open,
      todays: [snapshot({ ticker: 'AAPL', user: 'u1', account: 'a1' })],
      prices: [price('AAPL', 50)],
    });
    const res = await runSnapshotHoldingsWith(deps);
    expect(res.inserted).toBe(0);
    expect(res.skipped).toBe(1);
    expect(deps.create).not.toHaveBeenCalled();
  });

  it('de-dupes two identical-key holdings within one run (inserts once)', async () => {
    // Same (user, account, ticker) appearing twice in the list must snapshot once.
    const deps = makeDeps({
      open: [
        holding({ ticker: 'AAPL', user: 'u1', account: 'a1' }),
        holding({ ticker: 'AAPL', user: 'u1', account: 'a1' }),
      ],
      prices: [price('AAPL', 50)],
    });
    const res = await runSnapshotHoldingsWith(deps);
    expect(res.inserted).toBe(1);
  });

  it('an unpriced holding is snapshotted with eur_value 0 and counted', async () => {
    const deps = makeDeps({
      open: [holding({ ticker: 'XYZ', quantity: 5 })],
      prices: [], // no cached price
    });
    const res = await runSnapshotHoldingsWith(deps);
    expect(res.unpriced).toBe(1);
    expect((deps.create.mock.calls[0][0] as HoldingsSnapshotCreate).eur_value).toBe(0);
  });

  it('a per-holding insert failure does not abort the batch', async () => {
    let n = 0;
    const deps = makeDeps({
      open: [holding({ ticker: 'A' }), holding({ ticker: 'B' })],
      prices: [price('A', 10), price('B', 10)],
      create: async (d) => {
        if (n++ === 0) throw new Error('PB write failed');
        return d;
      },
    });
    const res = await runSnapshotHoldingsWith(deps);
    expect(res.failed).toBe(1);
    expect(res.inserted).toBe(1);
  });
});
