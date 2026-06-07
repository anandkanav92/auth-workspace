// Per-user repo for the `transactions` collection. See perUserRepo.ts for
// shared CRUD + user-scoping logic.
import type { ListResult } from 'pocketbase';
import { PerUserRepo } from './perUserRepo';
import type {
  Transaction,
  TransactionCreate,
  TransactionUpdate,
} from './schemas';

export class TransactionsRepo extends PerUserRepo<
  Transaction,
  TransactionCreate,
  TransactionUpdate
> {
  constructor() {
    super('transactions');
  }

  /**
   * Paged transaction list for this user, newest first, optionally scoped to
   * one account. Returns PocketBase's ListResult so the route can echo
   * page/perPage/totalItems/totalPages.
   */
  async listPaged(
    pbUserId: string,
    opts: { page?: number; perPage?: number; account?: string } = {},
  ): Promise<ListResult<Transaction>> {
    const page = opts.page ?? 1;
    const perPage = opts.perPage ?? 50;
    const extra = opts.account
      ? { fragment: 'account = {:account}', params: { account: opts.account } }
      : undefined;
    return this.listPagedWhere(pbUserId, page, perPage, extra, '-occurred_at');
  }
}

export const transactionsRepo = new TransactionsRepo();
