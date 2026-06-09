import { describe, it, expect } from "vitest";

import { computePositionDetail } from "@/tiles/positionDetailMath";
import type { LedgerTransaction } from "@/lib/activity";
import type { FxRates, Position } from "@/tiles/types";

/**
 * M5.1 — per-position detail math (trades, average-cost realised P&L,
 * dividends, holding period).
 *
 * Realised P&L uses the AVERAGE-COST method: a running average cost per share is
 * maintained from buys; each sell realises (sellPrice − avgCostAtThatPoint) ×
 * sellQty. Sells do NOT change the running average cost (only buys do). Prices
 * are converted to EUR via the same fxToEur rule the portfolio join uses.
 */

// 1 EUR = 1.10 USD; 1 EUR = 0.80 GBP (so 1 GBP = 1.25 EUR, 1 GBX = 0.0125 EUR).
const fx: FxRates = { rates: { EUR: 1, USD: 1.1, GBP: 0.8 } };

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

const basePosition: Position = {
  id: "h-aapl",
  account: "acc-1",
  ticker: "AAPL",
  name: "Apple",
  assetType: "stock",
  quantity: 5,
  price: 200,
  priceCurrency: "EUR",
  valueEur: 1000,
  hasCost: true,
  costEur: 800,
  returnEur: 200,
  returnPct: 0.25,
};

describe("computePositionDetail", () => {
  it("computes average-cost realised P&L over a buy/buy/sell sequence", () => {
    // Buy 10 @ 100, buy 10 @ 200 → avg cost 150 over 20 shares.
    // Sell 5 @ 250 → realised = (250 − 150) × 5 = 500 EUR.
    const ledger: LedgerTransaction[] = [
      tx({ type: "buy", quantity: 10, price: 100, occurred_at: "2026-01-01T00:00:00Z" }),
      tx({ type: "buy", quantity: 10, price: 200, occurred_at: "2026-02-01T00:00:00Z" }),
      tx({ type: "sell", quantity: 5, price: 250, occurred_at: "2026-03-01T00:00:00Z" }),
    ];

    const detail = computePositionDetail({ position: basePosition, ledger, fx });

    expect(detail.realisedEur).toBeCloseTo(500);
    expect(detail.trades).toHaveLength(3);
    // Oldest → newest.
    expect(detail.trades.map((t) => t.date)).toEqual([
      "2026-01-01T00:00:00Z",
      "2026-02-01T00:00:00Z",
      "2026-03-01T00:00:00Z",
    ]);
    expect(detail.trades[0]).toMatchObject({
      side: "buy",
      quantity: 10,
      price: 100,
      currency: "EUR",
    });
    expect(detail.holdingSince).toBe("2026-01-01T00:00:00Z");
  });

  it("converts GBX trade prices to EUR (÷100 of GBP)", () => {
    // Buy 100 @ 1000 GBX (= £10 = €12.50), sell 100 @ 2000 GBX (= £20 = €25).
    // Realised = (25 − 12.50) × 100 = 1250 EUR.
    const ledger: LedgerTransaction[] = [
      tx({ type: "buy", quantity: 100, price: 1000, currency: "GBX" }),
      tx({
        type: "sell",
        quantity: 100,
        price: 2000,
        currency: "GBX",
        occurred_at: "2026-04-01T00:00:00Z",
      }),
    ];

    const detail = computePositionDetail({ position: basePosition, ledger, fx });

    expect(detail.realisedEur).toBeCloseTo(1250);
  });

  it("sums dividend cash converted to EUR (price is total cash, not per-share)", () => {
    // 11 USD dividend = 10 EUR; 8 GBP dividend = 10 EUR. Total 20 EUR.
    const ledger: LedgerTransaction[] = [
      tx({ type: "dividend", quantity: 0, price: 11, currency: "USD" }),
      tx({ type: "dividend", quantity: 0, price: 8, currency: "GBP" }),
    ];

    const detail = computePositionDetail({ position: basePosition, ledger, fx });

    expect(detail.dividendsEur).toBeCloseTo(20);
    // Dividends are not trades.
    expect(detail.trades).toHaveLength(0);
    expect(detail.holdingSince).toBeNull();
  });

  it("is safe on an empty ledger (no sells → realised 0, no buys → null since)", () => {
    const detail = computePositionDetail({ position: basePosition, ledger: [], fx });

    expect(detail.realisedEur).toBe(0);
    expect(detail.dividendsEur).toBe(0);
    expect(detail.trades).toEqual([]);
    expect(detail.holdingSince).toBeNull();
    // Unrealised carried straight from the position.
    expect(detail.unrealisedEur).toBe(200);
    expect(detail.unrealisedPct).toBe(0.25);
  });

  it("carries unrealised P&L straight from the position", () => {
    const detail = computePositionDetail({ position: basePosition, ledger: [], fx });
    expect(detail.unrealisedEur).toBe(basePosition.returnEur);
    expect(detail.unrealisedPct).toBe(basePosition.returnPct);
    expect(detail.hasCost).toBe(true);
  });
});
