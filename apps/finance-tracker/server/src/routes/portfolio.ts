// Per-user portfolio analytics endpoints.
//
//   GET /api/portfolio/history[?days=90&accountId=...]
//     → [{ date: 'YYYY-MM-DD', valueEur }] — the daily total portfolio value
//       time series, summed across the user's holdings_snapshot rows (optionally
//       scoped to one account). Drives the hero value-over-time chart.
//
// Mounted behind authMiddleware + rateLimit; reads are user-scoped in the repo.

import { Hono } from 'hono';
import type { HoldingsSnapshot } from '../db/schemas';

type Vars = { Variables: { uid: string; email: string; pbUserId: string } };

export interface HistoryPoint {
  date: string;
  valueEur: number;
}

/**
 * Collapse per-holding snapshot rows into one total per calendar day. The
 * snapshot `date` is a PocketBase datetime on read ("YYYY-MM-DD 00:00:00.000Z"),
 * so we key on the first 10 chars. Pure + exported for unit testing.
 */
export function groupSnapshotsByDate(rows: HoldingsSnapshot[]): HistoryPoint[] {
  const byDate = new Map<string, number>();
  for (const r of rows) {
    const date = (r.date ?? '').slice(0, 10);
    if (!date) continue;
    byDate.set(date, (byDate.get(date) ?? 0) + (r.eur_value ?? 0));
  }
  return [...byDate.entries()]
    .map(([date, valueEur]) => ({ date, valueEur }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** "YYYY-MM-DD" for `days` ago (UTC), the inclusive lower bound of the window. */
function sinceDate(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

export const portfolioRoutes = new Hono<Vars>().get('/history', async (c) => {
  const pbUserId = c.var.pbUserId;
  // Clamp the window to a sane range (default 90d, max ~2y).
  const days = Math.min(Math.max(Number(c.req.query('days')) || 90, 1), 730);
  const accountId = c.req.query('accountId') || undefined;

  // Lazy import: pb.ts throws at import without admin env, so importing this
  // module to unit-test groupSnapshotsByDate must not pull the repo (the same
  // convention as marketData/import routes).
  const { holdingsSnapshotRepo } = await import('../db/holdingsSnapshot');
  const rows = await holdingsSnapshotRepo.historyForUser(
    pbUserId,
    sinceDate(days),
    accountId,
  );
  return c.json(groupSnapshotsByDate(rows));
});
