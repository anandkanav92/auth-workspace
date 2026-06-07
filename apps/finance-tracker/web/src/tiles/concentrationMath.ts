/**
 * Top-N concentration (M11.3). Pure + testable.
 *
 * "Your top 5 are X% of the portfolio." — ranks positions by EUR value, takes
 * the top N, and reports each one's share of the (whole-portfolio) total plus
 * the combined top-N share.
 */

import type { Position } from "./types";

export interface ConcentrationEntry {
  ticker: string;
  name: string;
  valueEur: number;
  /** Share of the WHOLE portfolio total (0..1). */
  share: number;
}

export interface ConcentrationResult {
  top: ConcentrationEntry[];
  /** Combined share of the top-N over the whole portfolio (0..1). */
  topShare: number;
  totalValueEur: number;
  /** Number of positions in the full portfolio (for "X of Y" framing). */
  positionCount: number;
}

export function topConcentration(
  positions: Position[],
  n = 5,
): ConcentrationResult {
  const totalValueEur = positions.reduce((s, p) => s + p.valueEur, 0);
  const ranked = [...positions]
    .sort((a, b) => b.valueEur - a.valueEur || a.ticker.localeCompare(b.ticker))
    .slice(0, n);

  const top: ConcentrationEntry[] = ranked.map((p) => ({
    ticker: p.ticker,
    name: p.name,
    valueEur: p.valueEur,
    share: totalValueEur > 0 ? p.valueEur / totalValueEur : 0,
  }));

  const topShare = top.reduce((s, e) => s + e.share, 0);

  return {
    top,
    topShare,
    totalValueEur,
    positionCount: positions.length,
  };
}
