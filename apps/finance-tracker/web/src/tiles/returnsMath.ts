/**
 * M6 — portfolio-level realised P&L + actual dividend income. Pure + testable.
 *
 * Three headline figures, all in EUR:
 *   - `unrealisedEur` / `unrealisedPct`: the live mark-to-market gain over the
 *     COST-BEARING positions only (mirrors buildPortfolio's totals — Revolut's
 *     cost-less positions are excluded from both numerator and denominator).
 *   - `realisedEur`: locked-in gains. The ledger is grouped BY TICKER and the
 *     shared average-cost loop ({@link realisedEurFromTrades}) runs per ticker,
 *     then summed — grouping is essential so one ticker's cost never bleeds into
 *     another's realised gain.
 *   - `dividendsEur12m`: dividend cash actually received in the trailing 365
 *     days, converted to EUR via the same `fxToEur` the rest of the app uses.
 *
 * `now` is injected for deterministic tests of the trailing window.
 *
 * DIVIDEND CASH CONVENTION (mirrors server schemas.ts / activityMath.ts): for
 * dividend rows `price` is the TOTAL cash paid (in the row's currency), NOT
 * per-share — so we sum `price`, never `quantity × price`.
 */

import { fxToEur } from "./buildPortfolio";
import { realisedEurFromTrades, tradesFromLedger } from "./positionDetailMath";
import type { FxRates, Position } from "./types";
import type { LedgerTransaction } from "@/lib/activity";

const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

export interface PortfolioReturns {
  /** Unrealised P&L (EUR) over the cost-bearing positions. */
  unrealisedEur: number;
  /** Unrealised return as a fraction over cost, or null when there's no cost. */
  unrealisedPct: number | null;
  /** Realised P&L (EUR), average-cost, summed across tickers. */
  realisedEur: number;
  /** Dividend cash received in the trailing 365 days, in EUR. */
  dividendsEur12m: number;
}

/**
 * Derive the portfolio's unrealised + realised P&L and trailing-12m dividends.
 *
 * @param positions Joined positions (EUR-valued) — supplies the unrealised side.
 * @param ledger    The COMPLETE transaction ledger across all tickers. Realised
 *                  P&L is only correct on the full history, so callers must pass
 *                  the un-truncated ledger (see `useFullLedger`).
 * @param fx        EUR-base FX rates for converting native trade/dividend cash.
 * @param now       Epoch ms "today"; injectable for deterministic tests.
 */
export function computePortfolioReturns(
  positions: Position[],
  ledger: LedgerTransaction[],
  fx: FxRates,
  now: number = Date.now(),
): PortfolioReturns {
  // Unrealised: mirror buildPortfolio — only positions with a real cost basis
  // contribute, and the pct is over that same cost subset.
  let unrealisedEur = 0;
  let totalCostEur = 0;
  for (const p of positions) {
    if (p.hasCost && p.costEur !== null) {
      unrealisedEur += p.returnEur ?? 0;
      totalCostEur += p.costEur;
    }
  }
  const unrealisedPct = totalCostEur > 0 ? unrealisedEur / totalCostEur : null;

  // Realised: group ledger rows by ticker, run the shared average-cost loop per
  // ticker, and sum. Grouping prevents cost from one ticker bleeding into
  // another's realised gain.
  const byTicker = new Map<string, LedgerTransaction[]>();
  for (const t of ledger) {
    const rows = byTicker.get(t.ticker);
    if (rows) rows.push(t);
    else byTicker.set(t.ticker, [t]);
  }
  let realisedEur = 0;
  for (const rows of byTicker.values()) {
    realisedEur += realisedEurFromTrades(tradesFromLedger(rows), fx);
  }

  // Dividends: cash received within the trailing 365 days, converted to EUR.
  const cutoff = now - YEAR_MS;
  let dividendsEur12m = 0;
  for (const t of ledger) {
    if (t.type !== "dividend") continue;
    const at = new Date(t.occurred_at).getTime();
    if (!Number.isFinite(at) || at < cutoff) continue;
    dividendsEur12m += (t.price ?? 0) * fxToEur(t.currency, fx);
  }

  return { unrealisedEur, unrealisedPct, realisedEur, dividendsEur12m };
}
