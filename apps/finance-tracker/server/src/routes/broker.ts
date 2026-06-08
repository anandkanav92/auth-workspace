// Broker connect / status / disconnect endpoints (Task 1.5). Mounted at
// /api/broker behind authMiddleware + rateLimit, so c.var.pbUserId is always
// set. Every handler is user-scoped via c.var.pbUserId — never a request body —
// so user A can never read or mutate user B's connection (the admin repos bypass
// PocketBase rules; see _helpers.ts / perUserRepo.ts).
//
//   POST   /api/broker/trading212/connect  { apiKey, apiSecret } → validate → encrypt+store
//   GET    /api/broker/trading212/status            → { connected, status, ... }
//   DELETE /api/broker/trading212                   → delete the connection row
//
// Dependencies are INJECTED (BrokerDeps) so the handlers are unit-testable
// without PocketBase, the network, or the real Trading 212 provider. The
// production binding (getProdDeps) wires the real repos + provider + encrypt
// lazily on first request, so importing this module in a unit test does not
// require the PB admin env vars (pb.ts throws at import without them).

import { Hono } from 'hono';
import { z } from 'zod';
import { HTTPException } from 'hono/http-exception';
import type { BrokerProvider } from '../providers/broker';
import type { BrokerConnectionsRepo } from '../db/brokerConnections';
import type { AccountsRepo } from '../db/accounts';
import type {
  BrokerConnection,
  BrokerConnectionCreate,
  BrokerConnectionUpdate,
  Account,
  AccountCreate,
} from '../db/schemas';

type Vars = { Variables: { uid: string; email: string; pbUserId: string } };

const BROKER = 'trading212' as const;
const ACCOUNT_LABEL = 'Trading 212';

/** Injected dependencies — narrowed to exactly the repo surface used here. */
export interface BrokerDeps {
  connections: Pick<
    BrokerConnectionsRepo,
    'getForUser' | 'create' | 'update' | 'delete'
  >;
  accounts: Pick<AccountsRepo, 'list' | 'create'>;
  provider: BrokerProvider;
  /** AES-encrypt the raw API key (prod: encryptSecret + T212_KEY_ENC_SECRET). */
  encrypt: (plain: string) => string;
  /**
   * Fire-and-forget hook run after a successful connect. In prod this triggers
   * the initial Trading 212 sync (Task 2.4). Defaults to a no-op so connect never
   * depends on sync existing.
   */
  onConnected?: (pbUserId: string) => void;
  /**
   * Run a Trading 212 sync for this user (Task 2.4 "Sync now"). Returns the sync
   * result. In prod this is bound to runTrading212Sync. The handler 404s before
   * calling this when the user has no connection, so a sync only ever runs for a
   * connected user.
   */
  sync?: (pbUserId: string) => Promise<unknown>;
}

const connectSchema = z.object({
  apiKey: z.string().min(1),
  apiSecret: z.string().min(1),
});

// --- handlers (deps-injected, HTTP-agnostic) --------------------------------

/**
 * Validate the credentials BEFORE storing anything. T212 uses HTTP Basic auth
 * `base64("<public>:<private>")`, and the provider takes the combined
 * "<public>:<private>" creds string — so we join the two fields with a ':' and
 * validate/encrypt/store that single combined value.
 *
 * On rejection throw a 400 and persist nothing. On success: AES-encrypt the
 * combined creds, upsert this user's broker_connections row (status connected,
 * account id + currency, last_error cleared), ensure a trading212 account
 * exists, then run the onConnected hook. Returns `{ ok: true }` and NEVER the
 * key.
 */
