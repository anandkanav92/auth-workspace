// Shared repo for the `symbol_profiles` collection (read-all, superuser
// writes). Keyed by the unique `ticker`. See sharedRepo.ts for shared logic.
import { SharedRepo } from './sharedRepo';
import type { SymbolProfile, SymbolProfileCreate } from './schemas';

export class SymbolProfilesRepo extends SharedRepo<
  SymbolProfile,
  SymbolProfileCreate
> {
  constructor() {
    super('symbol_profiles', 'ticker');
  }
}

export const symbolProfilesRepo = new SymbolProfilesRepo();
