import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

// The crypto helper reads its key from T212_KEY_ENC_SECRET; set a valid 32-byte
// (64 hex char) key before importing anything that touches encryptSecret.
process.env.T212_KEY_ENC_SECRET = 'a'.repeat(64);

import { encryptSecret, decryptSecret } from '../../src/lib/crypto';
import type { BrokerDeps } from '../../src/routes/broker';
import {
  connectTrading212With,
  getTrading212StatusWith,
  disconnectTrading212With,
  syncTrading212With,
  makeBrokerRoutes,
} from '../../src/routes/broker';
import type { BrokerConnection, Account } from '../../src/db/schemas';
import { errorHandler } from '../../src/middleware/errorHandler';

// --- in-memory fakes --------------------------------------------------------
// Per-user stores so we can assert isolation and that an invalid key writes
// nothing. The fakes mirror the real repos' user-scoped surface.

const HEX_KEY = 'a'.repeat(64);

function makeFakes() {
  let connections: BrokerConnection[] = [];
  let accounts: Account[] = [];
  let connSeq = 0;
  let accSeq = 0;

  const connectionsRepo = {
    getForUser: vi.fn(async (userId: string, broker: string) =>
      connections.find((c) => c.user === userId && c.broker === broker) ?? null,
    ),
    create: vi.fn(async (data: Partial<BrokerConnection>) => {
      const row = {
        id: `conn-${++connSeq}`,
        created: '',
        updated: '',
        ...data,
      } as BrokerConnection;
      connections.push(row);
      return row;
    }),
    update: vi.fn(async (id: string, patch: Partial<BrokerConnection>) => {
      const row = connections.find((c) => c.id === id)!;
      Object.assign(row, patch);
      return row;
    }),
    delete: vi.fn(async (id: string) => {
      const before = connections.length;
      connections = connections.filter((c) => c.id !== id);
      return connections.length < before;
    }),
  };

  const accountsRepo = {
    list: vi.fn(async (userId: string) =>
      accounts.filter((a) => a.user === userId),
    ),
    create: vi.fn(async (data: Partial<Account>) => {
      const row = {
        id: `acc-${++accSeq}`,
        created: '',
        updated: '',
        ...data,
      } as Account;
      accounts.push(row);
      return row;
    }),
  };

  return {
    connectionsRepo,
    accountsRepo,
    peek: { connections: () => connections, accounts: () => accounts },
  };
}

function depsFrom(
  fakes: ReturnType<typeof makeFakes>,
  provider: BrokerDeps['provider'],
  extra?: Partial<Pick<BrokerDeps, 'sync' | 'onConnected'>>,
): BrokerDeps {
  return {
    connections: fakes.connectionsRepo,
    accounts: fakes.accountsRepo,
    provider,
    // Re-implements the prod wiring (encryptSecret + env key) so the unit test
    // exercises real encryption rather than a stub.
    encrypt: (plain: string) => encryptSecret(plain, HEX_KEY),
    ...extra,
  };
}

function okProvider(over?: { accountId?: string; currency?: string }) {
  return {
    validateKey: vi.fn(async () => ({
      ok: true,
      accountId: over?.accountId ?? 't212-acct-1',
      currency: over?.currency ?? 'EUR',
    })),
  };
}

function rejectingProvider() {
  return { validateKey: vi.fn(async () => ({ ok: false })) };
}

// --- connect handler --------------------------------------------------------

