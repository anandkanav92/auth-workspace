/**
 * M5.1 — pure per-position detail math.
 *
 * Given a single position (already EUR-joined by {@link buildPortfolio}), that
 * ticker's transaction ledger, and the FX rates, derive the figures the position
 * sheet shows beyond the live unrealised P&L: an ordered trade history, realised
 * P&L (average-cost), dividends received, and the holding-since date.
 *
 * Kept React-free so the money math is unit-tested with plain fixtures.
 *
 * KEY DECISIONS
 * - **Realised P&L = average-cost.** A running average cost per share is built
 *   from buys; each sell realises `(sellPrice − avgCostAtThatPoint) × sellQty`.
 *   Sells do NOT move the running average (only buys re-weight it) — this is the
 *   standard moving-average / weighted-average cost basis, and it matches how the
 *   broker reports realised gains for fractional, repeatedly-traded positions.
 * - **FX:** trade prices and dividend cash are converted to EUR with the SAME
 *   pence/GBX-safe {@link fxToEur} the portfolio join uses (imported, not
 *   replicated) so there is one source of truth for currency conversion.
 * - **Dividend cash:** for dividend rows the ledger's `price` field is the TOTAL
 *   cash paid (already in the row's currency), NOT per-share — mirrors
 *   `activityMath.ts` / server `schemas.ts`.
 */

import type { LedgerTransaction } from "@/lib/activity";

import { fxToEur } from "./buildPortfolio";
import type { FxRates, Position } from "./types";

/** One buy/sell event in a position's ordered history (oldest → newest). */
export interface TradeEvent {
  /** ISO timestamp the trade occurred (the ledger `occurred_at`). */
  date: string;
  side: "buy" | "sell";
  quantity: number;
  /** Per-share trade price, in `currency` (not converted). */
  price: number;
  currency: string;
}

export interface PositionDetail {
  /** Buy/sell events, oldest → newest — "the prices I bought at, over time". */
  trades: TradeEvent[];
  /** Realised P&L in EUR via average-cost over the sells; 0 when no sells. */
  realisedEur: number;
  /** Sum of dividend cash converted to EUR; 0 when no dividends. */
  dividendsEur: number;
  /** Earliest buy date (ISO), or null when the ledger has no buys. */
  holdingSince: string | null;
  /** Unrealised P&L (EUR) carried straight from the position; null if no cost. */
  unrealisedEur: number | null;
  /** Unrealised return as a fraction, carried from the position; null if no cost. */
  unrealisedPct: number | null;
  /** Whether the backing position has a usable cost basis. */
  hasCost: boolean;
}

export interface PositionDetailInputs {
  position: Position;
  /** That ticker's ledger rows (any order; this fn sorts trades). */
  ledger: LedgerTransaction[];
  fx: FxRates;
}

/** Compute the derived per-position detail. Pure; safe on an empty ledger. */
export function computePositionDetail({
  position,
  ledger,
  fx,
}: PositionDetailInputs): PositionDetail {
  // Buy/sell events, oldest → newest. A stable sort on the parsed timestamp keeps
  // same-instant rows in their original ledger order.
  const trades: TradeEvent[] = ledger
    .filter((t) => t.type === "buy" || t.type === "sell")
    .map((t) => ({
      date: t.occurred_at,
      side: t.type as "buy" | "sell",
      quantity: t.quantity,
      price: t.price ?? 0,
      currency: t.currency,
    }))
    .sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );

  // Average-cost realised P&L. Track running quantity + total cost (both in EUR)
  // so avgCost = totalCostEur / qty at each sell.
  let runningQty = 0;
  let runningCostEur = 0;
  let realisedEur = 0;

  for (const trade of trades) {
    const priceEur = trade.price * fxToEur(trade.currency, fx);
    if (trade.side === "buy") {
      runningQty += trade.quantity;
      runningCostEur += priceEur * trade.quantity;
      continue;
    }
    // Sell: realise gain over the current average cost; reduce the running
    // position by the sold quantity at that same average (so the average is
    // unchanged by the sale — only buys re-weight it).
    const avgCostEur = runningQty > 0 ? runningCostEur / runningQty : 0;
    realisedEur += (priceEur - avgCostEur) * trade.quantity;
    const soldQty = Math.min(trade.quantity, runningQty);
    runningQty -= soldQty;
    runningCostEur -= avgCostEur * soldQty;
  }

  // Dividend cash → EUR. `price` IS the total cash for dividend rows.
  let dividendsEur = 0;
  for (const t of ledger) {
    if (t.type !== "dividend") continue;
    dividendsEur += (t.price ?? 0) * fxToEur(t.currency, fx);
  }

  const firstBuy = trades.find((t) => t.side === "buy");

  return {
    trades,
    realisedEur,
    dividendsEur,
    holdingSince: firstBuy?.date ?? null,
    unrealisedEur: position.returnEur,
    unrealisedPct: position.returnPct,
    hasCost: position.hasCost,
  };
}
