import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

type HoldingRow = {
  id: string;
  user: string;
  account: string;
  ticker: string;
  quantity: number;
  cost_basis?: number | null;
  cost_currency?: string | null;
  source: string;
  isin?: string;
  notes?: string;
};
type AccountRow = { id: string; user: string };
type TxRow = Record<string, unknown> & { id: string };

let holdings: HoldingRow[] = [];
let accounts: AccountRow[] = [];
let txns: TxRow[] = [];

vi.mock('../../src/db/accounts', () => ({
  accountsRepo: {
    get: vi.fn(async (id: string) => {
      const r = accounts.find((x) => x.id === id);
      if (!r) throw Object.assign(new Error('not found'), { status: 404 });
      return r;
    }),
  },
}));

vi.mock('../../src/db/holdings', () => ({
  holdingsRepo: {
    listForUser: vi.fn(
      async (userId: string, opts: { account?: string; openOnly?: boolean } = {}) =>
        holdings.filter(
          (h) =>
            h.user === userId &&
            (!opts.account || h.account === opts.account) &&
            (!opts.openOnly || h.quantity > 0),
        ),
    ),
    findByTicker: vi.fn(async (userId: string, account: string, ticker: string) =>
      holdings.find(
        (h) => h.user === userId && h.account === account && h.ticker === ticker,
      ) ?? null,
    ),
    get: vi.fn(async (id: string) => {
      const r = holdings.find((x) => x.id === id);
      if (!r) throw Object.assign(new Error('not found'), { status: 404 });
      return r;
    }),
    create: vi.fn(async (data: Omit<HoldingRow, 'id'>) => {
      const r = { id: `h-${holdings.length + 1}`, ...data };
      holdings.push(r);
      return r;
    }),
    update: vi.fn(async (id: string, patch: Partial<HoldingRow>) => {
      const r = holdings.find((x) => x.id === id)!;
      Object.assign(r, patch);
      return r;
    }),
  },
}));

vi.mock('../../src/db/transactions', () => ({
  transactionsRepo: {
    create: vi.fn(async (data: Omit<TxRow, 'id'>) => {
      const r = { id: `tx-${txns.length + 1}`, ...data };
      txns.push(r);
      return r;
    }),
  },
}));

import { holdingRoutes } from '../../src/routes/holdings';
import { errorHandler } from '../../src/middleware/errorHandler';

function appAs(pbUserId: string) {
  const app = new Hono();
  app.onError(errorHandler);
  app.use('/api/*', async (c, next) => {
    c.set('uid', `fb-${pbUserId}`);
    c.set('email', `${pbUserId}@test`);
    c.set('pbUserId', pbUserId);
    await next();
  });
  app.route('/api/holdings', holdingRoutes);
  return app;
}

function json(body: unknown) {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  } as const;
}

beforeEach(() => {
  holdings = [];
  accounts = [{ id: 'acc1', user: 'u1' }];
  txns = [];
});

describe('POST /api/holdings (manual add)', () => {
  it('creates a holding + writes a buy transaction', async () => {
    const res = await appAs('u1').request(
      '/api/holdings',
      json({ account: 'acc1', ticker: 'AAPL', quantity: 10, cost_basis: 1500, cost_currency: 'EUR' }),
    );
    expect(res.status).toBe(201);
    const h = await res.json();
    expect(h.quantity).toBe(10);
    expect(h.cost_basis).toBe(1500);
    expect(txns).toHaveLength(1);
    expect(txns[0]).toMatchObject({
      type: 'buy',
      ticker: 'AAPL',
      quantity: 10,
      price: 150, // 1500 / 10 derived per-share
      currency: 'EUR',
      user: 'u1',
    });
  });

  it('upserts by (user, account, ticker) with weighted-average cost', async () => {
    const app = appAs('u1');
    await app.request('/api/holdings', json({ account: 'acc1', ticker: 'AAPL', quantity: 10, cost_basis: 1500, cost_currency: 'EUR' }));
    const res = await app.request('/api/holdings', json({ account: 'acc1', ticker: 'AAPL', quantity: 5, cost_basis: 1000, cost_currency: 'EUR' }));
    const h = await res.json();
    expect(h.quantity).toBe(15);
    expect(h.cost_basis).toBe(2500); // 1500 + 1000 (totals summed)
    expect(holdings).toHaveLength(1); // upserted, not duplicated
    expect(txns).toHaveLength(2); // two buys
  });

  it('400 on an invalid body', async () => {
    const res = await appAs('u1').request('/api/holdings', json({ account: 'acc1', ticker: '', quantity: -1 }));
    expect(res.status).toBe(400);
  });

  it('404 when adding to an account owned by someone else (IDOR via account id)', async () => {
    accounts = [{ id: 'accB', user: 'u2' }];
    const res = await appAs('u1').request('/api/holdings', json({ account: 'accB', ticker: 'AAPL', quantity: 1, cost_basis: 100, cost_currency: 'EUR' }));
    expect(res.status).toBe(404);
    expect(holdings).toHaveLength(0);
    expect(txns).toHaveLength(0);
  });
});

