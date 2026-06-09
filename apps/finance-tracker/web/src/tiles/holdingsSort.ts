/**
 * M5.3 — pure sort + filter over the joined positions list.
 *
 * Kept React-free so the ordering / filtering rules are unit-tested independent
 * of the list component. The component owns the control state and the
 * value-share weight (which is just each position's `valueEur`, so a weight sort
 * is identical to a value sort over a fixed scope).
 *
 * NULL-COST ORDERING: positions without a cost basis (Revolut) have null
 * `returnEur` / `returnPct`. When sorting by P&L they always sink to the bottom
 * regardless of direction — an unknown gain isn't "the smallest", it's "not
 * comparable", so burying it is the least-surprising behaviour.
 */

import type { Position } from "./types";

/** What to order the holdings list by. */
export type SortKey = "value" | "pnlEur" | "pnlPct" | "name" | "weight";
export type SortDir = "asc" | "desc";

/** Filter selections; an absent field or the `"all"` sentinel means no filter. */
export interface HoldingsFilter {
  account?: string;
  assetType?: string;
  sector?: string;
}

/** Comparable numeric key for a position under `key`; null when not comparable. */
function numericKey(p: Position, key: SortKey): number | null {
  switch (key) {
    case "value":
    case "weight":
      // Weight is value-share within a fixed scope, so it orders identically to value.
      return p.valueEur;
    case "pnlEur":
      return p.hasCost ? p.returnEur : null;
    case "pnlPct":
      return p.hasCost ? p.returnPct : null;
    default:
      return null;
  }
}

/**
 * Return a new array of `positions` sorted by `key`/`dir`. Does not mutate the
 * input. Name sorts alphabetically (locale-aware, case-insensitive); numeric
 * keys sort by magnitude with null-cost positions pinned to the bottom.
 */
export function sortHoldings(
  positions: Position[],
  key: SortKey,
  dir: SortDir,
): Position[] {
  const factor = dir === "asc" ? 1 : -1;
  const sorted = [...positions];

  if (key === "name") {
    sorted.sort(
      (a, b) =>
        factor * a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
    );
    return sorted;
  }

  sorted.sort((a, b) => {
    const av = numericKey(a, key);
    const bv = numericKey(b, key);
    // Null (non-comparable) always sinks to the bottom, regardless of direction.
    if (av === null && bv === null) return 0;
    if (av === null) return 1;
    if (bv === null) return -1;
    return factor * (av - bv);
  });
  return sorted;
}

/** True when a filter value is unset or the catch-all `"all"` sentinel. */
function isAny(value: string | undefined): boolean {
  return !value || value === "all";
}

/**
 * Return the subset of `positions` matching every set filter (AND). A position
 * with no `sector` is excluded by any explicit sector filter.
 */
export function filterHoldings(
  positions: Position[],
  filter: HoldingsFilter,
): Position[] {
  return positions.filter((p) => {
    if (!isAny(filter.account) && p.account !== filter.account) return false;
    if (!isAny(filter.assetType) && p.assetType !== filter.assetType)
      return false;
    if (!isAny(filter.sector) && p.sector !== filter.sector) return false;
    return true;
  });
}
