// Shared repo for the `fx_rates` collection (read-all, superuser writes).
// Keyed by the unique `date` (YYYY-MM-DD). See sharedRepo.ts for shared logic.
import { SharedRepo } from './sharedRepo';
import type { FxRates, FxRatesCreate } from './schemas';

/** The calendar day AFTER `ymd` (a YYYY-MM-DD string), as YYYY-MM-DD. */
function nextDay(ymd: string): string {
  // Anchor at noon UTC so the +1-day step never lands on a DST boundary that
  // could shift the calendar date; en-CA formatting yields YYYY-MM-DD.
  const next = new Date(`${ymd}T12:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 10);
}

export class FxRatesRepo extends SharedRepo<FxRates, FxRatesCreate> {
  constructor() {
    super('fx_rates', 'date');
  }

  /**
   * Find today's row by CALENDAR DAY, not exact-string equality. The `date`
   * field is a PB DateField stored as a full datetime ('YYYY-MM-DD 00:00:00.000Z'),
   * so the base repo's `date = 'YYYY-MM-DD'` exact match never matched the
   * stored value — the upsert fell through to CREATE and the unique `date`
   * index rejected the same-day re-run with a 400 (prod FX-refresh bug).
   *
   * We accept any key the cron/route passes (date-only 'YYYY-MM-DD' or a full
   * datetime), take its YYYY-MM-DD prefix, and match the half-open day range
   * [day 00:00:00, nextDay 00:00:00) so a same-day re-run UPDATES the row.
   */
  protected override async findByKey(key: string): Promise<FxRates | null> {
    const day = key.slice(0, 10); // YYYY-MM-DD prefix (handles datetime keys)
    const pb = await this.pb();
    const filter = pb.filter('date >= {:start} && date < {:end}', {
      start: `${day} 00:00:00`,
      end: `${nextDay(day)} 00:00:00`,
    });
    return pb
      .collection('fx_rates')
      .getFirstListItem<FxRates>(filter)
      .catch(() => null);
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
