import { describe, it, expect } from "vitest";

import { topConcentration } from "@/tiles/concentrationMath";
import type { Position } from "@/tiles/types";

function pos(ticker: string, valueEur: number): Position {
  return {
    id: ticker,
    account: "acc",
    ticker,
    name: ticker,
    assetType: "stock",
    quantity: 1,
    price: valueEur,
    priceCurrency: "EUR",
    valueEur,
    hasCost: false,
    costEur: null,
    returnEur: null,
    returnPct: null,
    sectorWeightings: null,
  };
}

describe("topConcentration", () => {
  it("ranks the top 5 by value and reports each share of the whole", () => {
    const positions = [
      pos("A", 500),
      pos("B", 200),
      pos("C", 100),
      pos("D", 100),
      pos("E", 50),
      pos("F", 30),
      pos("G", 20),
    ];
    const r = topConcentration(positions, 5);
    expect(r.top.map((e) => e.ticker)).toEqual(["A", "B", "C", "D", "E"]);
    expect(r.totalValueEur).toBe(1000);
    expect(r.top[0].share).toBeCloseTo(0.5, 6); // A = 500/1000
    // Top 5 = (500+200+100+100+50)/1000 = 0.95.
    expect(r.topShare).toBeCloseTo(0.95, 6);
    expect(r.positionCount).toBe(7);
  });

  it("handles fewer than N positions (topShare can reach 100%)", () => {
    const r = topConcentration([pos("A", 60), pos("B", 40)], 5);
    expect(r.top).toHaveLength(2);
    expect(r.topShare).toBeCloseTo(1.0, 6);
  });

  it("returns zero shares for an empty / zero-value portfolio", () => {
    expect(topConcentration([], 5).topShare).toBe(0);
    const r = topConcentration([pos("A", 0)], 5);
    expect(r.top[0].share).toBe(0);
  });
});
