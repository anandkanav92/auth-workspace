/**
 * Allocation aggregation with ETF look-through (M11.2, spike 3).
 *
 * Pure functions (no React) so the look-through math is unit-testable with
 * fixtures.
 *
 * SECTOR look-through:
 *   - a `stock` contributes its FULL value to its single `sector`.
 *   - an `etf` DISTRIBUTES its value across `sectorWeightings` (sector → weight).
 *     Weights are normalised defensively (ETF feeds rarely sum to exactly 1).
 *   - anything with no usable sector (rare `other`, or an ETF with no
 *     weightings) goes to an explicit "Uncategorised" bucket (reviewer fix I9).
 *
 * COUNTRY: stocks contribute their value to `country`; ETFs lack clean geo data
 * from Yahoo, so they go to a "Multiple/Diversified" bucket (v1 limitation —
 * true geo look-through deferred to Phase 2). Missing → "Uncategorised".
 *
 * CURRENCY: each position contributes its full value to its price currency.
 */

import type { Position } from "./types";

export const UNCATEGORISED = "Uncategorised";
export const DIVERSIFIED = "Multiple/Diversified";

export type AllocationDimension =
  | "sector"
  | "country"
  | "currency"
  | "assetType"
  | "cap";

/**
 * Canonical, human-readable sector labels keyed by a normalised form
 * (lower-cased, separators stripped). Sector data arrives in TWO shapes that
 * must collapse onto ONE label, or the donut shows duplicate slices:
 *   - individual stocks → Yahoo `assetProfile.sector`, Title Case + spaces
 *     ("Financial Services")
 *   - ETF look-through  → Yahoo `topHoldings.sectorWeightings`, lower snake_case
 *     ("financial_services")
 */
const SECTOR_LABELS: Record<string, string> = {
  technology: "Technology",
  communicationservices: "Communication Services",
  financialservices: "Financial Services",
  consumercyclical: "Consumer Cyclical",
  consumerdefensive: "Consumer Defensive",
  basicmaterials: "Basic Materials",
  realestate: "Real Estate",
  utilities: "Utilities",
  industrials: "Industrials",
  energy: "Energy",
  healthcare: "Healthcare",
};

/** Title-case an unknown sector token ("some_sector" → "Some Sector"). */
function titleCase(raw: string): string {
  return raw
    .replace(/[_\s]+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Map any sector spelling (stock Title Case OR ETF snake_case) to ONE canonical
 * display label, so "technology" and "Technology" become a single slice.
 */
export function normalizeSector(raw: string): string {
  const key = raw.toLowerCase().replace(/[_\s]+/g, "");
  return SECTOR_LABELS[key] ?? titleCase(raw);
}

/** One slice of an allocation breakdown. */
export interface AllocationSlice {
  name: string;
  valueEur: number;
}

/** Sort slices by value desc; ties broken by name for stable output. */
function sortSlices(map: Map<string, number>): AllocationSlice[] {
  return [...map.entries()]
    .map(([name, valueEur]) => ({ name, valueEur }))
    .sort((a, b) => b.valueEur - a.valueEur || a.name.localeCompare(b.name));
}

function add(map: Map<string, number>, key: string, value: number): void {
  if (value <= 0) return;
  map.set(key, (map.get(key) ?? 0) + value);
}

/** Sector breakdown with ETF look-through. */
export function allocateBySector(positions: Position[]): AllocationSlice[] {
  const map = new Map<string, number>();
  for (const p of positions) {
    const weightings = p.sectorWeightings;
    if (p.assetType === "etf" && weightings && Object.keys(weightings).length) {
      const total = Object.values(weightings).reduce((s, w) => s + w, 0);
      if (total > 0) {
        for (const [sector, weight] of Object.entries(weightings)) {
          add(map, normalizeSector(sector), p.valueEur * (weight / total));
        }
        continue;
      }
    }
    if (p.sector) {
      add(map, normalizeSector(p.sector), p.valueEur);
    } else {
      add(map, UNCATEGORISED, p.valueEur);
    }
  }
  return sortSlices(map);
}

/** Country breakdown; ETFs → "Multiple/Diversified" (v1 limitation). */
export function allocateByCountry(positions: Position[]): AllocationSlice[] {
  const map = new Map<string, number>();
  for (const p of positions) {
    if (p.assetType === "etf") {
      add(map, DIVERSIFIED, p.valueEur);
    } else if (p.country) {
      add(map, p.country, p.valueEur);
    } else {
      add(map, UNCATEGORISED, p.valueEur);
    }
  }
  return sortSlices(map);
}

/** Currency breakdown by each position's price currency. */
export function allocateByCurrency(positions: Position[]): AllocationSlice[] {
  const map = new Map<string, number>();
  for (const p of positions) {
    add(map, p.priceCurrency || UNCATEGORISED, p.valueEur);
  }
  return sortSlices(map);
}

const ASSET_TYPE_LABELS: Record<string, string> = {
  stock: "Stocks",
  etf: "ETFs / Funds",
  other: "Other",
};

/** Asset-type breakdown: stocks vs ETFs/funds vs other. */
export function allocateByAssetType(positions: Position[]): AllocationSlice[] {
  const map = new Map<string, number>();
  for (const p of positions) {
    add(map, ASSET_TYPE_LABELS[p.assetType] ?? "Other", p.valueEur);
  }
  return sortSlices(map);
}

/** Market-cap bands (USD), the conventional large/mid/small breakpoints. */
const LARGE_CAP = 10e9;
const MID_CAP = 2e9;

/**
 * Size breakdown by market cap. ETFs/funds and positions without a market cap
 * (Yahoo returns none for funds) go to a single "Funds / N/A" band rather than
 * polluting the equity size bands.
 */
export function allocateByCap(positions: Position[]): AllocationSlice[] {
  const map = new Map<string, number>();
  for (const p of positions) {
    let band: string;
    if (p.assetType === "etf" || !p.marketCap || p.marketCap <= 0) {
      band = "Funds / N/A";
    } else if (p.marketCap >= LARGE_CAP) {
      band = "Large cap";
    } else if (p.marketCap >= MID_CAP) {
      band = "Mid cap";
    } else {
      band = "Small cap";
    }
    add(map, band, p.valueEur);
  }
  return sortSlices(map);
}

/** Dispatch to the right breakdown for the active tab. */
export function allocate(
  positions: Position[],
  dimension: AllocationDimension,
): AllocationSlice[] {
  switch (dimension) {
    case "sector":
      return allocateBySector(positions);
    case "country":
      return allocateByCountry(positions);
    case "currency":
      return allocateByCurrency(positions);
    case "assetType":
      return allocateByAssetType(positions);
    case "cap":
      return allocateByCap(positions);
  }
}
