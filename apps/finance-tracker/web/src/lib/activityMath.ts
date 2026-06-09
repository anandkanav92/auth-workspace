/**
 * M4.2 — pure recent-activity summary math.
 *
 * Drives the "Last 30 days" card at the top of the Activity feed. Pure (no IO,
 * no clock unless injected) so it is unit-tested in isolation.
 *
 * DIVIDEND CASH CONVENTION (mirrors server schemas.ts): for dividend rows the
 * `price` field holds the TOTAL cash amount paid (already in the row's
 * `currency`), NOT a per-share figure. So `dividendTotal` sums `price` directly
 * — never `quantity × price`, which is meaningless for dividends.
 */

import type { LedgerTransaction } from "@/lib/activity";

export interface RecentSummary {
  /** Count of buy events in the window. */
  buys: number;
  /** Count of sell events in the window. */
  sells: number;
  /** Count of dividend events in the window. */
  dividendCount: number;
  /** Sum of dividend CASH (the `price` field) in the window. */
  dividendTotal: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Summarise the trailing `days` (default 30) of a ledger: count buy/sell events
 * and sum dividend cash. `now` is injectable for deterministic tests; it
 * defaults to the current time.
 *
 * Non buy/sell/dividend rows (adjustments, fees, imports) are ignored — the
 * card only reports trades and income.
 */
export function summarizeRecent(
  transactions: LedgerTransaction[],
  days = 30,
  now: number = Date.now(),
): RecentSummary {
  const cutoff = now - days * DAY_MS;
  const summary: RecentSummary = {
    buys: 0,
    sells: 0,
    dividendCount: 0,
    dividendTotal: 0,
  };

  for (const tx of transactions) {
    const at = new Date(tx.occurred_at).getTime();
    if (!Number.isFinite(at) || at < cutoff) continue;

    switch (tx.type) {
      case "buy":
        summary.buys += 1;
        break;
      case "sell":
        summary.sells += 1;
        break;
      case "dividend":
        summary.dividendCount += 1;
        // `price` IS the cash amount for dividends; absent → 0.
        summary.dividendTotal += tx.price ?? 0;
        break;
      default:
        break;
    }
  }

  return summary;
}
