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
}

export const holdingsRepo = new HoldingsRepo();
