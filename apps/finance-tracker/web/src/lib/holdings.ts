/**
 * M14 — client-side data access for the holdings list + sell/edit flows.
 *
 * Every mutation here funnels through the M10 `api.ts` client and builds a body
 * that matches the server contract in `server/src/routes/holdings.ts` EXACTLY:
 *
 *   - partial sell : POST   /api/holdings/:id/sell  { quantity, price, currency }
 *   - edit qty/cost: PATCH  /api/holdings/:id       { quantity?, cost_basis?, cost_currency?, notes? }
 *   - full sell    : DELETE /api/holdings/:id       { price, currency }
 *   - undo a sell  : POST   /api/holdings           { account, ticker, quantity, cost_basis?, cost_currency? }
 *
 * On settle, every mutation invalidates the `["holdings"]` query (which drives
 * both `usePortfolioData` and this page's list) plus the derived price/profile
 * inputs, so the dashboard tiles AND the holdings list refetch together.
 *
 * UNDO (M14.4): a partial sell is fully reversible. The server's `applySell`
 * removes cost basis proportionally to the sold fraction, so re-adding exactly
 * the sold quantity + the sold cost portion via POST /api/holdings (whose
 * `mergeBuy` is a weighted-average add) restores the original quantity AND
 * cost_basis precisely. We compute the sold cost portion on the client from the
 * pre-sell position. Null-cost positions (Revolut) re-add with no cost, which is
 * also exact (mergeBuy keeps cost null). See `buildSellUndoBody`.
 */

import {
  useMutation,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";

import { apiFetch, api } from "@/lib/api";
import type { Holding } from "@/tiles/types";

/** Shared query key for the per-user holdings list (matches usePortfolioData). */
export const HOLDINGS_KEY = ["holdings"] as const;

/** Invalidate everything the holdings + portfolio views derive from. */
function invalidatePortfolio(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: HOLDINGS_KEY });
  void queryClient.invalidateQueries({ queryKey: ["prices"] });
  void queryClient.invalidateQueries({ queryKey: ["profiles"] });
}

// --- partial sell -----------------------------------------------------------

/** Body for POST /api/holdings/:id/sell — matches the server `sellSchema`. */
export interface SellBody {
  quantity: number;
  price: number;
  currency: string;
}

export interface SellArgs {
  id: string;
  body: SellBody;
}

/**
 * Partial-sell mutation with an optimistic quantity decrement.
 *
 * The optimistic update rewrites the cached holding so the list/tiles reflect
 * the sale instantly; the `["holdings"]` invalidation on settle reconciles with
 * the server's authoritative quantity + cost_basis. On error we roll back to the
 * snapshot captured in `onMutate`.
 */
export function useSellHolding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: SellArgs) =>
      api.post<Holding>(`/api/holdings/${id}/sell`, body),
    onMutate: async ({ id, body }) => {
      await queryClient.cancelQueries({ queryKey: HOLDINGS_KEY });
      const previous = queryClient.getQueryData<Holding[]>(HOLDINGS_KEY);
      queryClient.setQueryData<Holding[]>(HOLDINGS_KEY, (old) =>
        decrementHolding(old, id, body.quantity),
      );
      return { previous };
    },
    onError: (_err, _args, context) => {
      if (context?.previous) {
        queryClient.setQueryData(HOLDINGS_KEY, context.previous);
      }
    },
    onSettled: () => invalidatePortfolio(queryClient),
  });
}

/**
 * Optimistically reduce a holding's quantity (and its cost_basis proportionally,
 * mirroring the server's `applySell`). Returns a new array; never mutates input.
 */
export function decrementHolding(
  holdings: Holding[] | undefined,
  id: string,
  soldQty: number,
): Holding[] {
  if (!holdings) return [];
  return holdings.map((h) => {
    if (h.id !== id) return h;
    const remainingQty = Math.max(0, h.quantity - soldQty);
    const cost =
      h.cost_basis != null && h.quantity > 0
        ? remainingQty <= 0
          ? 0
          : h.cost_basis * (remainingQty / h.quantity)
        : h.cost_basis;
    return { ...h, quantity: remainingQty, cost_basis: cost };
  });
}

// --- undo a partial sell ----------------------------------------------------

/** Body for the compensating POST /api/holdings that reverses a partial sell. */
export interface SellUndoBody {
  account: string;
  ticker: string;
  quantity: number;
  cost_basis?: number | null;
  cost_currency?: string | null;
}

/**
 * Build the compensating re-add body that exactly reverses a partial sell.
 *
 * `before` is the holding as it was BEFORE the sell. The sold cost portion is
 * `cost_basis * soldQty / quantityBefore` (the same proportion the server
 * removed). Re-adding `soldQty` shares with that cost portion makes `mergeBuy`
 * sum the quantity and cost back to their pre-sell totals.
 *
 * When the position had no cost basis (null cost_currency), we re-add with no
 * cost — `mergeBuy` keeps the merged cost null, which is the correct restore.
 */
export function buildSellUndoBody(
  before: Holding,
  soldQty: number,
): SellUndoBody {
  const body: SellUndoBody = {
    account: before.account,
    ticker: before.ticker,
    quantity: soldQty,
  };
  const hasCost =
    typeof before.cost_currency === "string" &&
    before.cost_currency.trim().length > 0 &&
    before.cost_basis != null;
  if (hasCost && before.quantity > 0) {
    body.cost_basis = before.cost_basis! * (soldQty / before.quantity);
    body.cost_currency = before.cost_currency;
  }
  return body;
}

/** Mutation that reverses a partial sell by re-adding the sold quantity + cost. */
export function useUndoSell() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: SellUndoBody) =>
      api.post<Holding>("/api/holdings", body),
    onSettled: () => invalidatePortfolio(queryClient),
  });
}

// --- edit qty / cost (adjustment) -------------------------------------------

/**
 * Body for PATCH /api/holdings/:id — matches the server `adjustSchema`. At least
 * one field must be present; `cost_basis` is nullable (clearing a cost basis).
 */
export interface AdjustBody {
  quantity?: number;
  cost_basis?: number | null;
  cost_currency?: string | null;
  notes?: string;
}

export interface AdjustArgs {
  id: string;
  body: AdjustBody;
}

/** Edit qty/cost mutation (PATCH). Invalidates holdings + portfolio on settle. */
export function useAdjustHolding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: AdjustArgs) =>
      api.patch<Holding>(`/api/holdings/${id}`, body),
    onSettled: () => invalidatePortfolio(queryClient),
  });
}

// --- full sell (DELETE with body) -------------------------------------------

/** Body for DELETE /api/holdings/:id — matches the server `fullSellSchema`. */
export interface FullSellBody {
  price: number;
  currency: string;
}

export interface FullSellArgs {
  id: string;
  body: FullSellBody;
}

/**
 * Full-sell mutation (DELETE). The M10 `api.delete` helper takes no body, so we
 * call `apiFetch` directly with method DELETE + the sale price/currency body
 * (the server reads it to record an honest sell transaction).
 *
 * No undo: a full sell is a deliberate "close this position" action. (A re-add
 * would technically restore it, but re-opening an explicitly closed position is
 * not the same intent as nudging a partial sale, so we surface a plain success
 * toast instead — see PositionSheet.)
 */
export function useFullSellHolding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: FullSellArgs) =>
      apiFetch<Holding>(`/api/holdings/${id}`, {
        method: "DELETE",
        body,
      }),
    onSettled: () => invalidatePortfolio(queryClient),
  });
}
