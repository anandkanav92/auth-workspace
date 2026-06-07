// Per-user repo for the `holdings` collection. See perUserRepo.ts for shared
// CRUD + user-scoping logic.
import { PerUserRepo } from './perUserRepo';
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
}

export const holdingsRepo = new HoldingsRepo();
