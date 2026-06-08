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

import { ApiError, api } from "@/lib/api";

/** Shape returned by GET /api/broker/trading212/status. */
export interface BrokerStatus {
  connected: boolean;
  /**
   * Only present once connected. "syncing" is the server-authoritative
   * in-progress signal (survives reloads / concurrent clients); "error" surfaces
   * the reconnect banner. The lifecycle is syncing → connected | error.
   */
  status?: "connected" | "error" | "syncing";
  last_synced_at?: string;
  last_error?: string;
}

/** Stable query key for the broker status query. */
export const BROKER_STATUS_KEY = ["broker-status"] as const;

/** How often we re-poll the status query while a background sync runs. */
const SYNC_POLL_INTERVAL_MS = 4_000;
/** Give up polling after this long; the sync may still finish server-side. */
const SYNC_POLL_TIMEOUT_MS = 180_000;

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
 * Drive the "Sync now" button (Task 2.4). The server runs the sync in the
 * background and returns 202 immediately, stamping the connection
 * `status:'syncing'` at the start and flipping it to `connected` | `error` when
 * it finishes — a SERVER-AUTHORITATIVE lifecycle. So we:
 *
 *   1. kick off the POST; on the 202 (sync started) OR a 409 `already_syncing`
 *      (a sync — ours or another client's — is already running) we begin polling
 *      `['broker-status']` every ~4s (sharing the query, so the whole UI sees the
 *      fresh `syncing` status and the button disables),
 *   2. an effect watches the polled status: we STOP as soon as `status` is no
 *      longer `"syncing"` (i.e. it became `connected` or `error`), then
 *      invalidate the synced caches and toast success / the error,
 *   3. if it never leaves `syncing` within ~3 min we stop with a gentle nudge.
 *
 * NOTE: the button's authoritative disabled/"Syncing…" state comes from
 * `status === "syncing"` on the shared query (survives reloads); `pending` here
 * only covers the brief window between the click and the first status flip.
 */
export function useSyncNow() {
  const queryClient = useQueryClient();
  // Local kickoff state: true from the click until polling stops. The card ALSO
  // disables off the authoritative `status === "syncing"`, so this just covers
  // the gap before the server has flipped the status.
  const [pending, setPending] = useState(false);
  const startedAt = useRef<number>(0);
  // Whether we've yet observed the server-set `syncing` status. We must not
  // treat the initial (pre-`syncing`) poll as "done" — only a transition AWAY
  // from `syncing` is completion.
  const observedSyncing = useRef(false);

  // A second observer on the shared status query; only this one polls, and only
  // while a sync is in flight. Other consumers (the card) stay non-polling.
  const polledStatus = useQuery({
    queryKey: BROKER_STATUS_KEY,
    queryFn: () => api.get<BrokerStatus>("/api/broker/trading212/status"),
    refetchInterval: pending ? SYNC_POLL_INTERVAL_MS : false,
    enabled: pending,
  });

  const mutation = useMutation({
    mutationFn: () =>
      api.post<SyncStartedResponse>("/api/broker/trading212/sync"),
  });

  const finish = useCallback(() => {
    setPending(false);
    observedSyncing.current = false;
    void queryClient.invalidateQueries({ queryKey: ["holdings"] });
    void queryClient.invalidateQueries({ queryKey: ["transactions"] });
    void queryClient.invalidateQueries({ queryKey: ["accounts"] });
    void queryClient.invalidateQueries({ queryKey: BROKER_STATUS_KEY });
  }, [queryClient]);

  // Watch the polled status for completion / timeout. Completion = a transition
  // OUT of `syncing` (→ connected | error), so we never stop before the server
  // has even started.
  const status = polledStatus.data?.status;
  const lastError = polledStatus.data?.last_error;
  useEffect(() => {
    if (!pending) return;

    if (status === "syncing") {
      observedSyncing.current = true;
      // still running — keep polling (subject to the timeout below)
    } else if (observedSyncing.current && status === "error") {
      finish();
      toast.error(
        lastError
          ? `Trading 212 sync failed: ${lastError}`
          : "Trading 212 sync failed.",
      );
      return;
    } else if (observedSyncing.current && status === "connected") {
      finish();
      toast.success("Trading 212 synced.");
      return;
    }

    if (Date.now() - startedAt.current > SYNC_POLL_TIMEOUT_MS) {
      finish();
      toast("Sync is taking a while — pull to refresh later.");
    }
  }, [pending, status, lastError, finish]);

  // Optimistically reflect the server-authoritative `syncing` status in the
  // shared cache the instant a sync is (re)started. This (a) disables the button
  // immediately and (b) records that we've entered `syncing`, so the NEXT poll
  // that reports `connected`/`error` is unambiguously completion — there is no
  // race where a stale pre-sync `connected`/`error` is mistaken for "done".
  const beginObservingSync = useCallback(() => {
    observedSyncing.current = true;
    queryClient.setQueryData<BrokerStatus>(BROKER_STATUS_KEY, (prev) =>
      prev ? { ...prev, status: "syncing" } : prev,
    );
    setPending(true);
  }, [queryClient]);

  const start = useCallback(() => {
    if (pending) return;
    startedAt.current = Date.now();
    observedSyncing.current = false;
    mutation.mutate(undefined, {
      onSuccess: () => {
        beginObservingSync();
        toast.success("Sync started…");
      },
      onError: (err) => {
        // A 409 means a sync is ALREADY running (ours from a prior click, or
        // another client's). That's not a failure — start observing it.
        if (err instanceof ApiError && isAlreadySyncing(err)) {
          beginObservingSync();
          return;
        }
        toast.error("Sync failed — check your connection and try again.");
      },
    });
  }, [pending, mutation, beginObservingSync]);

  // The button is disabled whenever a sync is in flight: either our local
  // kickoff `pending`, or the authoritative `syncing` status (which survives a
  // reload and reflects a concurrent client's sync).
  const isSyncing = pending || status === "syncing";
  return { start, isSyncing };
}

/** A 409 from POST /sync carrying the server's `already_syncing` error code. */
function isAlreadySyncing(err: ApiError): boolean {
  return (
    err.status === 409 &&
    typeof err.body === "object" &&
    err.body !== null &&
    (err.body as { error?: unknown }).error === "already_syncing"
  );
}
