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

import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

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

/** How often we re-poll the status query while a background sync runs. */
const SYNC_POLL_INTERVAL_MS = 4_000;
/** Give up polling after this long; the sync may still finish server-side. */
const SYNC_POLL_TIMEOUT_MS = 150_000;

/** Fetch the signed-in user's Trading 212 connection status. */
export function useBrokerStatus() {
  return useQuery({
    queryKey: BROKER_STATUS_KEY,
    queryFn: () => api.get<BrokerStatus>("/api/broker/trading212/status"),
  });
}

export interface ConnectBrokerInput {
  /** Trading 212 public (API) key. */
  apiKey: string;
  /** Trading 212 private (secret) key. The server combines them as
   *  "<apiKey>:<apiSecret>" for HTTP Basic auth. */
  apiSecret: string;
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

/** What POST /api/broker/trading212/sync now returns (202, fire-and-forget). */
interface SyncStartedResponse {
  ok: true;
  started: true;
}

/**
 * Drive the "Sync now" button (Task 2.4). The server now runs the sync in the
 * background and returns 202 immediately, recording progress on the connection
 * (`status` / `last_synced_at` / `last_error`). So instead of awaiting a result
 * that never comes, we:
 *
 *   1. capture the pre-sync `last_synced_at` and kick off the POST,
 *   2. on the 202, flip `isSyncing` on → an internal status observer starts
 *      polling every ~4s (it shares the BROKER_STATUS_KEY query, so the rest of
 *      the UI sees the fresh status too),
 *   3. an effect watches the polled status: when `last_synced_at` advances OR
 *      `status === "error"` we stop, invalidate the synced caches, and toast,
 *   4. if neither happens within ~2.5 min we stop with a gentle nudge.
 */
export function useSyncNow() {
  const queryClient = useQueryClient();
  const [isSyncing, setIsSyncing] = useState(false);
  // last_synced_at observed at kickoff — completion = this value changing.
  const baselineSyncedAt = useRef<string | undefined>(undefined);
  const startedAt = useRef<number>(0);

  // A second observer on the shared status query; only this one polls, and only
  // while a sync is in flight. Other consumers (the card) stay non-polling.
  const polledStatus = useQuery({
    queryKey: BROKER_STATUS_KEY,
    queryFn: () => api.get<BrokerStatus>("/api/broker/trading212/status"),
    refetchInterval: isSyncing ? SYNC_POLL_INTERVAL_MS : false,
    enabled: isSyncing,
  });

  const mutation = useMutation({
    mutationFn: () =>
      api.post<SyncStartedResponse>("/api/broker/trading212/sync"),
  });

  const finish = useCallback(() => {
    setIsSyncing(false);
    baselineSyncedAt.current = undefined;
    void queryClient.invalidateQueries({ queryKey: ["holdings"] });
    void queryClient.invalidateQueries({ queryKey: ["transactions"] });
    void queryClient.invalidateQueries({ queryKey: ["accounts"] });
    void queryClient.invalidateQueries({ queryKey: BROKER_STATUS_KEY });
  }, [queryClient]);

  // Watch the polled status for completion / error / timeout.
  const status = polledStatus.data;
  useEffect(() => {
    if (!isSyncing) return;

    if (status?.status === "error") {
      finish();
      toast.error(
        status.last_error
          ? `Trading 212 sync failed: ${status.last_error}`
          : "Trading 212 sync failed.",
      );
      return;
    }

    const advanced =
      status?.last_synced_at != null &&
      status.last_synced_at !== baselineSyncedAt.current;
    if (advanced) {
      finish();
      toast.success("Trading 212 synced.");
      return;
    }

    if (Date.now() - startedAt.current > SYNC_POLL_TIMEOUT_MS) {
      finish();
      toast("Sync is taking a while — pull to refresh later.");
    }
  }, [isSyncing, status, finish]);

  const start = useCallback(() => {
    if (isSyncing) return;
    baselineSyncedAt.current =
      queryClient.getQueryData<BrokerStatus>(BROKER_STATUS_KEY)?.last_synced_at;
    startedAt.current = Date.now();
    mutation.mutate(undefined, {
      onSuccess: () => {
        setIsSyncing(true);
        toast.success("Sync started…");
      },
      onError: () =>
        toast.error("Sync failed — check your connection and try again."),
    });
  }, [isSyncing, queryClient, mutation]);

  return { start, isSyncing };
}