describe('POST /api/holdings/:id/sell (partial)', () => {
  beforeEach(() => {
    holdings = [{ id: 'h1', user: 'u1', account: 'acc1', ticker: 'AAPL', quantity: 15, cost_basis: 2500, cost_currency: 'EUR', source: 'manual' }];
  });

  it('decrements quantity, reduces cost proportionally, writes a sell tx', async () => {
    const res = await appAs('u1').request('/api/holdings/h1/sell', json({ quantity: 5, price: 180, currency: 'USD' }));
    expect(res.status).toBe(200);
    const h = await res.json();
    expect(h.quantity).toBe(10);
    expect(h.cost_basis).toBeCloseTo(2500 * (10 / 15), 4);
    expect(txns).toHaveLength(1);
    expect(txns[0]).toMatchObject({ type: 'sell', quantity: 5, price: 180, currency: 'USD' });
  });

  it('400 when selling more than held', async () => {
    const res = await appAs('u1').request('/api/holdings/h1/sell', json({ quantity: 999, price: 180, currency: 'USD' }));
    expect(res.status).toBe(400);
    expect(holdings[0].quantity).toBe(15); // unchanged
  });
});

describe('PATCH /api/holdings/:id (adjustment)', () => {
  beforeEach(() => {
    holdings = [{ id: 'h1', user: 'u1', account: 'acc1', ticker: 'AAPL', quantity: 10, cost_basis: 1500, cost_currency: 'EUR', source: 'manual' }];
  });

  it('recomputes cost on quantity change + writes an adjustment tx', async () => {
    const res = await appAs('u1').request('/api/holdings/h1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity: 12 }),
    });
    expect(res.status).toBe(200);
    const h = await res.json();
    expect(h.quantity).toBe(12);
    expect(h.cost_basis).toBeCloseTo(1800, 4); // 150/share preserved
    expect(txns).toHaveLength(1);
    expect(txns[0]).toMatchObject({ type: 'adjustment', quantity: 2 }); // +2 delta
  });
});

describe('DELETE /api/holdings/:id (full sell)', () => {
  beforeEach(() => {
    holdings = [{ id: 'h1', user: 'u1', account: 'acc1', ticker: 'AAPL', quantity: 10, cost_basis: 1500, cost_currency: 'EUR', source: 'manual' }];
  });

  it('zeros the holding + writes a sell tx for the full quantity', async () => {
    const res = await appAs('u1').request('/api/holdings/h1', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ price: 200, currency: 'USD' }),
    });
    expect(res.status).toBe(200);
    expect(holdings[0].quantity).toBe(0); // closed marker
    expect(txns[0]).toMatchObject({ type: 'sell', quantity: 10, price: 200 });
  });
});

describe('GET /api/holdings excludes closed (quantity 0) positions', () => {
  it('does not return zeroed holdings', async () => {
    holdings = [
      { id: 'h1', user: 'u1', account: 'acc1', ticker: 'AAPL', quantity: 0, source: 'manual' },
      { id: 'h2', user: 'u1', account: 'acc1', ticker: 'MSFT', quantity: 5, source: 'manual' },
    ];
    const res = await appAs('u1').request('/api/holdings');
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].ticker).toBe('MSFT');
  });
});

describe('IDOR: a user cannot touch another user holding by id', () => {
  beforeEach(() => {
    accounts = [{ id: 'accB', user: 'u2' }];
    holdings = [{ id: 'hB', user: 'u2', account: 'accB', ticker: 'NVDA', quantity: 10, cost_basis: 5000, cost_currency: 'USD', source: 'manual' }];
  });

  it('PATCH another user holding → 404, unchanged', async () => {
    const res = await appAs('u1').request('/api/holdings/hB', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity: 1 }),
    });
    expect(res.status).toBe(404);
    expect(holdings[0].quantity).toBe(10);
    expect(txns).toHaveLength(0);
  });

  it('SELL another user holding → 404, unchanged', async () => {
    const res = await appAs('u1').request('/api/holdings/hB/sell', json({ quantity: 1, price: 1, currency: 'USD' }));
    expect(res.status).toBe(404);
    expect(holdings[0].quantity).toBe(10);
    expect(txns).toHaveLength(0);
  });

  it('DELETE another user holding → 404, unchanged', async () => {
    const res = await appAs('u1').request('/api/holdings/hB', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ price: 1, currency: 'USD' }),
    });
    expect(res.status).toBe(404);
    expect(holdings[0].quantity).toBe(10);
    expect(txns).toHaveLength(0);
  });
});
