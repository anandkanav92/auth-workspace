/**
 * Movers — biggest gainers and losers by unrealised return %.
 *
 * Only positions with a usable cost basis can have a return (Revolut holdings
 * carry none — spike 2), so those are excluded; `consideredCount` reports how
 * many positions were eligible so the tile can footnote coverage.
 */

import type { Position } from "./types";

export interface MoverEntry {
  ticker: string;
  name: string;
  /** Unrealised return as a fraction (e.g. +1.07 = +107%). */
  returnPct: number;
  returnEur: number;
  valueEur: number;
}

export interface MoversResult {
  /** Best performers, highest return % first. */
  gainers: MoverEntry[];
  /** Worst performers, lowest (most negative) return % first. */
  losers: MoverEntry[];
  /** Cost-bearing positions eligible for a return (the considered set). */
  consideredCount: number;
}

export function computeMovers(positions: Position[], n = 3): MoversResult {
  const eligible = positions
    .filter(
      (p) =>
        p.hasCost &&
        p.returnPct !== null &&
        p.costEur !== null &&
        (p.costEur ?? 0) > 0,
    )
    .map((p) => ({
      ticker: p.ticker,
      name: p.name,
      returnPct: p.returnPct as number,
      returnEur: p.returnEur ?? 0,
      valueEur: p.valueEur,
    }));

  const byReturnDesc = [...eligible].sort((a, b) => b.returnPct - a.returnPct);
  const gainers = byReturnDesc.filter((e) => e.returnPct > 0).slice(0, n);
  // Most negative first: the tail of the desc sort, reversed.
  const losers = byReturnDesc
    .filter((e) => e.returnPct < 0)
    .slice(-n)
    .reverse();

  return { gainers, losers, consideredCount: eligible.length };
}
