import { describe, it, expect } from "vitest";

import {
  diversificationScores,
  effectiveN,
  hhi,
} from "@/tiles/diversificationMath";
import type { Position } from "@/tiles/types";

function equalPositions(count: number, valueEach = 100): Position[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `p${i}`,
    account: "acc",
    ticker: `T${i}`,
    name: `T${i}`,
    assetType: "stock" as const,
    quantity: 1,
    price: valueEach,
    priceCurrency: "EUR",
    valueEur: valueEach,
    hasCost: false,
    costEur: null,
    returnEur: null,
    returnPct: null,
    sector: `Sector${i}`,
    country: `Country${i}`,
    sectorWeightings: null,
  }));
}

describe("hhi / effectiveN primitives", () => {
  it("HHI of one position is 1; Effective N is 1", () => {
    expect(hhi([100])).toBeCloseTo(1, 6);
    expect(effectiveN([100])).toBeCloseTo(1, 6);
  });

  it("HHI of N equal positions is 1/N; Effective N is N", () => {
    expect(hhi([1, 1, 1, 1])).toBeCloseTo(0.25, 6);
    expect(effectiveN([1, 1, 1, 1])).toBeCloseTo(4, 6);
  });

  it("is 0 for an empty / zero-value set", () => {
    expect(hhi([])).toBe(0);
    expect(effectiveN([])).toBe(0);
    expect(effectiveN([0, 0])).toBe(0);
  });

  it("concentration pulls Effective N below the position count", () => {
    // One 90% position + nine 1.111% positions → far below 10.
    const values = [90, ...Array(9).fill(10 / 9)];
    expect(effectiveN(values)).toBeLessThan(2);
  });
});

describe("diversificationScores — canonical portfolios (Effective N headline)", () => {
  it("single position → Effective N 1", () => {
    const s = diversificationScores(equalPositions(1));
    expect(s.effectiveN).toBeCloseTo(1, 6);
    expect(s.positionCount).toBe(1);
  });

  it("2 equal positions → Effective N ~2", () => {
    const s = diversificationScores(equalPositions(2));
    expect(s.effectiveN).toBeCloseTo(2, 6);
  });

  it("5 equal positions → Effective N ~5", () => {
    const s = diversificationScores(equalPositions(5));
    expect(s.effectiveN).toBeCloseTo(5, 6);
  });

  it("50 equal positions → Effective N ~50", () => {
    const s = diversificationScores(equalPositions(50));
    expect(s.effectiveN).toBeCloseTo(50, 6);
  });

  it("reports sub-scores for distinct sectors/geos/currencies", () => {
    // 5 equal positions each in a distinct sector + country, all EUR.
    const s = diversificationScores(equalPositions(5));
    expect(s.sectorEffectiveN).toBeCloseTo(5, 6); // 5 distinct sectors, equal
    expect(s.geoEffectiveN).toBeCloseTo(5, 6); // 5 distinct countries, equal
    expect(s.currencyEffectiveN).toBeCloseTo(1, 6); // all EUR → one bucket
  });
});