describe('connectTrading212With', () => {
  it('combines both keys, validates, then stores the ENCRYPTED combined creds and returns ok (never the key)', async () => {
    const fakes = makeFakes();
    const provider = okProvider({ accountId: 'acct-9', currency: 'GBP' });
    const deps = depsFrom(fakes, provider);

    const PUB = 'public-key-123';
    const PRIV = 'private-secret-456';
    const COMBINED = `${PUB}:${PRIV}`;
    const result = await connectTrading212With(
      'u1',
      { apiKey: PUB, apiSecret: PRIV },
      deps,
    );

    // T212 Basic auth → provider sees the combined "<public>:<private>" string.
    expect(provider.validateKey).toHaveBeenCalledWith(COMBINED);
    expect(result).toEqual({ ok: true });
    // never echoes either key in any form
    expect(JSON.stringify(result)).not.toContain(PUB);
    expect(JSON.stringify(result)).not.toContain(PRIV);

    const stored = fakes.peek.connections();
    expect(stored).toHaveLength(1);
    const conn = stored[0];
    // stored value must be the ciphertext, NOT the raw creds
    expect(conn.api_key_enc).not.toBe(COMBINED);
    expect(conn.api_key_enc).not.toContain(PUB);
    expect(conn.api_key_enc).not.toContain(PRIV);
    // and it must round-trip back to the combined "pub:priv" creds
    expect(decryptSecret(conn.api_key_enc, HEX_KEY)).toBe(COMBINED);

    expect(conn).toMatchObject({
      user: 'u1',
      broker: 'trading212',
      status: 'connected',
      t212_account_id: 'acct-9',
      currency: 'GBP',
    });
  });

  it('creates a trading212 account when the user has none', async () => {
    const fakes = makeFakes();
    const deps = depsFrom(fakes, okProvider());

    await connectTrading212With('u1', { apiKey: 'k', apiSecret: 's' }, deps);

    const accts = fakes.peek.accounts();
    expect(accts).toHaveLength(1);
    expect(accts[0]).toMatchObject({ user: 'u1', source: 'trading212' });
  });

  it('does not create a second account when a trading212 account already exists', async () => {
    const fakes = makeFakes();
    // seed an existing trading212 account
    await fakes.accountsRepo.create({
      user: 'u1',
      source: 'trading212',
      label: 'Trading 212',
    } as Partial<Account>);
    const deps = depsFrom(fakes, okProvider());

    await connectTrading212With('u1', { apiKey: 'k', apiSecret: 's' }, deps);

    expect(
      fakes.peek.accounts().filter((a) => a.source === 'trading212'),
    ).toHaveLength(1);
  });

  it('updates the existing connection row on reconnect (clears last_error)', async () => {
    const fakes = makeFakes();
    await fakes.connectionsRepo.create({
      user: 'u1',
      broker: 'trading212',
      api_key_enc: 'old',
      status: 'error',
      last_error: 'API access blocked',
    } as Partial<BrokerConnection>);
    const deps = depsFrom(fakes, okProvider());

    await connectTrading212With(
      'u1',
      { apiKey: 'new-pub', apiSecret: 'new-priv' },
      deps,
    );

    const stored = fakes.peek.connections();
    expect(stored).toHaveLength(1); // upsert, not a duplicate
    expect(stored[0].status).toBe('connected');
    expect(stored[0].last_error ?? '').toBe('');
    expect(decryptSecret(stored[0].api_key_enc, HEX_KEY)).toBe(
      'new-pub:new-priv',
    );
  });

  it('rejects an invalid key with 400 and stores NOTHING', async () => {
    const fakes = makeFakes();
    const provider = rejectingProvider();
    const deps = depsFrom(fakes, provider);

    await expect(
      connectTrading212With('u1', { apiKey: 'bad', apiSecret: 'creds' }, deps),
    ).rejects.toMatchObject({ status: 400 });

    expect(provider.validateKey).toHaveBeenCalledWith('bad:creds');
    expect(fakes.peek.connections()).toHaveLength(0);
    expect(fakes.peek.accounts()).toHaveLength(0);
  });

  it('calls the onConnected hook after a successful connect', async () => {
    const fakes = makeFakes();
    const onConnected = vi.fn();
    const deps = { ...depsFrom(fakes, okProvider()), onConnected };

    await connectTrading212With('u1', { apiKey: 'k', apiSecret: 's' }, deps);

    expect(onConnected).toHaveBeenCalledWith('u1');
  });
});

// --- status handler ---------------------------------------------------------

describe('getTrading212StatusWith', () => {
  it('returns { connected: false } when there is no connection', async () => {
    const fakes = makeFakes();
    const deps = depsFrom(fakes, okProvider());
    expect(await getTrading212StatusWith('u1', deps)).toEqual({
      connected: false,
    });
  });

  it('reflects status / last_synced_at / last_error and NEVER leaks the key', async () => {
    const fakes = makeFakes();
    await fakes.connectionsRepo.create({
      user: 'u1',
      broker: 'trading212',
      api_key_enc: 'ciphertext-here',
      status: 'error',
      last_synced_at: '2026-06-07T10:00:00Z',
      last_error: 'API access blocked',
    } as Partial<BrokerConnection>);
    const deps = depsFrom(fakes, okProvider());

    const status = await getTrading212StatusWith('u1', deps);
    expect(status).toEqual({
      connected: true,
      status: 'error',
      last_synced_at: '2026-06-07T10:00:00Z',
      last_error: 'API access blocked',
    });
    // the response must not contain the encrypted key field at all
    expect(status).not.toHaveProperty('api_key_enc');
    expect(JSON.stringify(status)).not.toContain('ciphertext-here');
  });
});

