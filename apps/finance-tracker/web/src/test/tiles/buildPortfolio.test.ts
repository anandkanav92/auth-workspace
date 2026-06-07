import { describe, it, expect } from "vitest";

import { buildPortfolio, hasCostBasis } from "@/tiles/buildPortfolio";
import type { Holding, PortfolioInputs } from "@/tiles/types";

/**
 * M11.1 — portfolio join + null-cost handling (spike 2).
 *
 * The fixture mixes a cost-bearing T212 position (AAPL, priced in USD) with a
 * cost-null Revolut position (TSLA). PocketBase coerces a true `null` cost_basis
 * to 0 on read, so the Revolut holding below carries `cost_basis: 0` with an
 * EMPTY `cost_currency` — exactly the wire shape we must treat as "no cost".
 */

// EUR-base FX: 1 EUR = 1.10 USD (so 1 USD = 1/1.10 EUR ≈ 0.9091 EUR).
const fx = { rates: { EUR: 1, USD: 1.1 } };

const t212Aapl: Holding = {
  id: "h_aapl",
  account: "acc_t212",
  ticker: "AAPL",
  quantity: 10,
  // Total cost €1000-equivalent expressed in USD: 1100 USD.
  cost_basis: 1100,
  cost_currency: "USD",
  source: "trading212",
};

const revolutTsla: Holding = {
  id: "h_tsla",
  account: "acc_revolut",
  ticker: "TSLA",
  quantity: 5,
  // PocketBase reports a true-null cost as 0 + empty cost_currency.
  cost_basis: 0,
  cost_currency: "",
  source: "revolut",
};

const inputs: PortfolioInputs = {
  accounts: [
    { id: "acc_t212", source: "trading212", label: "T212 ISA" },
    { id: "acc_revolut", source: "revolut", label: "Revolut" },
  ],
  holdings: [t212Aapl, revolutTsla],
  prices: [
    { ticker: "AAPL", price: 220, currency: "USD" }, // 10×220 USD = 2200 USD = 2000 EUR
    { ticker: "TSLA", price: 250, currency: "USD" }, // 5×250 USD = 1250 USD ≈ 1136.36 EUR
  ],
  profiles: [
    { ticker: "AAPL", asset_type: "stock", name: "Apple", sector: "Technology" },
    {
      ticker: "TSLA",
      asset_type: "stock",
      name: "Tesla",
      sector: "Consumer Cyclical",
    },
  ],
  fx,
};

describe("hasCostBasis", () => {
  it("treats an empty cost_currency as 'no cost' even when cost_basis is 0", () => {
    expect(hasCostBasis(revolutTsla)).toBe(false);
  });

  it("treats a non-empty cost_currency as having cost", () => {
    expect(hasCostBasis(t212Aapl)).toBe(true);
  });
});

describe("buildPortfolio", () => {
  it("converts each position to EUR market value", () => {
    const p = buildPortfolio(inputs);
    const aapl = p.positions.find((x) => x.ticker === "AAPL")!;
    const tsla = p.positions.find((x) => x.ticker === "TSLA")!;
    expect(aapl.valueEur).toBeCloseTo(2000, 6); // 2200 USD / 1.10
    expect(tsla.valueEur).toBeCloseTo(1250 / 1.1, 6);
    expect(p.totalValueEur).toBeCloseTo(2000 + 1250 / 1.1, 6);
  });

  it("aggregates return over the cost-bearing subset ONLY", () => {
    const p = buildPortfolio(inputs);
    // Cost = 1100 USD / 1.10 = 1000 EUR (AAPL only).
    expect(p.totalCostEur).toBeCloseTo(1000, 6);
    // Return = 2000 EUR value − 1000 EUR cost = +1000 EUR (Revolut excluded).
    expect(p.totalReturnEur).toBeCloseTo(1000, 6);
    expect(p.totalReturnPct).toBeCloseTo(1.0, 6);
  });

  it("counts the cost-less positions (drives the Summary footnote)", () => {
    const p = buildPortfolio(inputs);
    expect(p.costlessCount).toBe(1);
  });

  it("leaves per-position return null when cost is absent", () => {
    const p = buildPortfolio(inputs);
    const tsla = p.positions.find((x) => x.ticker === "TSLA")!;
    expect(tsla.hasCost).toBe(false);
    expect(tsla.costEur).toBeNull();
    expect(tsla.returnEur).toBeNull();
    expect(tsla.returnPct).toBeNull();
  });

  it("scopes positions + accounts to the requested account ids", () => {
    const p = buildPortfolio(inputs, ["acc_t212"]);
    expect(p.positions).toHaveLength(1);
    expect(p.positions[0].ticker).toBe("AAPL");
    expect(p.accounts).toHaveLength(1);
    expect(p.costlessCount).toBe(0);
  });
});

describe("buildPortfolio with an empty/absent FX cache", () => {
  // The shape `usePortfolioData` falls back to when `/api/fx` returns null
  // (before the first FX cron run, or during an FX outage). Building must NOT
  // blow up or return nothing — it must degrade to rate 1.
  const emptyFx = { rates: {} };

  const eurHolding: Holding = {
    id: "h_eur",
    account: "acc_t212",
    ticker: "IWDA",
    quantity: 2,
    cost_basis: 150,
    cost_currency: "EUR",
    source: "trading212",
  };

  const emptyFxInputs: PortfolioInputs = {
    accounts: [{ id: "acc_t212", source: "trading212", label: "T212 ISA" }],
    holdings: [eurHolding, t212Aapl],
    prices: [
      { ticker: "IWDA", price: 100, currency: "EUR" }, // 2 × 100 EUR = 200 EUR
      { ticker: "AAPL", price: 220, currency: "USD" }, // 10 × 220 USD, no USD rate
    ],
    profiles: [
      { ticker: "IWDA", asset_type: "etf", name: "iShares Core MSCI World" },
      { ticker: "AAPL", asset_type: "stock", name: "Apple" },
    ],
    fx: emptyFx,
  };

  it("still produces a portfolio instead of undefined", () => {
    const p = buildPortfolio(emptyFxInputs);
    expect(p).toBeDefined();
    expect(p.positions).toHaveLength(2);
  });

  it("values EUR positions correctly (rate 1)", () => {
    const p = buildPortfolio(emptyFxInputs);
    const iwda = p.positions.find((x) => x.ticker === "IWDA")!;
    expect(iwda.valueEur).toBeCloseTo(200, 6);
    // EUR cost basis is unaffected by the missing FX cache.
    expect(iwda.costEur).toBeCloseTo(150, 6);
  });

  it("degrades unknown currencies to rate 1 rather than blanking", () => {
    const p = buildPortfolio(emptyFxInputs);
    const aapl = p.positions.find((x) => x.ticker === "AAPL")!;
    // No USD rate in the empty cache → treated as 1:1 (10 × 220 = 2200).
    expect(aapl.valueEur).toBeCloseTo(2200, 6);
    // cost_basis 1100 USD also falls back to rate 1.
    expect(aapl.costEur).toBeCloseTo(1100, 6);
    expect(aapl.returnEur).toBeCloseTo(1100, 6);
  });
});
