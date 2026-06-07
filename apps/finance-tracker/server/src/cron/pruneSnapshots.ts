// Weekly snapshot-prune cron (M8.6, reviewer fix I8). Collapses holdings_snapshot
// rows OLDER than 90 days to one-per-week: it keeps the Sunday row of each week
// and deletes the other weekdays. Rows within the last 90 days are left fully
// intact (daily granularity). Without this, 50 holdings × 365 days × 100 users
// would be ~1.8M rows/year; keeping only weekly rows past 90 days drops that by
// ~85% while preserving the long-run time series for the Phase 2 charts.
//
// The 90-day cutoff is the Amsterdam calendar date 90 days ago, matched against
// each row's stored Amsterdam `date`. listAllOlderThan returns rows with
// `date < cutoff` (strictly older than 90 days). Of those, Sunday rows are
// retained; every non-Sunday row is deleted.
//
// Idempotency: a re-run only ever finds rows still older than the (re-computed)
// cutoff; Sundays were never deleted, so it deletes nothing new. Per-row
// try/catch keeps one failed delete from aborting the batch.
//
// Deps are injected for unit testing; runPruneSnapshots() binds the real repo.

import type { HoldingsSnapshotRepo } from '../db/holdingsSnapshot';
import { amsterdamDate, isSunday } from './time';

const RETAIN_DAILY_DAYS = 90;

export interface PruneSnapshotsDeps {
  snapshots: Pick<HoldingsSnapshotRepo, 'listAllOlderThan' | 'delete'>;
  /** Injectable clock for deterministic tests; defaults to now. */
  now?: () => Date;
}

export interface PruneSnapshotsResult {
  /** ISO cutoff (Amsterdam date 90d ago) used for the prune. */
  cutoff: string;
  /** Rows strictly older than 90 days that were examined. */
  examined: number;
  /** Sunday rows kept as the weekly representative. */
  kept: number;
  /** Non-Sunday rows deleted. */
  deleted: number;
  /** Rows that threw during delete (logged, not fatal). */
  failed: number;
}

/**
 * Prune snapshot rows older than 90 days down to weekly (Sundays only). Never
 * throws on a per-row failure.
 */
export async function runPruneSnapshotsWith(
  deps: PruneSnapshotsDeps,
): Promise<PruneSnapshotsResult> {
  const now = deps.now?.() ?? new Date();
  // Cutoff = the Amsterdam date 90 days ago, as a date string. Rows whose stored
  // `date` is < this are "older than 90 days". Comparing date strings (YYYY-MM-DD)
  // lexicographically is equivalent to comparing the dates.
  const cutoff = amsterdamDate(new Date(now.getTime() - RETAIN_DAILY_DAYS * 24 * 60 * 60 * 1000));

  const old = await deps.snapshots.listAllOlderThan(cutoff);

  let kept = 0;
  let deleted = 0;
  let failed = 0;

  for (const row of old) {
    if (isSunday(row.date)) {
      kept++; // weekly representative — keep it.
      continue;
    }
    try {
      await deps.snapshots.delete(row.id);
      deleted++;
    } catch (err) {
      failed++;
      console.error(`[cron:pruneSnapshots] delete ${row.id} failed:`, err);
    }
  }

  return { cutoff, examined: old.length, kept, deleted, failed };
}

// --- Production binding -------------------------------------------------------
let prodDeps: PruneSnapshotsDeps | undefined;
async function getProdDeps(): Promise<PruneSnapshotsDeps> {
  if (!prodDeps) {
    const { holdingsSnapshotRepo } = await import('../db/holdingsSnapshot');
    prodDeps = { snapshots: holdingsSnapshotRepo };
  }
  return prodDeps;
}

export async function runPruneSnapshots(): Promise<PruneSnapshotsResult> {
  return runPruneSnapshotsWith(await getProdDeps());
}
