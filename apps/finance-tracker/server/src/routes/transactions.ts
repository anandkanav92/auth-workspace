// /api/transactions — paged, read-only transaction log for the authed user.
// Transactions are written as a side effect of holdings mutations; this route
// only reads. Scoped to c.var.pbUserId; optional accountId filter.

import { Hono } from 'hono';
import { transactionsRepo } from '../db/transactions';

type Vars = { Variables: { uid: string; email: string; pbUserId: string } };

const DEFAULT_PER_PAGE = 50;
const MAX_PER_PAGE = 200;

function clampInt(value: string | undefined, fallback: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(Math.floor(n), max);
}

export const transactionRoutes = new Hono<Vars>().get('/', async (c) => {
  const page = clampInt(c.req.query('page'), 1, Number.MAX_SAFE_INTEGER);
  const perPage = clampInt(c.req.query('perPage'), DEFAULT_PER_PAGE, MAX_PER_PAGE);
  const account = c.req.query('accountId') || undefined;

  const result = await transactionsRepo.listPaged(c.var.pbUserId, {
    page,
    perPage,
    account,
  });

  return c.json({
    items: result.items,
    page: result.page,
    perPage: result.perPage,
    totalItems: result.totalItems,
    totalPages: result.totalPages,
  });
});
