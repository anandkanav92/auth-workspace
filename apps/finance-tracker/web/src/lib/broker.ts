/**
 * Task 1.6 — Trading 212 broker connection data access for Settings.
 *
 * Mirrors `lib/accounts.ts`: thin TanStack Query hooks over `lib/api.ts` (which
 * attaches the Firebase token). The status query drives the Settings card;
 * connect/disconnect are mutations that invalidate the relevant caches so the
 * rest of the app (holdings, accounts) reflects a fresh connection.
 *
 * The status response NEVER includes the API key — the server whitelists the
 * safe fields (see server/src/routes/broker.ts getTrading212StatusWith).
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";

/** Shape returned by GET /api/broker/trading212/status. */
export interface BrokerStatus {
  connected: boolean;
  /** Only present once connected; "error" surfaces the reconnect banner. */
  status?: "connected" | "error";
  last_synced_at?: string;
  last_error?: string;
}

/** Stable query key for the broker status query. */
export const BROKER_STATUS_KEY = ["broker-status"] as const;

/** Fetch the signed-in user's Trading 212 connection status. */
export function useBrokerStatus() {
  return useQuery({
    queryKey: BROKER_STATUS_KEY,
    queryFn: () =>
      api.get<BrokerStatus>("/api/broker/trading212/status"),
  });
}

export interface ConnectBrokerInput {
  apiKey: string;
}

/**
 * Connect a Trading 212 read-only key. On success the connection status changes
 * and an initial sync runs server-side, so we invalidate both the status query
 * and the holdings/accounts caches that the sync populates.
 */
export function useConnectBroker() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ConnectBrokerInput) =>
      api.post<{ ok: true }>("/api/broker/trading212/connect", input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: BROKER_STATUS_KEY });
      void queryClient.invalidateQueries({ queryKey: ["holdings"] });
      void queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
  });
}

/** Disconnect Trading 212 (deletes the connection; holdings are kept). */
export function useDisconnectBroker() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete<{ ok: true }>("/api/broker/trading212"),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: BROKER_STATUS_KEY });
    },
  });
}

// TODO(M2.4): Sync now — useSyncNow() mutation (POST /api/broker/trading212/sync)
// arrives once the sync endpoint lands in Task 2.4.
