// Shared repo for the `fx_rates` collection (read-all, superuser writes).
// Keyed by the unique `date` (YYYY-MM-DD). See sharedRepo.ts for shared logic.
import { SharedRepo } from './sharedRepo';
import type { FxRates, FxRatesCreate } from './schemas';

export class FxRatesRepo extends SharedRepo<FxRates, FxRatesCreate> {
  constructor() {
    super('fx_rates', 'date');
  }
}

export const fxRatesRepo = new FxRatesRepo();