// --- disconnect handler -----------------------------------------------------

describe('disconnectTrading212With', () => {
  it('deletes the connection row, leaving accounts intact', async () => {
    const fakes = makeFakes();
    await fakes.connectionsRepo.create({
      user: 'u1',
      broker: 'trading212',
      api_key_enc: 'x',
      status: 'connected',
    } as Partial<BrokerConnection>);
    await fakes.accountsRepo.create({
      user: 'u1',
      source: 'trading212',
      label: 'Trading 212',
    } as Partial<Account>);
    const deps = depsFrom(fakes, okProvider());

    const result = await disconnectTrading212With('u1', deps);
    expect(result).toEqual({ ok: true });
    expect(fakes.peek.connections()).toHaveLength(0);
    // accounts (and therefore holdings) are untouched
    expect(fakes.peek.accounts()).toHaveLength(1);
  });

  it('404s when the user has no connection', async () => {
    const fakes = makeFakes();
    const deps = depsFrom(fakes, okProvider());
    await expect(disconnectTrading212With('u1', deps)).rejects.toMatchObject({
      status: 404,
    });
  });
});

// --- sync-now handler -------------------------------------------------------

describe('syncTrading212With (fire-and-forget)', () => {
  it('kicks off the sync for a connected user and returns started without awaiting it', async () => {
    const fakes = makeFakes();
    await fakes.connectionsRepo.create({
      user: 'u1',
      broker: 'trading212',
      api_key_enc: 'x',
      status: 'connected',
    } as Partial<BrokerConnection>);
    // A sync that never resolves: if syncTrading212With awaited it, this would
    // hang. We assert it returns immediately anyway.
    const sync = vi.fn(() => new Promise<unknown>(() => {}));
    const deps = depsFrom(fakes, okProvider(), { sync });

    const result = await syncTrading212With('u1', deps);
    expect(sync).toHaveBeenCalledWith('u1');
    expect(result).toEqual({ ok: true, started: true });
  });

  it('returns started even when the (un-awaited) sync rejects', async () => {
    const fakes = makeFakes();
    await fakes.connectionsRepo.create({
      user: 'u1',
      broker: 'trading212',
      api_key_enc: 'x',
      status: 'connected',
    } as Partial<BrokerConnection>);
    const sync = vi.fn(async () => {
      throw new Error('orders fetch failed (status 500)');
    });
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const deps = depsFrom(fakes, okProvider(), { sync });

    const result = await syncTrading212With('u1', deps);
    expect(result).toEqual({ ok: true, started: true });
    // Let the rejected microtask settle so its .catch handler runs.
    await Promise.resolve();
    await Promise.resolve();
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it('404s (and never starts the sync) when the user has no connection', async () => {
    const fakes = makeFakes();
    const sync = vi.fn(async () => ({ positions: 0, orders: 0, dividends: 0 }));
    const deps = depsFrom(fakes, okProvider(), { sync });

    await expect(syncTrading212With('u1', deps)).rejects.toMatchObject({
      status: 404,
    });
    expect(sync).not.toHaveBeenCalled();
  });

  it('409s (already_syncing, never starts a second sync) when status=syncing & recent', async () => {
    const fakes = makeFakes();
    const NOW = Date.parse('2026-06-08T12:10:00.000Z');
    // Updated 5 min ago — well within the 15-min lock TTL.
    await fakes.connectionsRepo.create({
      user: 'u1',
      broker: 'trading212',
      api_key_enc: 'x',
      status: 'syncing',
      updated: '2026-06-08T12:05:00.000Z',
    } as Partial<BrokerConnection>);
    const sync = vi.fn(async () => ({ positions: 0, orders: 0, dividends: 0 }));
    const deps = depsFrom(fakes, okProvider(), { sync });
    deps.now = () => NOW;

    await expect(syncTrading212With('u1', deps)).rejects.toMatchObject({
      status: 409,
    });
    expect(sync).not.toHaveBeenCalled();
  });

  it('starts a sync when status=syncing but STALE (lock TTL elapsed → presumed dead)', async () => {
    const fakes = makeFakes();
    const NOW = Date.parse('2026-06-08T12:30:00.000Z');
    // Updated 25 min ago — past the 15-min lock TTL, so not a live lock.
    await fakes.connectionsRepo.create({
      user: 'u1',
      broker: 'trading212',
      api_key_enc: 'x',
      status: 'syncing',
      updated: '2026-06-08T12:05:00.000Z',
    } as Partial<BrokerConnection>);
    const sync = vi.fn(() => new Promise<unknown>(() => {}));
    const deps = depsFrom(fakes, okProvider(), { sync });
    deps.now = () => NOW;

    const result = await syncTrading212With('u1', deps);
    expect(result).toEqual({ ok: true, started: true });
    expect(sync).toHaveBeenCalledWith('u1');
  });

  it('starts a sync when status=connected (no lock)', async () => {
    const fakes = makeFakes();
    await fakes.connectionsRepo.create({
      user: 'u1',
      broker: 'trading212',
      api_key_enc: 'x',
      status: 'connected',
      updated: '2026-06-08T12:05:00.000Z',
    } as Partial<BrokerConnection>);
    const sync = vi.fn(() => new Promise<unknown>(() => {}));
    const deps = depsFrom(fakes, okProvider(), { sync });
    deps.now = () => Date.parse('2026-06-08T12:06:00.000Z');

    const result = await syncTrading212With('u1', deps);
    expect(result).toEqual({ ok: true, started: true });
    expect(sync).toHaveBeenCalledWith('u1');
  });

  it('starts a sync when status=error (no lock)', async () => {
    const fakes = makeFakes();
    await fakes.connectionsRepo.create({
      user: 'u1',
      broker: 'trading212',
      api_key_enc: 'x',
      status: 'error',
      last_error: 'ip_blocked',
      updated: '2026-06-08T12:05:00.000Z',
    } as Partial<BrokerConnection>);
    const sync = vi.fn(() => new Promise<unknown>(() => {}));
    const deps = depsFrom(fakes, okProvider(), { sync });

    const result = await syncTrading212With('u1', deps);
    expect(result).toEqual({ ok: true, started: true });
    expect(sync).toHaveBeenCalledWith('u1');
  });
});

// --- HTTP wiring + per-user isolation ---------------------------------------
// Drive the mounted router over HTTP with a shimmed auth middleware (mirrors the
// other route tests) to confirm c.var.pbUserId scoping and the JSON contract.

function appAs(deps: BrokerDeps, pbUserId: string) {
  const app = new Hono();
  app.onError(errorHandler);
  app.use('/api/*', async (c, next) => {
    c.set('uid', `fb-${pbUserId}`);
    c.set('email', `${pbUserId}@test`);
    c.set('pbUserId', pbUserId);
    await next();
  });
  app.route('/api/broker', makeBrokerRoutes(deps));
  return app;
}

describe('broker routes over HTTP (user-scoped)', () => {
  let fakes: ReturnType<typeof makeFakes>;
  let deps: BrokerDeps;

  beforeEach(() => {
    fakes = makeFakes();
    deps = depsFrom(fakes, okProvider());
  });

  it('POST /trading212/connect returns ok and never either key', async () => {
    const app = appAs(deps, 'u1');
    const res = await app.request('/api/broker/trading212/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: 'pub-123', apiSecret: 'priv-456' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true });
    expect(JSON.stringify(body)).not.toContain('pub-123');
    expect(JSON.stringify(body)).not.toContain('priv-456');
  });

  it('POST /trading212/connect with an empty apiKey is a 400 (zod)', async () => {
    const app = appAs(deps, 'u1');
    const res = await app.request('/api/broker/trading212/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: '', apiSecret: 's' }),
    });
    expect(res.status).toBe(400);
    expect(fakes.peek.connections()).toHaveLength(0);
  });

  it('POST /trading212/connect with an empty apiSecret is a 400 (zod)', async () => {
    const app = appAs(deps, 'u1');
    const res = await app.request('/api/broker/trading212/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: 'pub', apiSecret: '' }),
    });
    expect(res.status).toBe(400);
    expect(fakes.peek.connections()).toHaveLength(0);
  });

  it('GET /trading212/status never includes api_key_enc', async () => {
    // u1 connects, then reads status
    await connectTrading212With('u1', { apiKey: 'secret', apiSecret: 'priv' }, deps);
    const app = appAs(deps, 'u1');
    const res = await app.request('/api/broker/trading212/status');
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).not.toContain('api_key_enc');
    expect(text).not.toContain('secret');
    expect(JSON.parse(text)).toMatchObject({ connected: true });
  });

  it('IDOR: user B cannot see or delete user A\'s connection', async () => {
    await connectTrading212With('userA', { apiKey: 'a-key', apiSecret: 'a-sec' }, deps);

    // user B reads status → not connected (scoped to B)
    const appB = appAs(deps, 'userB');
    const statusRes = await appB.request('/api/broker/trading212/status');
    expect(await statusRes.json()).toEqual({ connected: false });

    // user B disconnects → 404, and user A's row survives
    const delRes = await appB.request('/api/broker/trading212', {
      method: 'DELETE',
    });
    expect(delRes.status).toBe(404);
    expect(
      fakes.peek.connections().filter((c) => c.user === 'userA'),
    ).toHaveLength(1);
  });

  it('DELETE /trading212 removes the authed user\'s row', async () => {
    await connectTrading212With('u1', { apiKey: 'k', apiSecret: 's' }, deps);
    const app = appAs(deps, 'u1');
    const res = await app.request('/api/broker/trading212', { method: 'DELETE' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(fakes.peek.connections()).toHaveLength(0);
  });

  it('POST /trading212/sync kicks off the sync and returns 202 started (fire-and-forget)', async () => {
    const sync = vi.fn(async () => ({ positions: 1, orders: 0, dividends: 0 }));
    const syncDeps = depsFrom(fakes, okProvider(), { sync });
    await connectTrading212With('u1', { apiKey: 'k', apiSecret: 's' }, syncDeps);
    const app = appAs(syncDeps, 'u1');

    const res = await app.request('/api/broker/trading212/sync', {
      method: 'POST',
    });
    // Fire-and-forget: a full-history sync can exceed Cloudflare's 100s request
    // timeout, so the endpoint returns immediately and the sync runs in the
    // background (it records status/last_error on the connection itself).
    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ ok: true, started: true });
    expect(sync).toHaveBeenCalledWith('u1');
  });

  it('POST /trading212/sync still returns 202 even when the un-awaited sync rejects', async () => {
    const sync = vi.fn(async () => {
      throw new Error('orders fetch failed (status 500)');
    });
    const syncDeps = depsFrom(fakes, okProvider(), { sync });
    await connectTrading212With('u1', { apiKey: 'k', apiSecret: 's' }, syncDeps);
    const app = appAs(syncDeps, 'u1');

    const res = await app.request('/api/broker/trading212/sync', {
      method: 'POST',
    });
    // The rejection is caught + logged (and recorded on the connection as
    // status=error); it must NOT surface as a 5xx on this endpoint.
    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ ok: true, started: true });
  });

  it('POST /trading212/sync is a 409 already_syncing when a recent sync is in flight', async () => {
    const sync = vi.fn(() => new Promise<unknown>(() => {}));
    const syncDeps = depsFrom(fakes, okProvider(), { sync });
    syncDeps.now = () => Date.parse('2026-06-08T12:06:00.000Z');
    await fakes.connectionsRepo.create({
      user: 'u1',
      broker: 'trading212',
      api_key_enc: 'x',
      status: 'syncing',
      updated: '2026-06-08T12:05:00.000Z',
    } as Partial<BrokerConnection>);
    const app = appAs(syncDeps, 'u1');

    const res = await app.request('/api/broker/trading212/sync', {
      method: 'POST',
    });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'already_syncing' });
    expect(sync).not.toHaveBeenCalled();
  });

  it('POST /trading212/sync is a 404 when the user has no connection', async () => {
    const sync = vi.fn();
    const syncDeps = depsFrom(fakes, okProvider(), { sync });
    const app = appAs(syncDeps, 'u1');

    const res = await app.request('/api/broker/trading212/sync', {
      method: 'POST',
    });
    expect(res.status).toBe(404);
    expect(sync).not.toHaveBeenCalled();
  });
});
