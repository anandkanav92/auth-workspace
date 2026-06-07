// Per-user repo for the `accounts` collection. See perUserRepo.ts for the
// shared CRUD + user-scoping logic.
import { PerUserRepo } from './perUserRepo';
import type { Account, AccountCreate, AccountUpdate } from './schemas';

export class AccountsRepo extends PerUserRepo<
  Account,
  AccountCreate,
  AccountUpdate
> {
  constructor() {
    super('accounts');
  }
}

export const accountsRepo = new AccountsRepo();
