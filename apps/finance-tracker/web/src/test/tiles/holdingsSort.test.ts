import { describe, it, expect } from "vitest";

import {
  filterHoldings,
  sortHoldings,
  type HoldingsFilter,
} from "@/tiles/holdingsSort";
import type { Position } from "@/tiles/types";

/**
 * M5.3 — pure sort + filter over the joined positions list.
 */

function pos(partial: Partial<Position> & { id: string }): Position {
  return {
    account: "acc-1",
    ticker: partial.id.toUpperCase(),
    name: partial.id,
    assetType: "stock",
    quantity: 1,
    price: 0,
    priceCurrency: "EUR",
    valueEur: 0,
    hasCost: true,
    costEur: 0,
    returnEur: 0,
    returnPct: 0,
    ...partial,
  };
}

const aapl = pos({
  id: "aapl",
  name: "Apple",
  valueEur: 1000,
  returnEur: 200,
  returnPct: 0.25,
  account: "acc-t212",
  assetType: "stock",
  sector: "Technology",
});
const vwrl = pos({
  id: "vwrl",
  name: "Vanguard All-World",
  valueEur: 3000,
  returnEur: 100,
  returnPct: 0.034,
  account: "acc-t212",
  assetType: "etf",
  sector: undefined,
});
const tsla = pos({
  id: "tsla",
  name: "Tesla",
  valueEur: 500,
  hasCost: false,
  returnEur: null,
  returnPct: null,
  account: "acc-revolut",
  assetType: "stock",
  sector: "Consumer Cyclical",
});

const all = [aapl, vwrl, tsla];

describe("sortHoldings", () => {
  it("sorts by value descending (default direction)", () => {
    const out = sortHoldings(all, "value", "desc");
    expect(out.map((p) => p.id)).toEqual(["vwrl", "aapl", "tsla"]);
  });

  it("sorts by value ascending", () => {
    const out = sortHoldings(all, "value", "asc");
    expect(out.map((p) => p.id)).toEqual(["tsla", "aapl", "vwrl"]);
  });

  it("sorts by unrealised P&L € descending; null cost sorts last", () => {
    const out = sortHoldings(all, "pnlEur", "desc");
    // aapl +200, vwrl +100, tsla null → last.
    expect(out.map((p) => p.id)).toEqual(["aapl", "vwrl", "tsla"]);
  });

  it("sorts by unrealised P&L % descending; null cost sorts last", () => {
    const out = sortHoldings(all, "pnlPct", "desc");
    // aapl 25%, vwrl 3.4%, tsla null → last.
    expect(out.map((p) => p.id)).toEqual(["aapl", "vwrl", "tsla"]);
  });

  it("sorts by name ascending (case-insensitive, locale-aware)", () => {
    const out = sortHoldings(all, "name", "asc");
    expect(out.map((p) => p.name)).toEqual([
      "Apple",
      "Tesla",
      "Vanguard All-World",
    ]);
  });

  it("sorts by weight (value share) descending — same order as value", () => {
    const out = sortHoldings(all, "weight", "desc");
    expect(out.map((p) => p.id)).toEqual(["vwrl", "aapl", "tsla"]);
  });

  it("does not mutate the input array", () => {
    const before = all.map((p) => p.id);
    sortHoldings(all, "value", "asc");
    expect(all.map((p) => p.id)).toEqual(before);
  });
});

describe("filterHoldings", () => {
  it("returns everything when no filters are set", () => {
    expect(filterHoldings(all, {})).toHaveLength(3);
  });

  it("filters by account", () => {
    const out = filterHoldings(all, { account: "acc-revolut" });
    expect(out.map((p) => p.id)).toEqual(["tsla"]);
  });

  it("filters by asset type", () => {
    const out = filterHoldings(all, { assetType: "etf" });
    expect(out.map((p) => p.id)).toEqual(["vwrl"]);
  });

  it("filters by sector (positions with no sector are excluded)", () => {
    const out = filterHoldings(all, { sector: "Technology" });
    expect(out.map((p) => p.id)).toEqual(["aapl"]);
  });

  it("combines filters (AND)", () => {
    const filter: HoldingsFilter = {
      account: "acc-t212",
      assetType: "stock",
    };
    expect(filterHoldings(all, filter).map((p) => p.id)).toEqual(["aapl"]);
  });

  it("'all' sentinel values are treated as no filter", () => {
    const out = filterHoldings(all, {
      account: "all",
      assetType: "all",
      sector: "all",
    });
    expect(out).toHaveLength(3);
  });
});
