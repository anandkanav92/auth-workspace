// Timezone helpers for the cron jobs. All jobs schedule in Europe/Amsterdam and
// key their idempotent writes by the Amsterdam calendar date, so the "FX day" /
// "snapshot day" matches what the user sees locally regardless of the server's
// system timezone (containers run UTC).

const AMSTERDAM_TZ = 'Europe/Amsterdam';

// en-CA formats as YYYY-MM-DD, which is exactly our date key format.
const amsterdamDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: AMSTERDAM_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** The calendar date (YYYY-MM-DD) of `d` in Europe/Amsterdam. */
export function amsterdamDate(d: Date = new Date()): string {
  return amsterdamDateFormatter.format(d);
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * The Amsterdam calendar date `days` days before `from` (YYYY-MM-DD). Used to
 * compute the 90-day prune cutoff and the 7-day stale-profile cutoff. Day-length
 * arithmetic in UTC ms is exact for whole-day offsets at this granularity (the
 * one-hour DST shift never moves a whole-day boundary across midnight).
 */
export function amsterdamDateDaysAgo(days: number, from: Date = new Date()): string {
  return amsterdamDate(new Date(from.getTime() - days * MS_PER_DAY));
}

/** ISO datetime `days` days before `from`. Used for parameterized PB filters. */
export function isoDaysAgo(days: number, from: Date = new Date()): string {
  return new Date(from.getTime() - days * MS_PER_DAY).toISOString();
}

/**
 * True if the calendar day of `date` (a YYYY-MM-DD prefix, or any string PB's
 * Date parser accepts) is a Sunday. Snapshot dates are stored as the Amsterdam
 * date, so we anchor at noon UTC to avoid a midnight ± timezone edge flipping
 * the weekday. The prune job keeps Sundays as the weekly representative row.
 */
export function isSunday(date: string): boolean {
  // Take just the date part so a trailing time component never shifts the day.
  const ymd = date.slice(0, 10);
  // getUTCDay on a noon-UTC instant of that date: 0 = Sunday.
  return new Date(`${ymd}T12:00:00.000Z`).getUTCDay() === 0;
}
