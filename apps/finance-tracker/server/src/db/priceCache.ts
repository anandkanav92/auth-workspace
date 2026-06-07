// Shared repo for the `price_cache` collection (read-all, superuser writes).
// Keyed by the unique `ticker`. See sharedRepo.ts for shared logic.
import { SharedRepo } from './sharedRepo';
import type { PriceCache, PriceCacheCreate } from './schemas';

export class PriceCacheRepo extends SharedRepo<PriceCache, PriceCacheCreate> {
  constructor() {
    super('price_cache', 'ticker');
  }
}

export const priceCacheRepo = new PriceCacheRepo();
