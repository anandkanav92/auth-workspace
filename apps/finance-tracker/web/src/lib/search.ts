/**
 * M13 — client-side data access for ticker search + manual add-position.
 *
 * Search (M13.2): `useTickerSearch` debounces the query (300ms) and reads
 * `GET /api/search?q=` through the M10 api client. The endpoint returns shared
 * market data (no per-user scoping) as `SearchResult[]`.
 *
 * Add (M13.4): `useAddHolding` posts to `POST /api/holdings`. The body is built
 * to match the server's `addSchema` EXACTLY (see server/src/routes/holdings.ts):
 *   { account, ticker, isin?, quantity, cost_basis?, cost_currency?, price?, notes? }
 * On success it invalidates the per-user `["holdings"]` query (plus the derived
 * portfolio inputs) so every tile refetches and reflects the new position.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

import { api } from "@/lib/api";

/** One ticker search hit, mirroring the server's `SearchResult` shape. */
export interface SearchResult {
  ticker: string;
  name: string;
  exchange: string;
}

/** Query key prefix for ticker searches; the term is the second segment. */
export const SEARCH_KEY = "search" as const;

/**
 * Minimum query length before we hit the network. One- or two-character queries
 * are too noisy to be useful and would burn the provider quota.
 */
const MIN_QUERY_LENGTH = 2;

/**
 * Run a ticker search for an ALREADY-DEBOUNCED query. The caller is responsible
 * for debouncing (see {@link useDebouncedValue}); this hook only fetches once
 * the (trimmed) query meets the minimum length, and stays disabled otherwise so
 * an empty palette makes zero requests.
 */
export function useTickerSearch(debouncedQuery: string) {
  const q = debouncedQuery.trim();
  const enabled = q.length >= MIN_QUERY_LENGTH;

  return useQuery({
    queryKey: [SEARCH_KEY, q],
    queryFn: () => api.get<SearchResult[]>(`/api/search?q=${encodeURIComponent(q)}`),
    enabled,
    // Results for a given term are stable for a while (the server caches new
    // hits into symbol_profiles); avoid refetching the same term on remount.
    staleTime: 5 * 60_000,
  });
}

/**
 * Zod schema for the add-position form. Mirrors the server `addSchema`
 * (quantity positive; cost_basis non-negative; currency required when a cost is
 * entered). Inputs arrive as strings from the form, so we coerce + validate
 * here before building the request body.
 *
 * `cost`/`costCurrency` are optional as a pair: a manual add can record just a
 * quantity (e.g. a gift or unknown-basis position), matching the server where
 * `cost_basis` is nullable.
 */
export const addPositionSchema = z
  .object({
    account: z.string().min(1, "Pick an account"),
    ticker: z.string().min(1, "Ticker is required"),
    quantity: z
      .number({ invalid_type_error: "Enter a quantity" })
      .positive("Quantity must be greater than zero"),
    // Total cost (NOT per-share), matching the server's cost_basis semantics.
    cost: z
      .number({ invalid_type_error: "Enter a cost" })
      .nonnegative("Cost cannot be negative")
      .optional(),
    costCurrency: z.string().optional(),
    /** Display-only acquisition date; see {@link buildAddHoldingBody}. */
    date: z.string().optional(),
  })
  .refine((v) => v.cost === undefined || (v.costCurrency?.trim().length ?? 0) > 0, {
    message: "Pick a currency for the cost",
    path: ["costCurrency"],
  });

export type AddPositionForm = z.infer<typeof addPositionSchema>;

/**
 * Request body for `POST /api/holdings`, EXACTLY matching the server `addSchema`.
 *
 * NOTE: the server stamps `occurred_at` itself (now()) and has no body field for
 * an acquisition date, so the form's `date` is intentionally NOT sent. It is a
 * display/UX affordance only — documented as a known contract gap for M13.
 */
export interface AddHoldingBody {
  account: string;
  ticker: string;
  quantity: number;
  cost_basis?: number | null;
  cost_currency?: string | null;
}

/** Build the `/api/holdings` body from a validated form value. */
export function buildAddHoldingBody(form: AddPositionForm): AddHoldingBody {
  const body: AddHoldingBody = {
    account: form.account,
    ticker: form.ticker,
    quantity: form.quantity,
  };
  if (form.cost !== undefined) {
    body.cost_basis = form.cost;
    body.cost_currency = form.costCurrency?.trim() || null;
  }
  return body;
}

/**
 * Manual add-position mutation. Posts the matched server body and, on success,
 * invalidates the per-user holdings query plus the derived portfolio inputs so
 * the dashboard tiles refetch and show the new position immediately.
 */
export function useAddHolding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (form: AddPositionForm) =>
      api.post("/api/holdings", buildAddHoldingBody(form)),
    onSuccess: () => {
      // ["holdings"] drives usePortfolioData; ["prices"]/["profiles"] may need a
      // new ticker fetched, so nudge them too. (accounts is unchanged.)
      void queryClient.invalidateQueries({ queryKey: ["holdings"] });
      void queryClient.invalidateQueries({ queryKey: ["prices"] });
      void queryClient.invalidateQueries({ queryKey: ["profiles"] });
    },
  });
}
