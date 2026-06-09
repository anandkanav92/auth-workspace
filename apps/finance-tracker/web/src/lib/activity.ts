/**
 * M4 — client-side data access for the Activity feed.
 *
 * Reads the user's transaction ledger from the BFF (`GET /api/transactions`),
 * which the Trading 212 sync populates (type: buy/sell/dividend) alongside the
 * manual holdings mutations. Mirrors `lib/holdings.ts` / `lib/accounts.ts`: a
 * TanStack Query hook over the typed `api` client, keyed so it invalidates with
 * the rest of the portfolio when a sync or holdings mutation lands.
 *
 * The endpoint returns paged metadata; the feed only wants the N newest events,
 * so we pass `?limit=` (server caps at 200) and surface just the `items`.
 */

import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";

/** Ledger event types the feed renders distinctly; others are passed through. */
export type TransactionType =
  | "buy"
  | "sell"
  | "dividend"
  | "fee"
  | "adjustment"
  | "import";

/**
 * A ledger row as returned by `GET /api/transactions`.
 *
 * `price` OVERLOAD (mirrors server schemas.ts): for buy/sell rows it is the
 * PER-SHARE price (so quantity × price is the gross trade value); for dividend
 * rows it is the TOTAL cash amount paid (NOT per-share). See `activityMath.ts`.
 */
export interface LedgerTransaction {
  id: string;
  account: string;
  holding?: string;
  type: TransactionType;
  ticker: string;
  quantity: number;
  price?: number;
  currency: string;
  fee?: number;
  occurred_at: string;
  source: "revolut" | "trading212" | "manual";
  notes?: string;
  external_id?: string;
}

/** Paged envelope the BFF wraps the ledger in. */
interface TransactionsPage {
  items: LedgerTransaction[];
  page: number;
  perPage: number;
  totalItems: number;
  totalPages: number;
}

/** Optional feed filter: a single ledger type, or all events when omitted. */
export type ActivityFilter = "all" | "buy" | "sell" | "dividend";

/** Shared query key for the activity ledger (invalidated by syncs/mutations). */
export const ACTIVITY_KEY = ["transactions"] as const;

const DEFAULT_LIMIT = 100;

/**
 * Fetch the signed-in user's transaction ledger, newest first. Pass a `filter`
 * to scope to one type server-side; "all" (default) fetches every type.
 */
export function useActivity(filter: ActivityFilter = "all") {
  return useQuery({
    queryKey: [...ACTIVITY_KEY, filter],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: String(DEFAULT_LIMIT) });
      if (filter !== "all") params.set("type", filter);
      const page = await api.get<TransactionsPage>(
        `/api/transactions?${params.toString()}`,
      );
      return page.items;
    },
  });
}
