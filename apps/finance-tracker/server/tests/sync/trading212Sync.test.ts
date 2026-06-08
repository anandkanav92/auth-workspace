import { describe, it, expect, vi, beforeEach } from 'vitest';

// The prod decrypt path reads this; set a valid 32-byte (64 hex) key before any
// import that might touch the crypto helper.
process.env.T212_KEY_ENC_SECRET = 'a'.repeat(64);

import { runTrading212SyncWith, type Trading212SyncDeps } from '../../src/sync/trading212Sync';
import { Trading212ApiError } from '../../src/providers/trading212';
import type {
  LedgerEvent,
  LedgerPage,
  T212Position,
} from '../../src/providers/trading212';
import type {
  BrokerConnection,
  Account,
  Holding,
  HoldingCreate,
  Transaction,
  TransactionCreate,
} from '../../src/db/schemas';

// --- fixtures ---------------------------------------------------------------
// Two positions: a USD equity and a GBX-quoted LSE listing (must normalise the
// cost basis ÷100 → GBP). Their ISIN/currency come from the order ledger map.

const POSITIONS: T212Position[] = [
  {
    t212Ticker: 'AAPL_US_EQ',
    quantity: 10,
    averagePrice: 150, // USD
    currentPrice: 180,
    initialFillDate: '2025-01-01T00:00:00Z',
  },
  {
    t212Ticker: 'VUKG_GB_EQ',
    quantity: 4,
    averagePrice: 5000, // GBX (pence) → cost_basis ÷100, currency GBP
    currentPrice: 5200,
    initialFillDate: '2025-02-01T00:00:00Z',
  },
];

// Orders span two pages (cursor follow). Each carries the isin/currency/name
// used to build the ticker map for the positions.
const ORDERS_PAGE_1: LedgerEvent[] = [
  {
    externalId: 'o1',
    type: 'buy',
    t212Ticker: 'AAPL_US_EQ',
    isin: 'US0378331005',
    name: 'Apple Inc.',
    currency: 'USD',
    quantity: 10,
    price: 150,
    fee: 0.5,
    occurredAt: '2025-01-01T00:00:00Z',
  },
];
const ORDERS_PAGE_2: LedgerEvent[] = [
  {
    externalId: 'o2',
    type: 'buy',
    t212Ticker: 'VUKG_GB_EQ',
    isin: 'IE00BFMXXD54',
    name: 'Vanguard FTSE 100',
    // The provider normalises the ledger currency (GBX→GBP) but exposes the raw
    // code separately; the sync uses rawCurrency to pence-normalise the position.
    currency: 'GBP',
    rawCurrency: 'GBX',
    quantity: 4,
    price: 50, // already normalised by the provider in prod; test value is arbitrary
    fee: 0,
    occurredAt: '2025-02-01T00:00:00Z',
  },
];

const DIVIDENDS_PAGE_1: LedgerEvent[] = [
  {
    externalId: 'd1',
    type: 'dividend',
    t212Ticker: 'AAPL_US_EQ',
    isin: 'US0378331005',
    name: 'Apple Inc.',
    currency: 'USD',
    quantity: 10,
    amount: 2.4,
    amountEur: 2.2,
    occurredAt: '2025-03-01T00:00:00Z',
  },
];
const DIVIDENDS_PAGE_2: LedgerEvent[] = [
  {
    externalId: 'd2',
    type: 'dividend',
    t212Ticker: 'VUKG_GB_EQ',
    isin: 'IE00BFMXXD54',
    name: 'Vanguard FTSE 100',
    currency: 'GBP',
    quantity: 4,
    amount: 1.1,
    amountEur: 1.3,
    occurredAt: '2025-04-01T00:00:00Z',
  },
];

// --- fake provider ----------------------------------------------------------
// Paginates orders + dividends across two pages each via an opaque cursor.

function makeProvider(over?: { throwOnPositions?: boolean }) {
  return {
    fetchPositions: vi.fn(async (): Promise<T212Position[]> => {
      if (over?.throwOnPositions) {
        throw new Trading212ApiError('portfolio fetch failed (status 403)', 403);
      }
      return POSITIONS;
    }),
    fetchOrders: vi.fn(async (_creds: string, cursor?: string): Promise<LedgerPage> => {
      if (!cursor) return { items: ORDERS_PAGE_1, nextCursor: 'orders-page-2' };
      return { items: ORDERS_PAGE_2, nextCursor: undefined };
    }),
    fetchDividends: vi.fn(
      async (_creds: string, cursor?: string): Promise<LedgerPage> => {
        if (!cursor) return { items: DIVIDENDS_PAGE_1, nextCursor: 'divs-page-2' };
        return { items: DIVIDENDS_PAGE_2, nextCursor: undefined };
      },
    ),
  };
}

