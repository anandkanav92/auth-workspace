/**
 * M11.1 — the portfolio data hook every tile reads from.
 *
 * Fetches the five inputs the tiles need and joins them (via {@link buildPortfolio})
 * into one typed {@link Portfolio}:
 *   - `GET /api/holdings`  — per-user positions
 *   - `GET /api/accounts`  — per-user accounts (for labels + scoping)
 *   - `GET /api/prices`    — shared cached spot prices (price_cache)
 *   - `GET /api/profiles`  — shared symbol profiles (sector / country / ratios / ETF weightings)
 *   - `GET /api/fx`        — latest ECB EUR-base FX rates
 *
 * All five are read with the M10 `api.ts` client (which attaches the Firebase
 * Bearer token). They're fetched as separate queries and combined with TanStack
 * Query's `combine` so each input caches independently — holdings change on every
 * mutation, but prices/profiles/FX are slow-moving and shared across all tiles.
 *
 * The query key carries the `accountIds` scope so the global dashboard and a
 * per-account dashboard don't share a derived `Portfolio`.
 */

import { useQueries } from "@tanstack/react-query";

import { api } from "@/lib/api";

import { buildPortfolio } from "./buildPortfolio";
import type {
  Account,
  FxRates,
  Holding,
  Portfolio,
  PriceQuote,
  SymbolProfile,
} from "./types";

const PRICES_KEY = ["prices"] as const;
const PROFILES_KEY = ["profiles"] as const;
const FX_KEY = ["fx"] as const;
const HOLDINGS_KEY = ["holdings"] as const;
const ACCOUNTS_KEY = ["accounts"] as const;

/** Result shape of the hook: TanStack-Query-like status flags + the joined data. */
export interface UsePortfolioDataResult {
  data: Portfolio | undefined;
  isLoading: boolean;
  isError: boolean;
}

/**
 * Load + join the portfolio for the given account scope.
 *
 * @param accountIds `'all'` for the global dashboard, or an explicit list for a
 *   per-account dashboard. Used both to scope the join and to key the query.
 */
export function usePortfolioData(
  accountIds: "all" | string[] = "all",
): UsePortfolioDataResult {
  return useQueries({
    queries: [
      {
        queryKey: HOLDINGS_KEY,
        queryFn: () => api.get<Holding[]>("/api/holdings"),
      },
      {
        queryKey: ACCOUNTS_KEY,
        queryFn: () => api.get<Account[]>("/api/accounts"),
      },
      {
        queryKey: PRICES_KEY,
        queryFn: () => api.get<PriceQuote[]>("/api/prices"),
        // Shared, slow-moving market data: cache longer than the per-user default.
        staleTime: 5 * 60_000,
      },
      {
        queryKey: PROFILES_KEY,
        queryFn: () => api.get<SymbolProfile[]>("/api/profiles"),
        staleTime: 60 * 60_000,
      },
      {
        queryKey: FX_KEY,
        // `/api/fx` returns a single `{ rates }` object — or `null` before the
        // first FX cron run / during an FX outage. We treat that as non-blocking.
        queryFn: () => api.get<FxRates | null>("/api/fx"),
        staleTime: 60 * 60_000,
      },
    ],
    combine: (results) => {
      const [holdings, accounts, prices, profiles, fx] = results;

      // FX is intentionally NOT gated on loading/error: a null/absent FX cache
      // is legitimate (before the first FX cron run, or during an FX outage).
      // buildPortfolio's fxToEur defaults unknown currencies to rate 1, so the
      // dashboard degrades gracefully (no FX row; non-EUR positions valued at
      // rate 1) rather than blanking the whole page. Only the four core inputs
      // gate loading/error.
      const core = [holdings, accounts, prices, profiles];
      const isLoading = core.some((r) => r.isLoading);
      const isError = core.some((r) => r.isError);

      if (
        isError ||
        !holdings.data ||
        !accounts.data ||
        !prices.data ||
        !profiles.data
      ) {
        return { data: undefined, isLoading, isError };
      }

      const data = buildPortfolio(
        {
          holdings: holdings.data,
          accounts: accounts.data,
          prices: prices.data,
          profiles: profiles.data,
          fx: fx.data ?? { rates: {} },
        },
        accountIds,
      );
      return { data, isLoading: false, isError: false };
    },
  });
}
