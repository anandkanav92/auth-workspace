import { describe, it, expect } from "vitest";

import { computePortfolioReturns } from "@/tiles/returnsMath";
import type { LedgerTransaction } from "@/lib/activity";
import type { FxRates, Position } from "@/tiles/types";

/**
 * M6 — portfolio-level realised P&L + actual trailing-12m dividend income.
 *
 * `unrealisedEur`/`Pct` mirror buildPortfolio's cost-bearing totals; `realisedEur`
 * groups the ledger by ticker and runs the shared average-cost realised loop per
 * ticker; `dividendsEur12m` sums dividend cash (in EUR) within a trailing 365-day
 * window. `now` is injected so the window is deterministic.
 */

// 1 EUR = 1.10 USD; 1 EUR = 0.80 GBP (so 1 GBP = 1.25 EUR, 1 GBX = 0.0125 EUR).
const fx: FxRates = { rates: { EUR: 1, USD: 1.1, GBP: 0.8 } };

const NOW = new Date("2026-06-09T00:00:00Z").getTime();

function tx(partial: Partial<LedgerTransaction>): LedgerTransaction {
  return {
    id: Math.random().toString(36).slice(2),
    account: "acc-1",
    type: "buy",
    ticker: "AAPL",
    quantity: 1,
    currency: "EUR",
    occurred_at: "2026-01-01T00:00:00Z",
    source: "trading212",
    ...partial,
  };
}

function pos(over: Partial<Position> & Pick<Position, "ticker">): Position {
  return {
    id: over.ticker,
    account: "acc-1",
    name: over.ticker,
    assetType: "stock",
    quantity: 1,
    price: 0,
    priceCurrency: "EUR",
    valueEur: 0,
    hasCost: false,
    costEur: null,
    returnEur: null,
    returnPct: null,
    sectorWeightings: null,
    ...over,
  };
}

describe("computePortfolioReturns", () => {
  it("sums unrealised over cost-bearing positions and derives the pct", () => {
    const positions = [
      pos({ ticker: "A", valueEur: 1200, hasCost: true, costEur: 1000, returnEur: 200 }),
      pos({ ticker: "B", valueEur: 900, hasCost: true, costEur: 1000, returnEur: -100 }),
      // Cost-less position: excluded from both numerator and denominator.
      pos({ ticker: "C", valueEur: 5000, hasCost: false }),
    ];
    const r = computePortfolioReturns(positions, [], fx, NOW);
    expect(r.unrealisedEur).toBeCloseTo(100); // 200 - 100
    expect(r.unrealisedPct).toBeCloseTo(100 / 2000); // over cost 2000
  });

  it("unrealisedPct is null when there is no cost basis", () => {
    const r = computePortfolioReturns(
      [pos({ ticker: "C", valueEur: 5000, hasCost: false })],
      [],
      fx,
      NOW,
    );
    expect(r.unrealisedEur).toBe(0);
    expect(r.unrealisedPct).toBeNull();
  });

  it("groups ledger by ticker and sums realised across multiple currencies + GBX", () => {
    const ledger: LedgerTransaction[] = [
      // AAPL (USD): buy 10 @ 110 USD (=100 EUR), sell 5 @ 132 USD (=120 EUR).
      // realised = (120 - 100) * 5 = 100 EUR.
      tx({ ticker: "AAPL", type: "buy", quantity: 10, price: 110, currency: "USD", occurred_at: "2025-01-01T00:00:00Z" }),
      tx({ ticker: "AAPL", type: "sell", quantity: 5, price: 132, currency: "USD", occurred_at: "2025-06-01T00:00:00Z" }),
      // LLOY (GBX): buy 100 @ 1000 GBX (=12.50 EUR), sell 100 @ 2000 GBX (=25 EUR).
      // realised = (25 - 12.50) * 100 = 1250 EUR.
      tx({ ticker: "LLOY", type: "buy", quantity: 100, price: 1000, currency: "GBX", occurred_at: "2025-02-01T00:00:00Z" }),
      tx({ ticker: "LLOY", type: "sell", quantity: 100, price: 2000, currency: "GBX", occurred_at: "2025-07-01T00:00:00Z" }),
    ];
    const r = computePortfolioReturns([], ledger, fx, NOW);
    expect(r.realisedEur).toBeCloseTo(1350); // 100 + 1250
  });

  it("realised is computed PER ticker (no cross-ticker cost bleed) incl. an oversell", () => {
    const ledger: LedgerTransaction[] = [
      // X: oversell with no prior buy → avgCost 0, full proceeds as gain.
      tx({ ticker: "X", type: "sell", quantity: 4, price: 250, currency: "EUR", occurred_at: "2025-03-01T00:00:00Z" }),
      // Y: buy 10 @ 100, sell 5 @ 150 → realised (150-100)*5 = 250 EUR.
      tx({ ticker: "Y", type: "buy", quantity: 10, price: 100, currency: "EUR", occurred_at: "2025-01-01T00:00:00Z" }),
      tx({ ticker: "Y", type: "sell", quantity: 5, price: 150, currency: "EUR", occurred_at: "2025-04-01T00:00:00Z" }),
    ];
    const r = computePortfolioReturns([], ledger, fx, NOW);
    // X: 250*4 = 1000 (avgCost 0). Y: 250. If buys bled across tickers, X would
    // wrongly net against Y's cost — this asserts they're kept separate.
    expect(r.realisedEur).toBeCloseTo(1250);
  });

  it("sums only dividends within the trailing 365 days, converted to EUR", () => {
    const ledger: LedgerTransaction[] = [
      // In window: 11 USD (=10 EUR) + 8 GBP (=10 EUR) = 20 EUR.
      tx({ ticker: "A", type: "dividend", quantity: 0, price: 11, currency: "USD", occurred_at: "2026-01-15T00:00:00Z" }),
      tx({ ticker: "B", type: "dividend", quantity: 0, price: 8, currency: "GBP", occurred_at: "2025-12-01T00:00:00Z" }),
      // Just outside the window (>365 days ago): excluded.
      tx({ ticker: "A", type: "dividend", quantity: 0, price: 100, currency: "EUR", occurred_at: "2024-01-01T00:00:00Z" }),
    ];
    const r = computePortfolioReturns([], ledger, fx, NOW);
    expect(r.dividendsEur12m).toBeCloseTo(20);
  });

  it("is safe on an empty portfolio + ledger", () => {
    const r = computePortfolioReturns([], [], fx, NOW);
    expect(r).toMatchObject({
      unrealisedEur: 0,
      unrealisedPct: null,
      realisedEur: 0,
      dividendsEur12m: 0,
    });
  });
});