// --- in-memory repos --------------------------------------------------------

function makeFakes() {
  const connections: BrokerConnection[] = [
    {
      id: 'conn-1',
      created: '',
      updated: '',
      user: 'u1',
      broker: 'trading212',
      api_key_enc: 'ciphertext',
      status: 'connected',
    },
  ];
  const accounts: Account[] = [
    {
      id: 'acc-t212',
      created: '',
      updated: '',
      user: 'u1',
      source: 'trading212',
      label: 'Trading 212',
    },
  ];
  let holdings: Holding[] = [
    // a pre-existing (stale) holding that must be replaced by the sync
    {
      id: 'h-old',
      created: '',
      updated: '',
      user: 'u1',
      account: 'acc-t212',
      ticker: 'OLD',
      quantity: 99,
      source: 'trading212',
    },
  ];
  let transactions: Transaction[] = [];
  let holdingSeq = 0;
  let txSeq = 0;

  const connectionsRepo = {
    getForUser: vi.fn(async (userId: string, broker: string) =>
      connections.find((c) => c.user === userId && c.broker === broker) ?? null,
    ),
    update: vi.fn(async (id: string, patch: Partial<BrokerConnection>) => {
      const row = connections.find((c) => c.id === id)!;
      Object.assign(row, patch);
      return row;
    }),
  };

  const accountsRepo = {
    list: vi.fn(async (userId: string) =>
      accounts.filter((a) => a.user === userId),
    ),
  };

  const holdingsRepo = {
    listForUser: vi.fn(
      async (userId: string, opts: { account?: string } = {}) =>
        holdings.filter(
          (h) =>
            h.user === userId && (!opts.account || h.account === opts.account),
        ),
    ),
  };

  const transactionsRepo = {
    upsertByExternalId: vi.fn(async (row: TransactionCreate) => {
      const existing = transactions.find(
        (t) =>
          t.user === row.user &&
          t.source === row.source &&
          t.external_id === row.external_id,
      );
      if (existing) {
        Object.assign(existing, row);
        return existing;
      }
      const created = {
        id: `tx-${++txSeq}`,
        created: '',
        updated: '',
        ...row,
      } as Transaction;
      transactions.push(created);
      return created;
    }),
  };

  // Atomic snapshot-replace for this account's holdings (no imports row).
  const replaceHoldings = vi.fn(
    async (args: { existing: { id: string }[]; holdings: HoldingCreate[] }) => {
      const toDelete = new Set(args.existing.map((h) => h.id));
      holdings = holdings.filter((h) => !toDelete.has(h.id));
      for (const row of args.holdings) {
        holdings.push({
          id: `h-${++holdingSeq}`,
          created: '',
          updated: '',
          ...row,
        } as Holding);
      }
    },
  );

  return {
    connectionsRepo,
    accountsRepo,
    holdingsRepo,
    transactionsRepo,
    replaceHoldings,
    peek: {
      connections: () => connections,
      holdings: () => holdings,
      transactions: () => transactions,
    },
  };
}

function depsFrom(
  fakes: ReturnType<typeof makeFakes>,
  provider: Trading212SyncDeps['provider'],
): Trading212SyncDeps {
  return {
    connections: fakes.connectionsRepo,
    accounts: fakes.accountsRepo,
    holdings: fakes.holdingsRepo,
    transactions: fakes.transactionsRepo,
    provider,
    replaceHoldings: fakes.replaceHoldings,
    // echo the broker symbol back as the resolved ticker
    resolveTicker: vi.fn(async (_isin: string, brokerSymbol: string) => brokerSymbol),
    decrypt: vi.fn(() => 'pub:priv'),
    now: () => new Date('2026-06-08T12:00:00Z'),
  };
}

beforeEach(() => {
  process.env.T212_KEY_ENC_SECRET = 'a'.repeat(64);
});

// --- tests ------------------------------------------------------------------

