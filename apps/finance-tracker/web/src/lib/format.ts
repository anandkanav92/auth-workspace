/**
 * Locale-aware display formatters for the dashboard.
 *
 * Everything renders in Dutch (nl-NL) conventions — comma decimal separator,
 * dot/space thousands grouping, "€" prefix — because the app targets a NL
 * audience. Formatters are instantiated once at module load; Intl.NumberFormat
 * construction is comparatively expensive, so reusing instances matters when
 * rendering large holding lists.
 */

const LOCALE = "nl-NL";

const eurFormatter = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const pctFormatter = new Intl.NumberFormat(LOCALE, {
  style: "percent",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  signDisplay: "exceptZero",
});

const qtyFormatter = new Intl.NumberFormat(LOCALE, {
  minimumFractionDigits: 0,
  // Share/unit quantities can be fractional (e.g. 0.4218 of an ETF); cap the
  // precision so we don't print floating-point noise.
  maximumFractionDigits: 4,
});

const dateFormatter = new Intl.DateTimeFormat(LOCALE, {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

/** Format a euro amount, e.g. 1234.5 -> "€ 1.234,50". */
export function formatEur(value: number): string {
  return eurFormatter.format(value);
}

/**
 * Format a ratio as a signed percentage, e.g. 0.032 -> "+3,20%".
 * Input is a fraction (0.032), NOT an already-multiplied percentage (3.2).
 */
export function formatPct(ratio: number): string {
  return pctFormatter.format(ratio);
}

/** Format a calendar date, e.g. "07 jun. 2026". Accepts a Date or epoch ms. */
export function formatDate(value: Date | number): string {
  return dateFormatter.format(value);
}

/** Format a share/unit quantity, trimming trailing zeros, e.g. "12,5". */
export function formatQty(value: number): string {
  return qtyFormatter.format(value);
}
