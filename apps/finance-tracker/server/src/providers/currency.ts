// Minor-unit ("pence") currency normalization.
//
// Some venues quote in 1/100 of the major unit: the London Stock Exchange prices
// in pence — Trading 212 statements print the code "GBX", Yahoo Finance returns
// "GBp". Both mean 1/100 GBP. The rest of the app (ECB FX rates, EUR conversion,
// cost-basis math) assumes MAJOR-unit currencies that exist in the ECB feed, and
// ECB only publishes "GBP". So we normalise pence → GBP (amount ÷ 100) at every
// boundary where an external amount+currency enters the system (the price
// provider and the statement importer).
//
// Case matters: "GBp" (pence, Yahoo) and "GBX" (pence, T212) are minor units;
// "GBP" (pounds) is the major unit and is left untouched. A naïve upper-case
// compare would wrongly fold GBP into the pence bucket — don't do that.

/** Currency codes that denote pence (1/100 GBP). Case-sensitive on purpose. */
const PENCE_CODES = new Set(['GBX', 'GBp']);

export interface NormalizedMoney {
  amount: number;
  currency: string | undefined;
}

/**
 * Normalise an amount expressed in a pence currency to its major unit.
 * GBX / GBp → { amount/100, 'GBP' }. Everything else passes through unchanged
 * (including an undefined currency, so callers can pipe optional values).
 */
export function normalizePence(
  amount: number,
  currency: string | undefined,
): NormalizedMoney {
  if (currency && PENCE_CODES.has(currency)) {
    return { amount: amount / 100, currency: 'GBP' };
  }
  return { amount, currency };
}

/** Normalise just the currency code (GBX/GBp → GBP), leaving amounts aside. */
export function normalizeCurrencyCode(
  currency: string | undefined,
): string | undefined {
  return currency && PENCE_CODES.has(currency) ? 'GBP' : currency;
}