describe('runTrading212SyncWith', () => {
  it('replaces holdings from positions (GBX cost normalised) and upserts the ledger', async () => {
    const fakes = makeFakes();
    const provider = makeProvider();
    const deps = depsFrom(fakes, provider);

    const result = await runTrading212SyncWith(deps, 'u1');

    expect(result).toMatchObject({ positions: 2, orders: 2, dividends: 2 });

    // Holdings: the stale OLD holding is gone; the two positions are present.
    // The mocked resolveTicker echoes the broker symbol (AAPL_US_EQ → AAPL).
    const holdings = fakes.peek.holdings();
    expect(holdings.map((h) => h.ticker).sort()).toEqual(['AAPL', 'VUKG']);
    expect(holdings.every((h) => h.account === 'acc-t212')).toBe(true);
    expect(holdings.every((h) => h.source === 'trading212')).toBe(true);

    const aapl = holdings.find((h) => h.ticker === 'AAPL')!;
    expect(aapl.isin).toBe('US0378331005');
    expect(aapl.cost_basis).toBe(1500); // 10 × 150
    expect(aapl.cost_currency).toBe('USD');

    // GBX → cost_basis ÷100 and currency normalised to GBP.
    const vukg = holdings.find((h) => h.ticker === 'VUKG')!;
    expect(vukg.cost_basis).toBe(200); // 4 × 5000 = 20000 pence → 200 GBP
    expect(vukg.cost_currency).toBe('GBP');

    // Ledger: 2 orders + 2 dividends across both pages.
    const txs = fakes.peek.transactions();
    expect(txs).toHaveLength(4);
    const div = txs.find((t) => t.external_id === 'd1')!;
    expect(div.type).toBe('dividend');
    expect(div.occurred_at).toBe('2025-03-01T00:00:00Z');

    // pagination followed to completion (2 calls each: cursor + no cursor)
    expect(provider.fetchOrders).toHaveBeenCalledTimes(2);
    expect(provider.fetchDividends).toHaveBeenCalledTimes(2);

    // connection stamped connected + last_synced_at, last_error cleared.
    const conn = fakes.peek.connections()[0];
    expect(conn.status).toBe('connected');
    expect(conn.last_synced_at).toBe('2026-06-08T12:00:00.000Z');
    expect(conn.last_error ?? '').toBe('');
  });

  it('skips when the user has no connection', async () => {
    const fakes = makeFakes();
    fakes.connectionsRepo.getForUser.mockResolvedValue(null);
    const deps = depsFrom(fakes, makeProvider());

    const result = await runTrading212SyncWith(deps, 'u1');
    expect(result).toEqual({ skipped: true });
    expect(fakes.replaceHoldings).not.toHaveBeenCalled();
  });

  it('is idempotent on re-run (no duplicate ledger rows, same holding count)', async () => {
    const fakes = makeFakes();
    const deps = depsFrom(fakes, makeProvider());

    await runTrading212SyncWith(deps, 'u1');
    const afterFirst = {
      holdings: fakes.peek.holdings().length,
      txs: fakes.peek.transactions().length,
    };

    await runTrading212SyncWith(deps, 'u1');
    expect(fakes.peek.holdings()).toHaveLength(afterFirst.holdings);
    expect(fakes.peek.transactions()).toHaveLength(afterFirst.txs);
    expect(fakes.peek.transactions()).toHaveLength(4);
  });

  it('on a provider error sets status=error + last_error and leaves prior data intact', async () => {
    const fakes = makeFakes();
    // Seed prior synced data so we can prove it survives a failed sync.
    await runTrading212SyncWith(fakes2Deps(fakes), 'u1');
    const beforeHoldings = fakes.peek.holdings().map((h) => h.id).sort();
    const beforeTxs = fakes.peek.transactions().length;

    const failing = depsFrom(fakes, makeProvider({ throwOnPositions: true }));
    await expect(runTrading212SyncWith(failing, 'u1')).rejects.toThrow(
      Trading212ApiError,
    );

    const conn = fakes.peek.connections()[0];
    expect(conn.status).toBe('error');
    expect(conn.last_error).toBeTruthy();

    // holdings + ledger untouched by the failed run
    expect(fakes.peek.holdings().map((h) => h.id).sort()).toEqual(
      beforeHoldings,
    );
    expect(fakes.peek.transactions()).toHaveLength(beforeTxs);
  });
});

// Helper: a successful deps wiring used to seed prior data before the error test.
function fakes2Deps(fakes: ReturnType<typeof makeFakes>): Trading212SyncDeps {
  return depsFrom(fakes, makeProvider());
}
