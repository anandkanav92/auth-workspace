import { describe, it, expect, vi } from 'vitest';
import {
  runPruneSnapshotsWith,
  type PruneSnapshotsDeps,
} from '../../src/cron/pruneSnapshots';
import type { HoldingsSnapshot } from '../../src/db/schemas';

function snap(date: string, id = `s-${date}`): HoldingsSnapshot {
  return {
    id,
    created: '',
    updated: '',
    user: 'u1',
    account: 'a1',
    ticker: 'AAPL',
    quantity: 10,
    eur_value: 100,
    date,
  };
}

function makeDeps(overrides: {
  /** Rows the repo returns for `date < cutoff` (i.e. already >90d old). */
  old?: HoldingsSnapshot[];
  now?: () => Date;
  del?: (id: string) => Promise<boolean>;
}): PruneSnapshotsDeps & {
  listAllOlderThan: ReturnType<typeof vi.fn>;
  del: ReturnType<typeof vi.fn>;
} {
  const listAllOlderThan = vi.fn(async () => overrides.old ?? []);
  const del = vi.fn(overrides.del ?? (async () => true));
  return {
    snapshots: { listAllOlderThan, delete: del } as never,
    now: overrides.now ?? (() => new Date('2026-06-08T01:00:00Z')), // Monday
    listAllOlderThan,
    del,
  };
}

describe('runPruneSnapshotsWith', () => {
  it('queries with the 90-day cutoff date', async () => {
    const deps = makeDeps({ now: () => new Date('2026-06-08T01:00:00Z') });
    await runPruneSnapshotsWith(deps);
    // 2026-06-08 − 90d = 2026-03-10 (Amsterdam date).
    expect(deps.listAllOlderThan).toHaveBeenCalledWith('2026-03-10');
  });

  it('deletes a weekday row older than 90 days', async () => {
    const monday = snap('2026-03-02'); // Monday, < cutoff 2026-03-10
    const deps = makeDeps({ old: [monday] });
    const res = await runPruneSnapshotsWith(deps);
    expect(res.deleted).toBe(1);
    expect(deps.del).toHaveBeenCalledWith(monday.id);
  });

  it('KEEPS a Sunday row older than 90 days (weekly representative)', async () => {
    const sunday = snap('2026-03-01'); // Sunday, < cutoff
    const deps = makeDeps({ old: [sunday] });
    const res = await runPruneSnapshotsWith(deps);
    expect(res.kept).toBe(1);
    expect(res.deleted).toBe(0);
    expect(deps.del).not.toHaveBeenCalled();
  });

  it('rows newer than 90 days are untouched (repo never returns them)', async () => {
    // The repo's listAllOlderThan filters to date < cutoff, so ≤90d rows never
    // reach the job. Model that: an empty old-set → nothing deleted or kept.
    const deps = makeDeps({ old: [] });
    const res = await runPruneSnapshotsWith(deps);
    expect(res.examined).toBe(0);
    expect(res.deleted).toBe(0);
    expect(res.kept).toBe(0);
    expect(deps.del).not.toHaveBeenCalled();
  });

  it('collapses a mixed week to Sunday only', async () => {
    const week = [
      snap('2026-03-01'), // Sun → keep
      snap('2026-03-02'), // Mon → delete
      snap('2026-03-03'), // Tue → delete
      snap('2026-03-08'), // Sun → keep
    ];
    const deps = makeDeps({ old: week });
    const res = await runPruneSnapshotsWith(deps);
    expect(res.kept).toBe(2); // both Sundays
    expect(res.deleted).toBe(2); // Mon + Tue
    const deletedIds = deps.del.mock.calls.map((c) => c[0]).sort();
    expect(deletedIds).toEqual(['s-2026-03-02', 's-2026-03-03']);
  });

  it('idempotent: a re-run after pruning deletes nothing (only Sundays remain >90d)', async () => {
    // After the first prune, the only >90d rows left are Sundays.
    const deps = makeDeps({ old: [snap('2026-03-01'), snap('2026-03-08')] });
    const res = await runPruneSnapshotsWith(deps);
    expect(res.deleted).toBe(0);
    expect(res.kept).toBe(2);
  });

  it('a per-row delete failure does not abort the batch', async () => {
    let n = 0;
    const deps = makeDeps({
      old: [snap('2026-03-02'), snap('2026-03-03')], // two weekdays to delete
      del: async () => {
        if (n++ === 0) throw new Error('PB delete failed');
        return true;
      },
    });
    const res = await runPruneSnapshotsWith(deps);
    expect(res.failed).toBe(1);
    expect(res.deleted).toBe(1);
  });
});
