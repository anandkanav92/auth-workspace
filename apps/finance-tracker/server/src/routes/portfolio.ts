// Per-user portfolio analytics endpoints.
//
//   GET /api/portfolio/history[?days=90&accountId=...]
//     → [{ date: 'YYYY-MM-DD', valueEur }] — the daily total portfolio value
//       time series, summed across the user's holdings_snapshot rows (optionally
//       scoped to one account). Drives the hero value-over-time chart.
//
// Mounted behind authMiddleware + rateLimit; reads are user-scoped in the repo.

import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { HoldingsSnapshot } from '../db/schemas';
import { buildSnapshot } from '../export/portfolioSnapshot';

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
})
  // GET /api/portfolio/snapshot
  //   → the Investment Research Lab portfolio-snapshot contract (schemaVersion 1)
  //     for the signed-in user. Same JSON the CLI exporter writes; shares the pure
  //     buildSnapshot so the file and the API can never drift.
  .get('/snapshot', async (c) => {
    const pbUserId = c.var.pbUserId;
    const { holdingsRepo } = await import('../db/holdings');
    const { priceCacheRepo } = await import('../db/priceCache');
    const { symbolProfilesRepo } = await import('../db/symbolProfiles');
    const { fxRatesRepo } = await import('../db/fxRates');

    const [holdings, prices, profiles, fxRow] = await Promise.all([
      holdingsRepo.listForUser(pbUserId, { openOnly: true }),
      priceCacheRepo.list(),
      symbolProfilesRepo.list(),
      fxRatesRepo.getLatest(),
    ]);

    try {
      const snapshot = buildSnapshot({
        holdings,
        prices,
        profiles,
        fxRates: fxRow?.rates ?? { EUR: 1 },
      });
      return c.json(snapshot);
    } catch (err) {
      // buildSnapshot throws on un-snapshottable state (no open holdings / zero
      // value) — surface that as 422, not a 500.
      throw new HTTPException(422, {
        message: err instanceof Error ? err.message : 'cannot build snapshot',
      });
    }
  });
