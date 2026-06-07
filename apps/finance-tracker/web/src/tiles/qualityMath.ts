/**
 * Quality math (M11.6, reviewer fix I11). Pure + testable.
 *
 *   weighted_pe   = 1 / Σ(weightᵢ × (1/peᵢ))   — value-weighted HARMONIC mean
 *   weighted_beta = Σ(weightᵢ × betaᵢ)         — value-weighted arithmetic mean
 *
 * NEGATIVE-PE EXCLUSION (I11): the harmonic mean is undefined / nonsensical when
 * any constituent P/E ≤ 0 (loss-making companies — a negative P/E would pull the
 * reciprocal sum the wrong way). We EXCLUDE positions with `pe ≤ 0` (or missing
 * P/E) from the P/E calculation and report how many were excluded and what share
 * of the portfolio they represent, so the tile can show the I11 banner.
 *
 * Weights are normalised WITHIN each metric's included subset (the PE subset and
 * the beta subset can differ), so each weighted mean is a true mean over the data
 * we actually have — not diluted by positions we had to drop.
 */

import type { Position } from "./types";

export interface QualityResult {
  /** Value-weighted harmonic mean P/E over positions with pe > 0, or null. */
  weightedPe: number | null;
  /** Value-weighted mean beta over positions with beta data, or null. */
  weightedBeta: number | null;
  /** Number of positions excluded from P/E for being loss-making (pe ≤ 0). */
  excludedCount: number;
  /** EUR value of those loss-making positions. */
  excludedValueEur: number;
  /** excludedValueEur / totalValueEur (0..1) — the "M% of portfolio" in the banner. */
  excludedFraction: number;
  /** Number of positions that contributed a (positive) P/E. */
  peCount: number;
  /** Total portfolio value in EUR. */
  totalValueEur: number;
}

function isFiniteNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

export function computeQuality(positions: Position[]): QualityResult {
  const totalValueEur = positions.reduce((s, p) => s + p.valueEur, 0);

  // --- weighted harmonic P/E over the pe > 0 subset -------------------------
  // Σ(value/pe) ÷ Σ(value) gives the value-weighted mean of 1/pe; the harmonic
  // mean P/E is its reciprocal. Working in raw value avoids pre-normalising.
  let peValueSum = 0; // Σ value over the included (pe > 0) subset
  let reciprocalValueSum = 0; // Σ (value / pe) over that subset
  let peCount = 0;
  let excludedCount = 0;
  let excludedValueEur = 0;

  // --- value-weighted beta over the beta subset -----------------------------
  let betaValueSum = 0; // Σ value over positions with beta data
  let betaWeightedSum = 0; // Σ (value × beta)

  for (const p of positions) {
    if (isFiniteNumber(p.pe) && p.pe !== 0) {
      if (p.pe > 0) {
        peValueSum += p.valueEur;
        reciprocalValueSum += p.valueEur / p.pe;
        peCount += 1;
      } else {
        // Genuinely loss-making (pe < 0): excluded from the harmonic mean (I11).
        excludedCount += 1;
        excludedValueEur += p.valueEur;
      }
    }
    // NOTE: pe === 0 (or missing) means "no P/E data" — NOT loss-making. PocketBase
    // coerces a null pe_ratio to 0 on read, and ETFs have no P/E, so treating 0 as
    // loss-making wrongly flagged every ETF + no-data stock. Such positions simply
    // don't contribute to the weighted P/E.

    if (isFiniteNumber(p.beta)) {
      betaValueSum += p.valueEur;
      betaWeightedSum += p.valueEur * p.beta;
    }
  }

  const weightedPe =
    reciprocalValueSum > 0 ? peValueSum / reciprocalValueSum : null;
  const weightedBeta = betaValueSum > 0 ? betaWeightedSum / betaValueSum : null;

  return {
    weightedPe,
    weightedBeta,
    excludedCount,
    excludedValueEur,
    excludedFraction: totalValueEur > 0 ? excludedValueEur / totalValueEur : 0,
    peCount,
    totalValueEur,
  };
}
