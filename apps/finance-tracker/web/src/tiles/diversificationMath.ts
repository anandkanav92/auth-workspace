/**
 * Diversification scoring (M11.4, reviewer fix B4). Pure + testable.
 *
 * The design's original composite `100 × (1 − cbrt(sector_HHI × geo_HHI ×
 * top5_share))` cubed two correlated signals (top5_share and HHI both measure
 * top-position concentration). We replace the headline with **Effective N**:
 *
 *   HHI         = Σ(weightᵢ²)        — Herfindahl-Hirschman index over weights
 *   Effective N = 1 / HHI            — the "effective number of equal positions"
 *
 * Effective N is the intuitive headline: a portfolio of N equal positions scores
 * N; concentration pulls it below the raw position count.
 *
 * The headline uses the OVERALL HHI (per-position value weights). Three
 * sub-scores report Effective N for sector / geo / currency buckets, reusing the
 * allocation breakdowns (which already do ETF look-through for sector and route
 * ETFs to a diversified geo bucket).
 */

import {
  allocateByCountry,
  allocateByCurrency,
  allocateBySector,
} from "./allocationMath";
import type { Position } from "./types";

/** Σ(wᵢ²) for a set of non-negative values, after normalising to weights. */
export function hhi(values: number[]): number {
  const total = values.reduce((s, v) => s + Math.max(v, 0), 0);
  if (total <= 0) return 0;
  let sum = 0;
  for (const v of values) {
    const w = Math.max(v, 0) / total;
    sum += w * w;
  }
  return sum;
}

/** Effective number of holdings = 1 / HHI (0 when HHI is 0 / undefined). */
export function effectiveN(values: number[]): number {
  const h = hhi(values);
  return h > 0 ? 1 / h : 0;
}

export interface DiversificationScores {
  /** Overall HHI over per-position value weights. */
  overallHhi: number;
  /** Headline: 1 / overallHhi — effective number of positions. */
  effectiveN: number;
  /** Raw number of positions in scope (for "N of M" framing). */
  positionCount: number;
  sectorHhi: number;
  geoHhi: number;
  currencyHhi: number;
  sectorEffectiveN: number;
  geoEffectiveN: number;
  currencyEffectiveN: number;
}

export function diversificationScores(
  positions: Position[],
): DiversificationScores {
  const positionValues = positions.map((p) => p.valueEur);
  const sector = allocateBySector(positions).map((s) => s.valueEur);
  const geo = allocateByCountry(positions).map((s) => s.valueEur);
  const currency = allocateByCurrency(positions).map((s) => s.valueEur);

  return {
    overallHhi: hhi(positionValues),
    effectiveN: effectiveN(positionValues),
    positionCount: positions.length,
    sectorHhi: hhi(sector),
    geoHhi: hhi(geo),
    currencyHhi: hhi(currency),
    sectorEffectiveN: effectiveN(sector),
    geoEffectiveN: effectiveN(geo),
    currencyEffectiveN: effectiveN(currency),
  };
}
