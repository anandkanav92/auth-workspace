import { describe, it, expect } from "vitest";

import { computeIncome } from "@/tiles/incomeMath";
import type { Position } from "@/tiles/types";

function pos(
  over: Partial<Position> & Pick<Position, "ticker" | "valueEur">,
): Position {
  return {
    id: over.ticker,
    account: "acc",
    name: over.ticker,
    assetType: "stock",
    quantity: 1,
    price: over.valueEur,
    priceCurrency: "EUR",
    hasCost: false,
    costEur: null,
    returnEur: null,
    returnPct: null,
    sectorWeightings: null,
    ...over,
  };
}

describe("computeIncome", () => {
  it("weights each yield by its share of the WHOLE portfolio", () => {
    // 6000 @ 4% + 4000 @ 1% over a 10 000 total.
    const positions = [
      pos({ ticker: "A", valueEur: 6000, dividendYield: 0.04 }),
      pos({ ticker: "B", valueEur: 4000, dividendYield: 0.01 }),
    ];
    const r = computeIncome(positions);
    // 0.6*0.04 + 0.4*0.01 = 0.024 + 0.004 = 0.028
    expect(r.weightedYield).toBeCloseTo(0.028, 6);
    expect(r.expectedAnnualEur).toBeCloseTo(280, 6); // 0.028 * 10000
    expect(r.coveredFraction).toBeCloseTo(1, 6);
    expect(r.contributingCount).toBe(2);
  });

  it("SKIPS positions with null yield (they drag the headline toward zero)", () => {
    // Only the 4000 position yields; the 6000 position has no data.
    const positions = [
      pos({ ticker: "NODATA", valueEur: 6000, dividendYield: undefined }),
      pos({ ticker: "PAY", valueEur: 4000, dividendYield: 0.05 }),
    ];
    const r = computeIncome(positions);
    // weight uses the WHOLE 10 000 total: 0.4 * 0.05 = 0.02
    expect(r.weightedYield).toBeCloseTo(0.02, 6);
    // Expected income only from the paying slice: 0.02 * 10000 = 200 = 4000*0.05.
    expect(r.expectedAnnualEur).toBeCloseTo(200, 6);
    expect(r.coveredValueEur).toBeCloseTo(4000, 6);
    expect(r.coveredFraction).toBeCloseTo(0.4, 6);
    expect(r.contributingCount).toBe(1);
  });

  it("returns zeros for an empty / zero-value portfolio", () => {
    expect(computeIncome([])).toMatchObject({
      weightedYield: 0,
      expectedAnnualEur: 0,
      coveredFraction: 0,
      contributingCount: 0,
    });
    const zero = computeIncome([pos({ ticker: "Z", valueEur: 0, dividendYield: 0.03 })]);
    expect(zero.weightedYield).toBe(0);
    expect(zero.expectedAnnualEur).toBe(0);
  });

  it("treats a 0% yield as covered data (not skipped)", () => {
    const r = computeIncome([
      pos({ ticker: "GROWTH", valueEur: 5000, dividendYield: 0 }),
      pos({ ticker: "PAY", valueEur: 5000, dividendYield: 0.04 }),
    ]);
    expect(r.contributingCount).toBe(2);
    expect(r.coveredFraction).toBeCloseTo(1, 6);
    expect(r.weightedYield).toBeCloseTo(0.02, 6); // 0.5*0 + 0.5*0.04
  });
});
