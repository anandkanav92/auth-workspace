// Shared route helpers for the M5 CRUD endpoints.
//
// SECURITY (the #1 review item): the M4 repos use the ADMIN PocketBase client,
// whose requests BYPASS PocketBase's per-user collection rules. The base repo's
// get/update/delete are BY-ID and UNSCOPED — given any id, they will fetch /
// mutate it regardless of owner. Every route that operates on a record by id
// MUST therefore enforce ownership in this layer.
//
// `requireOwned` is the single chokepoint for that: it fetches the record by id
// and returns it only when `record.user === pbUserId`. On a missing record OR an
// owner mismatch it throws 404 (NOT 403) — a 403 would leak the existence of
// another user's record, so we treat "not yours" and "not found" identically.

import { HTTPException } from 'hono/http-exception';
import type { z } from 'zod';

/** Minimal slice of a per-user repo that requireOwned needs. */
interface OwnableRepo<T extends { user: string }> {
  get(id: string): Promise<T>;
}

/**
 * Fetch `id` from `repo` and assert it belongs to `pbUserId`. Returns the
 * record on success; throws HTTPException(404) when the record is missing or
 * owned by someone else (no existence leak — see file header).
 */
export async function requireOwned<T extends { user: string }>(
  repo: OwnableRepo<T>,
  id: string,
  pbUserId: string,
): Promise<T> {
  let record: T;
  try {
    record = await repo.get(id);
  } catch {
    // PocketBase 404 (or any fetch failure) → treat as not found.
    throw new HTTPException(404, { message: 'not_found' });
  }
  if (record.user !== pbUserId) {
    throw new HTTPException(404, { message: 'not_found' });
  }
  return record;
}

/**
 * Parse `body` with `schema`, throwing HTTPException(400) with the Zod issues on
 * failure. Centralises the 400-on-invalid-body contract for every write route.
 */
export function parseBody<S extends z.ZodTypeAny>(
  schema: S,
  body: unknown,
): z.infer<S> {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new HTTPException(400, {
      res: Response.json(
        { error: 'invalid_body', issues: result.error.issues },
        { status: 400 },
      ),
    });
  }
  return result.data;
}

/** Read + JSON-parse a request body, tolerating an empty body as `{}`. */
export async function readJson(c: {
  req: { json: () => Promise<unknown> };
}): Promise<unknown> {
  try {
    return await c.req.json();
  } catch {
    return {};
  }
}
