import { describe, it, expect } from "vitest";

import { computeQuality } from "@/tiles/qualityMath";
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

describe("computeQuality — weighted harmonic P/E", () => {
  it("computes the value-weighted harmonic mean P/E", () => {
    // Equal value, PE 10 and 30 → harmonic mean = 2 / (1/10 + 1/30) = 15.
    const r = computeQuality([
      pos({ ticker: "A", valueEur: 1000, pe: 10 }),
      pos({ ticker: "B", valueEur: 1000, pe: 30 }),
    ]);
    expect(r.weightedPe).toBeCloseTo(15, 6);
    expect(r.peCount).toBe(2);
    expect(r.excludedCount).toBe(0);
  });

  it("value-weights the harmonic mean (heavier position dominates)", () => {
    // 3000 @ PE 10, 1000 @ PE 30 → 1/(0.75/10 + 0.25/30) = 1/(0.075+0.008333)=12.
    const r = computeQuality([
      pos({ ticker: "A", valueEur: 3000, pe: 10 }),
      pos({ ticker: "B", valueEur: 1000, pe: 30 }),
    ]);
    expect(r.weightedPe).toBeCloseTo(12, 6);
  });
});

describe("computeQuality — negative-P/E exclusion (I11)", () => {
  it("EXCLUDES loss-making (pe ≤ 0) positions from the harmonic mean", () => {
    // Two profitable (PE 10, 30) + one loss-maker (PE -5) worth 25% of book.
    const r = computeQuality([
      pos({ ticker: "A", valueEur: 1000, pe: 10 }),
      pos({ ticker: "B", valueEur: 1000, pe: 30 }),
      pos({ ticker: "LOSS", valueEur: 2000, pe: -5 }),
    ]);
    // P/E is the harmonic mean of ONLY A and B (equal value) = 15 — the loss-
    // maker neither poisons the reciprocal sum nor shifts the weights.
    expect(r.weightedPe).toBeCloseTo(15, 6);
    expect(r.peCount).toBe(2);
    expect(r.excludedCount).toBe(1);
    expect(r.excludedValueEur).toBeCloseTo(2000, 6);
    // 2000 of 4000 total = 50% of the portfolio.
    expect(r.excludedFraction).toBeCloseTo(0.5, 6);
  });

  it("treats pe === 0 as NO DATA (not loss-making) — ETFs/missing P/E coerce to 0", () => {
    const r = computeQuality([
      pos({ ticker: "A", valueEur: 1000, pe: 20 }),
      pos({ ticker: "ZERO", valueEur: 1000, pe: 0 }),
    ]);
    expect(r.weightedPe).toBeCloseTo(20, 6);
    // pe === 0 means "no P/E" (PocketBase null→0, or an ETF) — it must NOT be
    // counted as a loss-making exclusion.
    expect(r.excludedCount).toBe(0);
    expect(r.peCount).toBe(1);
  });

  it("returns a null P/E when every position is loss-making or missing", () => {
    const r = computeQuality([
      pos({ ticker: "L1", valueEur: 1000, pe: -1 }),
      pos({ ticker: "NODATA", valueEur: 1000, pe: undefined }),
    ]);
    expect(r.weightedPe).toBeNull();
    expect(r.excludedCount).toBe(1); // only the negative one counts as loss-making
  });
});

describe("computeQuality — weighted beta", () => {
  it("computes the value-weighted arithmetic mean beta over the beta subset", () => {
    // 3000 @ beta 1.2, 1000 @ beta 0.8 → (0.75*1.2 + 0.25*0.8) = 1.1.
    const r = computeQuality([
      pos({ ticker: "A", valueEur: 3000, beta: 1.2 }),
      pos({ ticker: "B", valueEur: 1000, beta: 0.8 }),
    ]);
    expect(r.weightedBeta).toBeCloseTo(1.1, 6);
  });

  it("skips positions with no beta data and normalises within the rest", () => {
    const r = computeQuality([
      pos({ ticker: "A", valueEur: 1000, beta: 1.0 }),
      pos({ ticker: "NODATA", valueEur: 3000, beta: undefined }),
    ]);
    // Only A has beta → weighted beta = 1.0 (not diluted by the missing one).
    expect(r.weightedBeta).toBeCloseTo(1.0, 6);
  });

  it("returns null beta when no position has beta data", () => {
    const r = computeQuality([pos({ ticker: "A", valueEur: 1000, pe: 10 })]);
    expect(r.weightedBeta).toBeNull();
  });
});
