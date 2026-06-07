// Shared repo for the `symbol_profiles` collection (read-all, superuser
// writes). Keyed by the unique `ticker`. See sharedRepo.ts for shared logic.
import { SharedRepo } from './sharedRepo';
import { pbAdmin } from '../lib/pb';
import type { SymbolProfile, SymbolProfileCreate } from './schemas';

export class SymbolProfilesRepo extends SharedRepo<
  SymbolProfile,
  SymbolProfileCreate
> {
  constructor() {
    super('symbol_profiles', 'ticker');
  }

  /**
   * Fetch the first profile whose `isin` matches, or null. ISIN is the canonical
   * join key for statement imports (the broker symbol can differ across venues,
   * but the ISIN is stable). The collection's isin index is non-unique, so we
   * take the first match. Uses PocketBase's PARAMETERIZED filter binding.
   */
  async getByIsin(isin: string): Promise<SymbolProfile | null> {
    if (!isin) return null;
    const pb = await pbAdmin();
    const filter = pb.filter('isin = {:isin}', { isin });
    return pb
      .collection('symbol_profiles')
      .getFirstListItem<SymbolProfile>(filter)
      .catch(() => null);
  }
}

export const symbolProfilesRepo = new SymbolProfilesRepo();
