// /api/transactions — paged, read-only ledger for the authed user, newest
// first. Transactions are written as a side effect of holdings mutations and by
// the Trading 212 sync (type: buy/sell/dividend). This route only reads.
//
// Scoped to c.var.pbUserId. Optional filters: ?accountId=, ?type=, ?ticker=.
// Pagination: ?page= + ?perPage= (max 200). ?limit= is a convenience alias for
// perPage used by the activity feed (it just wants the N newest events); it
// overrides perPage and defaults to ~100. All filter values are bound via
// PocketBase's parameterized filter in the repo (never string interpolation).

import { Hono } from 'hono';
import { transactionsRepo } from '../db/transactions';

type Vars = { Variables: { uid: string; email: string; pbUserId: string } };

const DEFAULT_PER_PAGE = 50;
const DEFAULT_LIMIT = 100;
const MAX_PER_PAGE = 200;

function clampInt(value: string | undefined, fallback: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(Math.floor(n), max);
}

export const transactionRoutes = new Hono<Vars>().get('/', async (c) => {
  const page = clampInt(c.req.query('page'), 1, Number.MAX_SAFE_INTEGER);

  // `limit` (activity feed) takes precedence over `perPage`; when neither is
  // given, the feed gets DEFAULT_LIMIT (≈100) newest events.
  const limitRaw = c.req.query('limit');
  const perPage =
    limitRaw !== undefined
      ? clampInt(limitRaw, DEFAULT_LIMIT, MAX_PER_PAGE)
      : clampInt(c.req.query('perPage'), DEFAULT_PER_PAGE, MAX_PER_PAGE);

  const account = c.req.query('accountId') || undefined;
  const type = c.req.query('type') || undefined;
  const ticker = c.req.query('ticker') || undefined;

  const result = await transactionsRepo.listPaged(c.var.pbUserId, {
    page,
    perPage,
    account,
    type,
    ticker,
  });

  return c.json({
    items: result.items,
    page: result.page,
    perPage: result.perPage,
    totalItems: result.totalItems,
    totalPages: result.totalPages,
  });
});
