// Per-user repo for the `holdings_snapshot` collection. See perUserRepo.ts for
// shared CRUD + user-scoping logic.
import { PerUserRepo } from './perUserRepo';
import { pbAdmin } from '../lib/pb';
import type {
  HoldingsSnapshot,
  HoldingsSnapshotCreate,
  HoldingsSnapshotUpdate,
} from './schemas';

export class HoldingsSnapshotRepo extends PerUserRepo<
  HoldingsSnapshot,
  HoldingsSnapshotCreate,
  HoldingsSnapshotUpdate
> {
  constructor() {
    super('holdings_snapshot');
  }

  /**
   * ADMIN-SCOPED, ALL-USERS read of every snapshot row whose `date` falls in
   * [start, end) (half-open, ISO datetime strings). Backs the nightly snapshot
   * job's idempotency check: one query for "all of today's rows" lets the job
   * skip holdings already snapshotted today, instead of a query per holding.
   *
   * Not request-scoped — cron only. Uses a PARAMETERIZED filter (pb.filter).
   */
  async listAllByDateRange(start: string, end: string): Promise<HoldingsSnapshot[]> {
    const pb = await pbAdmin();
    const filter = pb.filter('date >= {:start} && date < {:end}', { start, end });
    return pb
      .collection(this.collection)
      .getFullList<HoldingsSnapshot>({ filter });
  }

  /**
   * USER-SCOPED snapshot rows on/after `since` (YYYY-MM-DD), optionally limited
   * to one account, ordered by date ascending. Backs the portfolio value-over-
   * time chart (GET /api/portfolio/history). Defensively scoped to the caller's
   * user via the inherited PARAMETERIZED filter.
   */
  async historyForUser(
    pbUserId: string,
    since: string,
    accountId?: string,
  ): Promise<HoldingsSnapshot[]> {
    const fragment = accountId
      ? 'date >= {:since} && account = {:account}'
      : 'date >= {:since}';
    const params = accountId ? { since, account: accountId } : { since };
    return this.listWhere(pbUserId, { fragment, params }, 'date');
  }

  /**
   * ADMIN-SCOPED, ALL-USERS read of every snapshot row strictly OLDER than
   * `before` (ISO datetime). Backs the weekly prune job. Cron only.
   */
  async listAllOlderThan(before: string): Promise<HoldingsSnapshot[]> {
    const pb = await pbAdmin();
    const filter = pb.filter('date < {:before}', { before });
    return pb
      .collection(this.collection)
      .getFullList<HoldingsSnapshot>({ filter });
  }
}

export const holdingsSnapshotRepo = new HoldingsSnapshotRepo();
