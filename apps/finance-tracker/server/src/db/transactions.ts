// Per-user repo for the `transactions` collection. See perUserRepo.ts for
// shared CRUD + user-scoping logic.
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
}

export const transactionsRepo = new TransactionsRepo();
