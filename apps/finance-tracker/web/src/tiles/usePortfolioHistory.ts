/**
 * Loads the portfolio value-over-time series for the hero chart.
 *
 * Reads `GET /api/portfolio/history`, which sums the nightly holdings_snapshot
 * rows into one total per day. The series starts sparse (one point per day since
 * the first snapshot) and fills in over time, so the hero degrades gracefully to
 * its placeholder until there are at least two points.
 */

import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";

export interface HistoryPoint {
  date: string;
  valueEur: number;
}

export function usePortfolioHistory(accountIds: "all" | string[]) {
  // Scope to a single account when the dashboard is on a per-account tab; the
  // "all" view (or a multi-account selection) shows the whole-book history.
  const accountId =
    accountIds !== "all" && accountIds.length === 1 ? accountIds[0] : undefined;

  return useQuery({
    queryKey: ["portfolio-history", accountId ?? "all"],
    queryFn: () =>
      api.get<HistoryPoint[]>(
        `/api/portfolio/history?days=90${accountId ? `&accountId=${accountId}` : ""}`,
      ),
    staleTime: 5 * 60_000,
  });
}
