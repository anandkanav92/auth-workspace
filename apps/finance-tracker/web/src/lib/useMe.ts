import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";

/**
 * The authed identity as returned by the BFF's `GET /api/auth/me`. Mirrors the
 * server route shape: Firebase UID + email + the PocketBase user id the BFF
 * upserts on first contact.
 */
export interface Me {
  uid: string;
  email: string;
  pbUserId: string;
}

/** Stable query key for the current-user query. */
export const meQueryKey = ["me"] as const;

/**
 * M10.6 — fetch the current user from the BFF.
 *
 * Drives the header avatar / sign-out menu. Only meaningful once Firebase auth
 * has resolved a user (the request 401s otherwise), so callers should render it
 * inside the AuthGate. A single retry is inherited from the shared client; the
 * BFF verifies the Bearer token attached by api.ts.
 */
export function useMe() {
  return useQuery({
    queryKey: meQueryKey,
    queryFn: () => api.get<Me>("/api/auth/me"),
  });
}
