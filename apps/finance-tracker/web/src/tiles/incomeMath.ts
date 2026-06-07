/**
 * Income / dividend math (M11.5). Pure + testable.
 *
 *   weighted_div_yield = Σ(weightᵢ × dividend_yieldᵢ)
 *   expected_annual_eur = weighted_div_yield × total_value_eur
 *
 * where `weightᵢ = valueEurᵢ / total_value_eur` is each position's share of the
 * WHOLE portfolio. Positions with no `dividendYield` data are SKIPPED — they
 * contribute neither yield nor income (we honestly don't know their yield), so
 * the headline yield is the portfolio-wide dividend yield, not the yield of the
 * dividend-paying subset.
 *
 * `coveredValueEur` / `coveredFraction` report how much of the portfolio had
 * usable yield data, so the tile can footnote the coverage.
 */

import type { Position } from "./types";

export interface IncomeResult {
  /** Portfolio-wide weighted dividend yield as a fraction (0..1). */
  weightedYield: number;
  /** Expected annual dividend income in EUR (weightedYield × totalValueEur). */
  expectedAnnualEur: number;
  /** Total portfolio value in EUR (denominator for the weights). */
  totalValueEur: number;
  /** Value of positions that HAD a dividend yield (the covered subset). */
  coveredValueEur: number;
  /** coveredValueEur / totalValueEur (0..1), or 0 for an empty portfolio. */
  coveredFraction: number;
  /** Number of positions that contributed a yield. */
  contributingCount: number;
}

/** Whether a position has usable dividend-yield data (finite, ≥ 0). */
function hasYield(p: Position): boolean {
  return typeof p.dividendYield === "number" && Number.isFinite(p.dividendYield);
}

export function computeIncome(positions: Position[]): IncomeResult {
  const totalValueEur = positions.reduce((s, p) => s + p.valueEur, 0);

  let weightedYield = 0;
  let coveredValueEur = 0;
  let contributingCount = 0;

  if (totalValueEur > 0) {
    for (const p of positions) {
      if (!hasYield(p)) continue;
      const weight = p.valueEur / totalValueEur;
      weightedYield += weight * (p.dividendYield as number);
      coveredValueEur += p.valueEur;
      contributingCount += 1;
    }
  }

  return {
    weightedYield,
    expectedAnnualEur: weightedYield * totalValueEur,
    totalValueEur,
    coveredValueEur,
    coveredFraction: totalValueEur > 0 ? coveredValueEur / totalValueEur : 0,
    contributingCount,
  };
}
