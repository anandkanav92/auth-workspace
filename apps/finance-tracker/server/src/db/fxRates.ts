// Shared repo for the `fx_rates` collection (read-all, superuser writes).
// Keyed by the unique `date` (YYYY-MM-DD). See sharedRepo.ts for shared logic.
import { SharedRepo } from './sharedRepo';
import type { FxRates, FxRatesCreate } from './schemas';

export class FxRatesRepo extends SharedRepo<FxRates, FxRatesCreate> {
  constructor() {
    super('fx_rates', 'date');
  }

  /**
   * The most recent fx_rates row by `date` (the daily ECB snapshot the FX cron
   * upserts), or null if the collection is empty. `date` is an ISO YYYY-MM-DD
   * string so a lexicographic descending sort is also chronological. Backs
   * `GET /api/fx` when no explicit `?date=` is supplied.
   */
  async getLatest(): Promise<FxRates | null> {
    const pb = await this.pb();
    return pb
      .collection('fx_rates')
      .getFirstListItem<FxRates>('', { sort: '-date' })
      .catch(() => null);
  }
}

export const fxRatesRepo = new FxRatesRepo();
