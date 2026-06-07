import { describe, it, expect } from "vitest";

import { buildSellUndoBody, decrementHolding } from "@/lib/holdings";
import type { Holding } from "@/tiles/types";

/**
 * M14.4 — pure helpers behind the optimistic decrement + the exact sell-undo.
 *
 * These mirror the server's `applySell` / `mergeBuy` math (costBasis.ts): a sell
 * removes cost basis proportionally, and the compensating re-add restores the
 * pre-sell totals exactly. Verified here in isolation so the component tests can
 * focus on wiring.
 */

const T212: Holding = {
  id: "h-1",
  account: "acc-1",
  ticker: "AAPL",
  quantity: 10,
  cost_basis: 1500,
  cost_currency: "EUR",
  source: "trading212",
};

const REVOLUT: Holding = {
  id: "h-2",
  account: "acc-2",
  ticker: "TSLA",
  quantity: 4,
  // Revolut: no cost. PocketBase may read cost_basis as 0; the marker is the
  // empty cost_currency.
  cost_basis: 0,
  cost_currency: "",
  source: "revolut",
};

describe("decrementHolding", () => {
  it("reduces quantity and scales cost basis proportionally", () => {
    const next = decrementHolding([T212], "h-1", 4);
    expect(next[0].quantity).toBe(6);
    // 1500 * (6/10) = 900
    expect(next[0].cost_basis).toBeCloseTo(900);
  });

  it("zeroes cost when the whole position is sold", () => {
    const next = decrementHolding([T212], "h-1", 10);
    expect(next[0].quantity).toBe(0);
    expect(next[0].cost_basis).toBe(0);
  });

  it("leaves a null-cost (Revolut) position's cost untouched", () => {
    const next = decrementHolding([REVOLUT], "h-2", 1);
    expect(next[0].quantity).toBe(3);
    expect(next[0].cost_basis).toBe(0); // unchanged marker
    expect(next[0].cost_currency).toBe("");
  });

  it("does not mutate the input array or other rows", () => {
    const input = [T212, REVOLUT];
    const next = decrementHolding(input, "h-1", 2);
    expect(input[0].quantity).toBe(10); // original untouched
    expect(next[1]).toBe(REVOLUT); // other row referentially stable
  });
});

describe("buildSellUndoBody", () => {
  it("re-adds the sold quantity + the sold cost portion (exact restore)", () => {
    // Sell 4 of 10; server keeps 6 @ 900. The sold cost portion is 600, so
    // re-adding 4 @ 600 makes mergeBuy sum back to 10 @ 1500.
    const body = buildSellUndoBody(T212, 4);
    expect(body).toEqual({
      account: "acc-1",
      ticker: "AAPL",
      quantity: 4,
      cost_basis: 600,
      cost_currency: "EUR",
    });
  });

  it("omits cost for a null-cost (Revolut) position", () => {
    const body = buildSellUndoBody(REVOLUT, 1);
    expect(body).toEqual({
      account: "acc-2",
      ticker: "TSLA",
      quantity: 1,
    });
    expect(body.cost_basis).toBeUndefined();
    expect(body.cost_currency).toBeUndefined();
  });
});