export async function connectTrading212With(
  pbUserId: string,
  input: { apiKey: string; apiSecret: string },
  deps: BrokerDeps,
): Promise<{ ok: true }> {
  const creds = `${input.apiKey}:${input.apiSecret}`;
  const validation = await deps.provider.validateKey(creds);
  if (!validation.ok) {
    throw new HTTPException(400, {
      res: Response.json({ error: 'invalid_api_key' }, { status: 400 }),
    });
  }

  const apiKeyEnc = deps.encrypt(creds);

  // Upsert the connection (the (user, broker) unique index → at most one row).
  const existing = await deps.connections.getForUser(pbUserId, BROKER);
  if (existing) {
    const patch: BrokerConnectionUpdate = {
      api_key_enc: apiKeyEnc,
      status: 'connected',
      t212_account_id: validation.accountId,
      currency: validation.currency,
      last_error: '', // clear any prior error on a fresh connect
    };
    await deps.connections.update(existing.id, patch);
  } else {
    const create: BrokerConnectionCreate = {
      user: pbUserId,
      broker: BROKER,
      api_key_enc: apiKeyEnc,
      status: 'connected',
      t212_account_id: validation.accountId,
      currency: validation.currency,
    };
    await deps.connections.create(create);
  }

  // Ensure a trading212 account exists so synced holdings have a home.
  await ensureTrading212Account(pbUserId, validation.currency, deps);

  // Trigger initial sync (implemented in a later task); never blocks connect.
  deps.onConnected?.(pbUserId);

  return { ok: true };
}

/** Create the user's trading212 account if they don't already have one. */
async function ensureTrading212Account(
  pbUserId: string,
  currency: string | undefined,
  deps: BrokerDeps,
): Promise<void> {
  const accounts = await deps.accounts.list(pbUserId);
  if (accounts.some((a: Account) => a.source === BROKER)) return;
  const create: AccountCreate = {
    user: pbUserId,
    source: BROKER,
    label: ACCOUNT_LABEL,
    currency,
  };
  await deps.accounts.create(create);
}

/** Connection status for the UI — derived from the row, NEVER exposing the key. */
export async function getTrading212StatusWith(
  pbUserId: string,
  deps: BrokerDeps,
): Promise<
  | { connected: false }
  | {
      connected: true;
      status?: BrokerConnection['status'];
      last_synced_at?: string;
      last_error?: string;
    }
> {
  const conn = await deps.connections.getForUser(pbUserId, BROKER);
  if (!conn) return { connected: false };
  // Whitelist the safe fields explicitly — never spread the row (would leak
  // api_key_enc).
  return {
    connected: true,
    status: conn.status,
    last_synced_at: conn.last_synced_at,
    last_error: conn.last_error,
  };
}

/** Delete this user's connection row. Holdings/accounts are left intact. */
export async function disconnectTrading212With(
  pbUserId: string,
  deps: BrokerDeps,
): Promise<{ ok: true }> {
  const conn = await deps.connections.getForUser(pbUserId, BROKER);
  if (!conn) {
    throw new HTTPException(404, {
      res: Response.json({ error: 'not_found' }, { status: 404 }),
    });
  }
  await deps.connections.delete(conn.id);
  return { ok: true };
}

/**
 * Trigger a sync for this user's Trading 212 connection ("Sync now", Task 2.4).
 *
 * Guards on the connection FIRST: a user with no connection gets a 404 (and the
 * sync never runs), so this can never sync against a missing/other user's
 * connection. Returns the sync result (counts) on success; the sync itself
 * stamps status=error + last_error on failure and rethrows, which the route's
 * error handler surfaces as a 500 without wiping data.
 */
export async function syncTrading212With(
  pbUserId: string,
  deps: BrokerDeps,
): Promise<unknown> {
  const conn = await deps.connections.getForUser(pbUserId, BROKER);
  if (!conn) {
    throw new HTTPException(404, {
      res: Response.json({ error: 'not_connected' }, { status: 404 }),
    });
  }
  if (!deps.sync) {
    throw new HTTPException(400, {
      res: Response.json({ error: 'sync_unavailable' }, { status: 400 }),
    });
  }
  return deps.sync(pbUserId);
}

