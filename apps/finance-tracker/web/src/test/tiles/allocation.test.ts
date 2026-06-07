import { describe, it, expect } from "vitest";

import {
  allocateBySector,
  allocateByCountry,
  allocateByCurrency,
  DIVERSIFIED,
  UNCATEGORISED,
} from "@/tiles/allocationMath";
import type { Position } from "@/tiles/types";

/**
 * M11.2 — ETF sector look-through (spike 3).
 *
 * Fixture: 2 stocks (AAPL tech, JPM financials) + 1 ETF (VWRL) whose value must
 * SPREAD across its sectorWeightings rather than land in a single bucket.
 */

function pos(over: Partial<Position> & Pick<Position, "ticker" | "valueEur">): Position {
  return {
    id: over.ticker,
    account: "acc",
    name: over.ticker,
    assetType: "stock",
    quantity: 1,
    price: over.valueEur,
    priceCurrency: "EUR",
    hasCost: true,
    costEur: 0,
    returnEur: 0,
    returnPct: 0,
    sectorWeightings: null,
    ...over,
  };
}

const aapl = pos({
  ticker: "AAPL",
  valueEur: 1000,
  assetType: "stock",
  sector: "Technology",
  country: "United States",
});
const jpm = pos({
  ticker: "JPM",
  valueEur: 500,
  assetType: "stock",
  sector: "Financial Services",
  country: "United States",
});
const vwrl = pos({
  ticker: "VWRL",
  valueEur: 1000,
  assetType: "etf",
  // ETF returns no clean sector/country; only sectorWeightings.
  sectorWeightings: { Technology: 0.5, "Financial Services": 0.3, Healthcare: 0.2 },
});

const positions = [aapl, jpm, vwrl];

describe("allocateBySector (ETF look-through)", () => {
  it("spreads the ETF's value across its sector weightings", () => {
    const slices = allocateBySector(positions);
    const byName = new Map(slices.map((s) => [s.name, s.valueEur]));

    // Technology = AAPL 1000 + 50% of VWRL 1000 = 1500.
    expect(byName.get("Technology")).toBeCloseTo(1500, 6);
    // Financial Services = JPM 500 + 30% of VWRL 1000 = 800.
    expect(byName.get("Financial Services")).toBeCloseTo(800, 6);
    // Healthcare = 20% of VWRL 1000 = 200 (entirely from the ETF).
    expect(byName.get("Healthcare")).toBeCloseTo(200, 6);
  });

  it("conserves total value across the spread", () => {
    const slices = allocateBySector(positions);
    const total = slices.reduce((s, x) => s + x.valueEur, 0);
    expect(total).toBeCloseTo(2500, 6); // 1000 + 500 + 1000
  });

  it("normalises weightings that don't sum to 1", () => {
    const etf = pos({
      ticker: "X",
      valueEur: 100,
      assetType: "etf",
      sectorWeightings: { Technology: 0.4, Energy: 0.4 }, // sums to 0.8
    });
    const slices = allocateBySector([etf]);
    const byName = new Map(slices.map((s) => [s.name, s.valueEur]));
    expect(byName.get("Technology")).toBeCloseTo(50, 6);
    expect(byName.get("Energy")).toBeCloseTo(50, 6);
  });

  it("buckets a sector-less position as Uncategorised", () => {
    const orphan = pos({ ticker: "?", valueEur: 300, assetType: "other" });
    const slices = allocateBySector([orphan]);
    expect(slices).toEqual([{ name: UNCATEGORISED, valueEur: 300 }]);
  });
});

describe("allocateByCountry", () => {
  it("routes ETFs to Multiple/Diversified and stocks to their country", () => {
    const slices = allocateByCountry(positions);
    const byName = new Map(slices.map((s) => [s.name, s.valueEur]));
    expect(byName.get("United States")).toBeCloseTo(1500, 6); // AAPL + JPM
    expect(byName.get(DIVERSIFIED)).toBeCloseTo(1000, 6); // VWRL
  });
});

describe("allocateByCurrency", () => {
  it("groups by each position's price currency", () => {
    const usd = pos({ ticker: "MSFT", valueEur: 200, priceCurrency: "USD" });
    const slices = allocateByCurrency([aapl, usd]);
    const byName = new Map(slices.map((s) => [s.name, s.valueEur]));
    expect(byName.get("EUR")).toBeCloseTo(1000, 6);
    expect(byName.get("USD")).toBeCloseTo(200, 6);
  });
});
