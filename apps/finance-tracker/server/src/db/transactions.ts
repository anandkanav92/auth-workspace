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

  /**
   * Idempotently upsert a synced transaction keyed by (user, source,
   * external_id) — the partial-unique key from migration 1780900100. The broker
   * sync re-pulls the full ledger every run, so this finds an existing row for
   * the same event and UPDATEs it, otherwise CREATEs a new one. Safe to call
   * repeatedly: the same external_id always resolves to one row.
   *
   * `external_id` MUST be non-empty (the partial index only covers synced rows);
   * manual rows with an empty id are inserted via the plain `create` instead.
   * The lookup uses PocketBase's PARAMETERIZED filter binding (never string
   * interpolation), mirroring symbolProfiles.getByIsin.
   */
  async upsertByExternalId(row: TransactionCreate): Promise<Transaction> {
    if (!row.external_id) {
      throw new Error('upsertByExternalId requires a non-empty external_id');
    }
    const pb = await this.pb();
    const filter = pb.filter(
      'user = {:user} && source = {:source} && external_id = {:extId}',
      { user: row.user, source: row.source, extId: row.external_id },
    );
    const existing = await pb
      .collection(this.collection)
      .getFirstListItem<Transaction>(filter)
      .catch(() => null);
    if (existing) {
      return this.update(existing.id, row as TransactionUpdate);
    }
    return this.create(row);
  }
}

export const transactionsRepo = new TransactionsRepo();