// --- router factory ---------------------------------------------------------
// One router built from a deps RESOLVER so the prod router can resolve its deps
// lazily per request while tests pass a fixed deps object. Both paths run the
// exact same handlers + body validation (no duplication).

function parseConnectBody(body: unknown): { apiKey: string; apiSecret: string } {
  const parsed = connectSchema.safeParse(body);
  if (!parsed.success) {
    throw new HTTPException(400, {
      res: Response.json(
        { error: 'invalid_body', issues: parsed.error.issues },
        { status: 400 },
      ),
    });
  }
  return parsed.data;
}

function buildRouter(resolveDeps: () => BrokerDeps | Promise<BrokerDeps>) {
  return new Hono<Vars>()
    .post('/trading212/connect', async (c) => {
      const input = parseConnectBody(await c.req.json().catch(() => ({})));
      const result = await connectTrading212With(
        c.var.pbUserId,
        input,
        await resolveDeps(),
      );
      return c.json(result);
    })
    .get('/trading212/status', async (c) => {
      const status = await getTrading212StatusWith(
        c.var.pbUserId,
        await resolveDeps(),
      );
      return c.json(status);
    })
    .delete('/trading212', async (c) => {
      const result = await disconnectTrading212With(
        c.var.pbUserId,
        await resolveDeps(),
      );
      return c.json(result);
    })
    .post('/trading212/sync', async (c) => {
      const deps = await resolveDeps();
      let result: unknown;
      try {
        result = await syncTrading212With(c.var.pbUserId, deps);
      } catch (err) {
        // The sync service already stamps status='error' + last_error on the
        // connection, so the UI banner + toast surface the failure. Translate a
        // sync failure into a clean 502 instead of leaking a raw 500. (A 404 from
        // the no-connection guard is an HTTPException and rethrown untouched.)
        if (err instanceof HTTPException) throw err;
        const detail = err instanceof Error ? err.message : String(err);
        throw new HTTPException(502, {
          res: Response.json({ error: 'sync_failed', detail }, { status: 502 }),
        });
      }
      return c.json({ ok: true, result });
    });
}

/** Build a broker router bound to fixed deps (used directly in tests). */
export function makeBrokerRoutes(deps: BrokerDeps) {
  return buildRouter(() => deps);
}

// --- production binding ------------------------------------------------------
// Built LAZILY on first request so importing this module in a unit test does not
// require the PB admin env vars (db/* import pb.ts which throws without them).
let prodDeps: BrokerDeps | undefined;
async function getProdDeps(): Promise<BrokerDeps> {
  if (!prodDeps) {
    const { brokerConnectionsRepo } = await import('../db/brokerConnections');
    const { accountsRepo } = await import('../db/accounts');
    const { Trading212Provider } = await import('../providers/broker');
    const { encryptSecret } = await import('../lib/crypto');
    const { runTrading212Sync } = await import('../sync/trading212Sync');
    prodDeps = {
      connections: brokerConnectionsRepo,
      accounts: accountsRepo,
      provider: new Trading212Provider(),
      encrypt: (plain: string) => {
        const secret = process.env.T212_KEY_ENC_SECRET;
        if (!secret) {
          throw new Error('T212_KEY_ENC_SECRET is not set');
        }
        return encryptSecret(plain, secret);
      },
      sync: runTrading212Sync,
      // Initial sync on connect: fire-and-forget. A backfill of a long history
      // can take minutes (history is rate-limited to 6/min), so connect must NOT
      // await it. Any failure is swallowed + logged here — the sync itself has
      // already stamped status=error on the connection, so the UI surfaces it.
      onConnected: (pbUserId: string) => {
        void runTrading212Sync(pbUserId).catch((err) => {
          console.error(
            `[broker] initial Trading 212 sync failed for ${pbUserId}:`,
            err instanceof Error ? err.message : err,
          );
        });
      },
    };
  }
  return prodDeps;
}

/** Production router — resolves prod deps lazily per request. */
export const brokerRoutes = buildRouter(getProdDeps);
