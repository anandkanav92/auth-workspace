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

  /**
   * Substring search over the cached profiles by ticker OR name (case-insensitive
   * `~` contains). Powers the M7 `/api/search` cache-first lookup. Uses
   * PocketBase's PARAMETERIZED filter binding — the same `{:q}` value is bound
   * into both clauses, so a hostile query can never break out of the filter.
   *
   * @param query the user's search string (already trimmed by the caller).
   * @param limit max rows to return (default 10, matching the provider chain).
   */
  async search(query: string, limit = 10): Promise<SymbolProfile[]> {
    if (!query) return [];
    const pb = await pbAdmin();
    const filter = pb.filter('ticker ~ {:q} || name ~ {:q}', { q: query });
    const page = await pb
      .collection('symbol_profiles')
      .getList<SymbolProfile>(1, limit, { filter })
      .catch(() => null);
    return page?.items ?? [];
  }

  /**
   * ADMIN-SCOPED list of profiles whose `last_refreshed_at` is older than
   * `cutoff` (ISO datetime) OR has never been set (empty string — PocketBase's
   * representation of an unset DateField). Backs the weekly profile-refresh cron
   * (M8.5): "find symbol_profiles with last_refreshed_at < now - 7d, refresh".
   *
   * Cron only. Uses a PARAMETERIZED filter (pb.filter).
   */
  async listStale(cutoff: string): Promise<SymbolProfile[]> {
    const pb = await pbAdmin();
    const filter = pb.filter(
      'last_refreshed_at < {:cutoff} || last_refreshed_at = ""',
      { cutoff },
    );
    return pb
      .collection('symbol_profiles')
      .getFullList<SymbolProfile>({ filter });
  }
}

export const symbolProfilesRepo = new SymbolProfilesRepo();
