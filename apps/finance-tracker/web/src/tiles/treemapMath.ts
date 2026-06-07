/**
 * Treemap data transform (M11.7). Pure + testable.
 *
 * Turns the joined positions into ECharts treemap nodes:
 *   - box SIZE  = position `valueEur`
 *   - box COLOUR = a green↔red gradient over `returnPct` (gain → green, loss →
 *     red). Positions WITHOUT a cost basis (returnPct === null) get a neutral
 *     grey — we can't colour a P&L we don't have.
 *
 * GROUPING (design risk note + M11.7): a treemap with 100+ leaves is unreadable.
 * When the position count exceeds `groupThreshold`, the largest `topN` are kept
 * as individual leaves and the remaining long tail is collapsed into a single
 * "Other" node whose children are the collapsed positions — ECharts renders the
 * "Other" box at the top level and drills into its children on click.
 */

import type { Position } from "./types";

export const NEUTRAL_COLOR = "#94a3b8"; // slate-400 — "no cost basis" boxes
export const OTHER_COLOR = "#475569"; // slate-600 — the grouped "Other" box
export const OTHER_NAME = "Other";

/** One ECharts treemap node. `children` is present only for the "Other" group. */
export interface TreemapNode {
  name: string;
  value: number;
  itemStyle: { color: string };
  /** Original return fraction (null when the position has no cost basis). */
  returnPct: number | null;
  children?: TreemapNode[];
}

export interface TreemapOptions {
  /** Above this position count, collapse the tail into "Other". Default 100. */
  groupThreshold?: number;
  /** How many top positions to keep as individual leaves. Default 50. */
  topN?: number;
  /** Max |returnPct| that maps to full-saturation colour. Default 0.5 (±50%). */
  saturationAt?: number;
}

/**
 * Map a return fraction to a green (gain) / red (loss) / neutral (no cost)
 * colour. `null` → neutral grey. Magnitude saturates at ±`saturationAt`.
 */
export function colorForReturn(returnPct: number | null, saturationAt = 0.5): string {
  if (returnPct === null || !Number.isFinite(returnPct)) return NEUTRAL_COLOR;
  // Intensity 0..1 by how far from break-even, clamped at the saturation point.
  const intensity = Math.min(1, Math.abs(returnPct) / Math.max(saturationAt, 1e-9));
  if (returnPct >= 0) {
    // green: lerp a pale green → a strong green as intensity rises.
    return lerpColor([209, 250, 229], [16, 185, 129], intensity); // emerald-100 → emerald-500
  }
  return lerpColor([254, 226, 226], [239, 68, 68], intensity); // red-100 → red-500
}

/** Linear-interpolate between two RGB triples, returning a #rrggbb string. */
function lerpColor(a: [number, number, number], b: [number, number, number], t: number): string {
  const ch = (i: number) => Math.round(a[i] + (b[i] - a[i]) * t);
  const hex = (n: number) => n.toString(16).padStart(2, "0");
  return `#${hex(ch(0))}${hex(ch(1))}${hex(ch(2))}`;
}

function toLeaf(p: Position, saturationAt: number): TreemapNode {
  return {
    name: p.ticker,
    value: p.valueEur,
    returnPct: p.returnPct,
    itemStyle: { color: colorForReturn(p.returnPct, saturationAt) },
  };
}

/**
 * Build the treemap node list. Returns top-level nodes; when grouping kicks in
 * the last node is the "Other" group carrying the collapsed tail as `children`.
 */
export function buildTreemapData(
  positions: Position[],
  opts: TreemapOptions = {},
): TreemapNode[] {
  const { groupThreshold = 100, topN = 50, saturationAt = 0.5 } = opts;

  // Only positions with a positive value can occupy area in the treemap.
  const ranked = positions
    .filter((p) => p.valueEur > 0)
    .sort((a, b) => b.valueEur - a.valueEur || a.ticker.localeCompare(b.ticker));

  if (ranked.length <= groupThreshold) {
    return ranked.map((p) => toLeaf(p, saturationAt));
  }

  const head = ranked.slice(0, topN).map((p) => toLeaf(p, saturationAt));
  const tail = ranked.slice(topN);
  const tailValue = tail.reduce((s, p) => s + p.valueEur, 0);

  const other: TreemapNode = {
    name: OTHER_NAME,
    value: tailValue,
    returnPct: null,
    itemStyle: { color: OTHER_COLOR },
    children: tail.map((p) => toLeaf(p, saturationAt)),
  };

  return [...head, other];
}
