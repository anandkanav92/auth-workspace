import { describe, it, expect } from "vitest";

import { computeMovers } from "@/tiles/moversMath";
import type { Position } from "@/tiles/types";

function pos(
  over: Partial<Position> & Pick<Position, "ticker">,
): Position {
  return {
    id: over.ticker,
    account: "acc",
    name: over.ticker,
    assetType: "stock",
    quantity: 1,
    price: 1,
    priceCurrency: "EUR",
    valueEur: 100,
    hasCost: true,
    costEur: 100,
    returnEur: 0,
    returnPct: 0,
    sectorWeightings: null,
    ...over,
  };
}

describe("computeMovers", () => {
  it("ranks gainers high-to-low and losers most-negative-first", () => {
    const r = computeMovers([
      pos({ ticker: "WIN1", returnPct: 1.07, returnEur: 107 }),
      pos({ ticker: "WIN2", returnPct: 0.2, returnEur: 20 }),
      pos({ ticker: "LOSE1", returnPct: -0.5, returnEur: -50 }),
      pos({ ticker: "LOSE2", returnPct: -0.1, returnEur: -10 }),
      pos({ ticker: "FLAT", returnPct: 0, returnEur: 0 }),
    ]);
    expect(r.gainers.map((e) => e.ticker)).toEqual(["WIN1", "WIN2"]);
    expect(r.losers.map((e) => e.ticker)).toEqual(["LOSE1", "LOSE2"]);
    expect(r.consideredCount).toBe(5);
  });

  it("excludes cost-less positions (no return available)", () => {
    const r = computeMovers([
      pos({ ticker: "T212", returnPct: 0.3, returnEur: 30 }),
      // Revolut-style: no cost basis → not eligible.
      pos({ ticker: "REV", hasCost: false, costEur: null, returnPct: null, returnEur: null }),
    ]);
    expect(r.consideredCount).toBe(1);
    expect(r.gainers.map((e) => e.ticker)).toEqual(["T212"]);
  });

  it("caps each side at n", () => {
    const many = Array.from({ length: 8 }, (_, i) =>
      pos({ ticker: `G${i}`, returnPct: (i + 1) / 10, returnEur: i }),
    );
    const r = computeMovers(many, 3);
    expect(r.gainers).toHaveLength(3);
    expect(r.gainers[0].ticker).toBe("G7"); // highest return first
  });
});
