import { queryClient } from "@/lib/queryClient";

/**
 * Reviewer fix (P0): wipe sensitive client-side state on sign-out.
 *
 * The service worker caches `GET /api/*` responses (holdings, transactions,
 * prices, allocation) in the `api-data` Cache Storage bucket for offline reads,
 * and TanStack Query holds the same data in memory. Neither was cleared on
 * sign-out, so on a SHARED DEVICE the previous user's portfolio survived logout
 * (readable via DevTools → Cache Storage, or until a full reload for the
 * in-memory cache). We clear both here.
 *
 * We do NOT touch the precache (the app shell) or unregister the SW — only the
 * sensitive data bucket. Auth responses (`/api/auth/*`) are NetworkOnly and were
 * never cached (see vite.config.ts), so there is no token to purge.
 */
const API_DATA_CACHE = "api-data";

export async function clearSensitiveCaches(): Promise<void> {
  // In-memory query cache (cancels in-flight queries + drops cached data).
  queryClient.clear();

  // On-disk SW response cache. Guarded for non-PWA / SSR / test environments.
  if (typeof caches !== "undefined") {
    await caches.delete(API_DATA_CACHE).catch(() => undefined);
  }
}
