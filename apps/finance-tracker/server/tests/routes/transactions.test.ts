import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

type TxRow = { id: string; user: string; account: string; ticker: string };
let txns: TxRow[] = [];

vi.mock('../../src/db/transactions', () => ({
  transactionsRepo: {
    listPaged: vi.fn(
      async (
        userId: string,
        opts: { page?: number; perPage?: number; account?: string } = {},
      ) => {
        const page = opts.page ?? 1;
        const perPage = opts.perPage ?? 50;
        const all = txns.filter(
          (t) => t.user === userId && (!opts.account || t.account === opts.account),
        );
        const start = (page - 1) * perPage;
        const items = all.slice(start, start + perPage);
        return {
          page,
          perPage,
          totalItems: all.length,
          totalPages: Math.ceil(all.length / perPage) || 1,
          items,
        };
      },
    ),
  },
}));

import { transactionRoutes } from '../../src/routes/transactions';
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
  app.route('/api/transactions', transactionRoutes);
  return app;
}

beforeEach(() => {
  txns = [
    { id: 't1', user: 'u1', account: 'acc1', ticker: 'AAPL' },
    { id: 't2', user: 'u1', account: 'acc2', ticker: 'MSFT' },
    { id: 't3', user: 'u2', account: 'accB', ticker: 'NVDA' },
  ];
});

describe('GET /api/transactions', () => {
  it('returns only the authed user transactions with pagination metadata', async () => {
    const res = await appAs('u1').request('/api/transactions');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(2);
    expect(body.totalItems).toBe(2);
    expect(body.page).toBe(1);
    expect(body.perPage).toBe(50);
    expect(body.items.every((t: TxRow) => t.user === 'u1')).toBe(true);
  });

  it('filters by accountId', async () => {
    const res = await appAs('u1').request('/api/transactions?accountId=acc1');
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].ticker).toBe('AAPL');
  });

  it('honours page + perPage query params', async () => {
    const res = await appAs('u1').request('/api/transactions?page=2&perPage=1');
    const body = await res.json();
    expect(body.page).toBe(2);
    expect(body.perPage).toBe(1);
    expect(body.items).toHaveLength(1);
    expect(body.totalPages).toBe(2);
  });

  it('does not leak another user transactions', async () => {
    const res = await appAs('u2').request('/api/transactions');
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].ticker).toBe('NVDA');
  });
});
