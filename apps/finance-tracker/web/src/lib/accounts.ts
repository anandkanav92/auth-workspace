/**
 * M12 — accounts data access for the import flow.
 *
 * The import page lets the user pick which account to import into, and create
 * a new one inline. Both read/write `/api/accounts`. We reuse the same
 * `["accounts"]` query key the tiles use (see usePortfolioData) so a freshly
 * created account shows up everywhere without a manual refetch.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";
import type { Account } from "@/tiles/types";

/** Broker sources a statement import can target (excludes "manual"). */
export const IMPORT_SOURCES = [
  { value: "trading212", label: "Trading 212" },
  { value: "revolut", label: "Revolut" },
] as const;

export type ImportSource = (typeof IMPORT_SOURCES)[number]["value"];

export const ACCOUNTS_KEY = ["accounts"] as const;

/** Fetch the signed-in user's accounts. */
export function useAccounts() {
  return useQuery({
    queryKey: ACCOUNTS_KEY,
    queryFn: () => api.get<Account[]>("/api/accounts"),
  });
}

export interface CreateAccountInput {
  source: ImportSource;
  label: string;
}

/** Create a new account inline; invalidates the shared accounts cache. */
export function useCreateAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAccountInput) =>
      api.post<Account>("/api/accounts", input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ACCOUNTS_KEY });
    },
  });
}
