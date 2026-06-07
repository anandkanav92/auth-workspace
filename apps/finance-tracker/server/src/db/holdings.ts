// Per-user repo for the `holdings` collection. See perUserRepo.ts for shared
// CRUD + user-scoping logic.
import { PerUserRepo } from './perUserRepo';
import { pbAdmin } from '../lib/pb';
import type { Holding, HoldingCreate, HoldingUpdate } from './schemas';

export class HoldingsRepo extends PerUserRepo<
  Holding,
  HoldingCreate,
  HoldingUpdate
> {
  constructor() {
    super('holdings');
  }

  /**
   * List this user's holdings, optionally scoped to one account. When
   * `openOnly` is set, closed positions (quantity 0 — our marker for a fully
   * sold/closed holding, since the schema has no closed_at field) are excluded.
   */
  async listForUser(
    pbUserId: string,
    opts: { account?: string; openOnly?: boolean } = {},
  ): Promise<Holding[]> {
    const fragments: string[] = [];
    const params: Record<string, unknown> = {};
    if (opts.account) {
      fragments.push('account = {:account}');
      params.account = opts.account;
    }
    if (opts.openOnly) {
      fragments.push('quantity > 0');
    }
    const extra = fragments.length
      ? { fragment: fragments.join(' && '), params }
      : undefined;
    return this.listWhere(pbUserId, extra);
  }

  /**
   * Find this user's holding for a given (account, ticker), or null if none.
   * Backs the weighted-average upsert in POST /api/holdings. Scoped by user so
   * the admin token never reaches another user's row.
   */
  async findByTicker(
    pbUserId: string,
    account: string,
    ticker: string,
  ): Promise<Holding | null> {
    const matches = await this.listWhere(pbUserId, {
      fragment: 'account = {:account} && ticker = {:ticker}',
      params: { account, ticker },
    });
    return matches[0] ?? null;
  }

  /**
   * ADMIN-SCOPED, ALL-USERS query: every OPEN holding (quantity > 0) across the
   * whole instance, regardless of owner. This is the ONLY repo method that is
   * intentionally NOT user-scoped — it backs the cron jobs (M8), which run as
   * the service account and are not request-scoped to a single user.
   *
   * Do NOT call this from a request handler: per-user routes must stay scoped
   * via listForUser(). The admin token bypasses collection rules, so an
   * unscoped read here is safe only because the caller (cron) is trusted.
   */
  async listAllOpen(): Promise<Holding[]> {
    const pb = await pbAdmin();
    return pb
      .collection(this.collection)
      .getFullList<Holding>({ filter: 'quantity > 0' });
  }
}

export const holdingsRepo = new HoldingsRepo();
