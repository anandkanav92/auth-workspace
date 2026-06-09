import { describe, it, expect } from "vitest";

import { summarizeRecent } from "@/lib/activityMath";
import type { LedgerTransaction } from "@/lib/activity";

/**
 * M4.2 — pure recent-activity summary math.
 *
 * `summarizeRecent` counts buy/sell events and sums dividend CASH within a
 * trailing window. Critical schema convention (server schemas.ts): for dividend
 * rows `price` holds the TOTAL cash amount paid (NOT a per-share figure), so the
 * dividend total sums `price`, never `quantity × price`.
 */

// A fixed "now" so the window is deterministic regardless of the real clock.
const NOW = Date.UTC(2026, 5, 9, 12, 0, 0); // 2026-06-09

function daysAgo(n: number): string {
  return new Date(NOW - n * 24 * 60 * 60 * 1000).toISOString();
}

function tx(partial: Partial<LedgerTransaction>): LedgerTransaction {
  return {
    id: Math.random().toString(36).slice(2),
    account: "acc-1",
    type: "buy",
    ticker: "AAPL",
    quantity: 1,
    price: 100,
    currency: "EUR",
    occurred_at: daysAgo(1),
    source: "trading212",
    ...partial,
  };
}

describe("summarizeRecent", () => {
  it("counts buys and sells within the window", () => {
    const txns = [
      tx({ type: "buy" }),
      tx({ type: "buy" }),
      tx({ type: "sell" }),
    ];
    const summary = summarizeRecent(txns, 30, NOW);
    expect(summary.buys).toBe(2);
    expect(summary.sells).toBe(1);
  });

  it("sums dividend CASH from `price` (not quantity × price)", () => {
    const txns = [
      tx({ type: "dividend", quantity: 50, price: 12.5 }),
      tx({ type: "dividend", quantity: 999, price: 7.5 }),
    ];
    const summary = summarizeRecent(txns, 30, NOW);
    expect(summary.dividendCount).toBe(2);
    // 12.5 + 7.5 — quantity (50/999) must NOT multiply in.
    expect(summary.dividendTotal).toBe(20);
  });

  it("excludes events older than the window", () => {
    const txns = [
      tx({ type: "buy", occurred_at: daysAgo(5) }),
      tx({ type: "buy", occurred_at: daysAgo(45) }),
      tx({ type: "dividend", price: 10, occurred_at: daysAgo(45) }),
    ];
    const summary = summarizeRecent(txns, 30, NOW);
    expect(summary.buys).toBe(1);
    expect(summary.dividendCount).toBe(0);
    expect(summary.dividendTotal).toBe(0);
  });

  it("ignores non buy/sell/dividend types (e.g. adjustments)", () => {
    const txns = [
      tx({ type: "adjustment" }),
      tx({ type: "fee" }),
      tx({ type: "buy" }),
    ];
    const summary = summarizeRecent(txns, 30, NOW);
    expect(summary.buys).toBe(1);
    expect(summary.sells).toBe(0);
    expect(summary.dividendCount).toBe(0);
    expect(summary.dividendTotal).toBe(0);
  });

  it("treats a dividend with a null/absent price as zero cash", () => {
    const txns = [tx({ type: "dividend", price: undefined })];
    const summary = summarizeRecent(txns, 30, NOW);
    expect(summary.dividendCount).toBe(1);
    expect(summary.dividendTotal).toBe(0);
  });

  it("returns zeros for an empty ledger", () => {
    const summary = summarizeRecent([], 30, NOW);
    expect(summary).toEqual({
      buys: 0,
      sells: 0,
      dividendCount: 0,
      dividendTotal: 0,
    });
  });

  it("defaults the window to 30 days", () => {
    const txns = [
      tx({ type: "buy", occurred_at: daysAgo(29) }),
      tx({ type: "buy", occurred_at: daysAgo(31) }),
    ];
    // Pass `now` but rely on the default `days`.
    const summary = summarizeRecent(txns, undefined, NOW);
    expect(summary.buys).toBe(1);
  });
});
