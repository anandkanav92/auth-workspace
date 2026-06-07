import { getAuth, getIdToken } from "firebase/auth";

/**
 * M10.5 — typed fetch client for the BFF.
 *
 * Every `/api/*` request carries the current user's Firebase ID token as
 * `Authorization: Bearer <token>` (the BFF's authMiddleware rejects anything
 * else with 401). Responses are parsed as JSON; non-2xx responses throw a typed
 * {@link ApiError} so callers (and TanStack Query) get a structured failure.
 *
 * Base URL: `VITE_API_BASE_URL` when set, otherwise same-origin relative paths.
 * In prod the SPA is served by the BFF so relative `/api/*` resolves directly;
 * in dev, Vite's `server.proxy` forwards `/api` to the local BFF (:3110).
 */

const BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");

/** Error thrown for any non-2xx API response. */
export class ApiError extends Error {
  readonly status: number;
  /** Parsed response body when available (often `{ error: string }`). */
  readonly body: unknown;

  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

/**
 * Resolve the current Firebase ID token, or `null` when signed out.
 *
 * Extracted (rather than inlined) so it is a single, mockable seam in tests —
 * unit tests stub this module's `firebase/auth` imports. Reads the live
 * `currentUser` off the auth instance initialised by initAuth() at app entry.
 */
async function resolveIdToken(): Promise<string | null> {
  const user = getAuth().currentUser;
  if (!user) return null;
  return getIdToken(user);
}

export interface ApiRequestOptions extends Omit<RequestInit, "body"> {
  /** JSON-serialisable request body; sets Content-Type automatically. */
  body?: unknown;
}

/**
 * Perform an authenticated request against the BFF.
 *
 * @param path  Path beginning with `/api/...` (or any path; it is appended to
 *              the configured base URL verbatim).
 * @returns     The parsed JSON body, typed as `T`.
 * @throws      {@link ApiError} on any non-2xx response.
 */
export async function apiFetch<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const { body, headers, ...rest } = options;

  const finalHeaders = new Headers(headers);
  const token = await resolveIdToken();
  if (token) {
    finalHeaders.set("Authorization", `Bearer ${token}`);
  }

  let serialisedBody: BodyInit | undefined;
  if (body !== undefined) {
    serialisedBody = JSON.stringify(body);
    if (!finalHeaders.has("Content-Type")) {
      finalHeaders.set("Content-Type", "application/json");
    }
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...rest,
    headers: finalHeaders,
    body: serialisedBody,
  });

  // Parse JSON defensively: empty bodies (e.g. 204) and non-JSON error pages
  // must not crash the client.
  const text = await res.text();
  const parsed = text ? safeJsonParse(text) : null;

  if (!res.ok) {
    const message =
      isErrorBody(parsed) ? parsed.error : `Request failed (${res.status})`;
    throw new ApiError(res.status, message, parsed);
  }

  return parsed as T;
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function isErrorBody(value: unknown): value is { error: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    typeof (value as { error: unknown }).error === "string"
  );
}

/** Convenience verbs over {@link apiFetch}. */
export const api = {
  get: <T>(path: string, options?: ApiRequestOptions) =>
    apiFetch<T>(path, { ...options, method: "GET" }),
  post: <T>(path: string, body?: unknown, options?: ApiRequestOptions) =>
    apiFetch<T>(path, { ...options, method: "POST", body }),
  put: <T>(path: string, body?: unknown, options?: ApiRequestOptions) =>
    apiFetch<T>(path, { ...options, method: "PUT", body }),
  patch: <T>(path: string, body?: unknown, options?: ApiRequestOptions) =>
    apiFetch<T>(path, { ...options, method: "PATCH", body }),
  delete: <T>(path: string, options?: ApiRequestOptions) =>
    apiFetch<T>(path, { ...options, method: "DELETE" }),
};
