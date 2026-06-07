/**
 * Portfolio health checks — rules-of-thumb concentration/risk flags drawn from
 * common diversification guidance (no single stock > ~10%, no sector > ~30%,
 * watch single-country/home bias). Each check is a simple ok/warn with a
 * human-readable detail; the tile renders them as a checklist.
 */

import {
  allocateBySector,
  allocateByCountry,
  DIVERSIFIED,
  UNCATEGORISED,
  type AllocationSlice,
} from "./allocationMath";
import type { Position } from "./types";

export type HealthStatus = "ok" | "warn";

export interface HealthCheck {
  id: string;
  label: string;
  status: HealthStatus;
  detail: string;
}

export interface HealthResult {
  checks: HealthCheck[];
  passing: number;
  total: number;
}

function pct(x: number): string {
  return `${(x * 100).toFixed(1)}%`;
}

/** Largest slice's share of `total`, ignoring catch-all buckets. */
function topShare(
  slices: AllocationSlice[],
  total: number,
  exclude: string[] = [],
): { name: string; share: number } {
  const real = slices.filter((s) => !exclude.includes(s.name));
  if (total <= 0 || real.length === 0) return { name: "", share: 0 };
  const top = real.reduce((a, b) => (b.valueEur > a.valueEur ? b : a));
  return { name: top.name, share: top.valueEur / total };
}

export function computeHealth(positions: Position[]): HealthResult {
  const total = positions.reduce((s, p) => s + p.valueEur, 0);
  const checks: HealthCheck[] = [];

  // 1. Single-position concentration — keep any one name under ~10%.
  if (positions.length > 0 && total > 0) {
    const top = positions.reduce((a, b) => (b.valueEur > a.valueEur ? b : a));
    const share = top.valueEur / total;
    checks.push({
      id: "position",
      label: "No single position over 10%",
      status: share > 0.1 ? "warn" : "ok",
      detail: `Largest is ${top.ticker} at ${pct(share)}.`,
    });
  }

  // 2. Sector concentration — keep any one sector under ~30%.
  const sector = topShare(allocateBySector(positions), total, [UNCATEGORISED]);
  checks.push({
    id: "sector",
    label: "No sector over 30%",
    status: sector.share > 0.3 ? "warn" : "ok",
    detail: sector.name
      ? `${sector.name} is ${pct(sector.share)}.`
      : "Not enough sector data yet.",
  });

  // 3. Geographic spread — flag a single country dominating (home/foreign bias).
  const country = topShare(allocateByCountry(positions), total, [
    DIVERSIFIED,
    UNCATEGORISED,
  ]);
  checks.push({
    id: "geo",
    label: "No country over 60%",
    status: country.share > 0.6 ? "warn" : "ok",
    detail: country.name
      ? `${country.name} is ${pct(country.share)} of single-country holdings.`
      : "Mostly diversified funds.",
  });

  // 4. Coverage — every position should have a live price.
  const unpriced = positions.filter((p) => !(p.price > 0)).length;
  checks.push({
    id: "priced",
    label: "All positions priced",
    status: unpriced > 0 ? "warn" : "ok",
    detail:
      unpriced > 0
        ? `${unpriced} position${unpriced === 1 ? "" : "s"} still loading a price.`
        : "Every position has a live price.",
  });

  return {
    checks,
    passing: checks.filter((c) => c.status === "ok").length,
    total: checks.length,
  };
}
