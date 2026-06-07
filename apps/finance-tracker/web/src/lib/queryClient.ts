import { QueryClient } from "@tanstack/react-query";

/**
 * Shared TanStack Query client (M10.6).
 *
 * Defaults tuned for a data dashboard backed by the BFF:
 *  - `retry: 1` — one retry smooths transient blips but doesn't hammer the BFF
 *    or retry genuine 401/4xx into the ground.
 *  - `staleTime: 30s` — portfolio/profile data changes slowly; avoid refetching
 *    on every mount/focus during a single session.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});
