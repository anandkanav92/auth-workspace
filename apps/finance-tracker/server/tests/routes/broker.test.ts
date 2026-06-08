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
): BrokerDeps {
  return {
    connections: fakes.connectionsRepo,
    accounts: fakes.accountsRepo,
    provider,
    // Re-implements the prod wiring (encryptSecret + env key) so the unit test
    // exercises real encryption rather than a stub.
    encrypt: (plain: string) => encryptSecret(plain, HEX_KEY),
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
  it('validates the key, then stores an ENCRYPTED key and returns ok (never the key)', async () => {
    const fakes = makeFakes();
    const provider = okProvider({ accountId: 'acct-9', currency: 'GBP' });
    const deps = depsFrom(fakes, provider);

    const RAW = 'super-secret-api-key';
    const result = await connectTrading212With('u1', { apiKey: RAW }, deps);

    expect(provider.validateKey).toHaveBeenCalledWith(RAW);
    expect(result).toEqual({ ok: true });
    // never echoes the key in any form
    expect(JSON.stringify(result)).not.toContain(RAW);

    const stored = fakes.peek.connections();
    expect(stored).toHaveLength(1);
    const conn = stored[0];
    // stored value must be the ciphertext, NOT the raw key
    expect(conn.api_key_enc).not.toBe(RAW);
    expect(conn.api_key_enc).not.toContain(RAW);
    // and it must round-trip back to the raw key
    expect(decryptSecret(conn.api_key_enc, HEX_KEY)).toBe(RAW);

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

    await connectTrading212With('u1', { apiKey: 'k' }, deps);

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

    await connectTrading212With('u1', { apiKey: 'k' }, deps);

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

    await connectTrading212With('u1', { apiKey: 'new-key' }, deps);

    const stored = fakes.peek.connections();
    expect(stored).toHaveLength(1); // upsert, not a duplicate
    expect(stored[0].status).toBe('connected');
    expect(stored[0].last_error ?? '').toBe('');
    expect(decryptSecret(stored[0].api_key_enc, HEX_KEY)).toBe('new-key');
  });

  it('rejects an invalid key with 400 and stores NOTHING', async () => {
    const fakes = makeFakes();
    const provider = rejectingProvider();
    const deps = depsFrom(fakes, provider);

    await expect(
      connectTrading212With('u1', { apiKey: 'bad' }, deps),
    ).rejects.toMatchObject({ status: 400 });

    expect(provider.validateKey).toHaveBeenCalledWith('bad');
    expect(fakes.peek.connections()).toHaveLength(0);
    expect(fakes.peek.accounts()).toHaveLength(0);
  });

  it('calls the onConnected hook after a successful connect', async () => {
    const fakes = makeFakes();
    const onConnected = vi.fn();
    const deps = { ...depsFrom(fakes, okProvider()), onConnected };

    await connectTrading212With('u1', { apiKey: 'k' }, deps);

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

  it('POST /trading212/connect returns ok and never the key', async () => {
    const app = appAs(deps, 'u1');
    const res = await app.request('/api/broker/trading212/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: 'raw-key-123' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true });
    expect(JSON.stringify(body)).not.toContain('raw-key-123');
  });

  it('POST /trading212/connect with an empty apiKey is a 400 (zod)', async () => {
    const app = appAs(deps, 'u1');
    const res = await app.request('/api/broker/trading212/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: '' }),
    });
    expect(res.status).toBe(400);
    expect(fakes.peek.connections()).toHaveLength(0);
  });

  it('GET /trading212/status never includes api_key_enc', async () => {
    // u1 connects, then reads status
    await connectTrading212With('u1', { apiKey: 'secret' }, deps);
    const app = appAs(deps, 'u1');
    const res = await app.request('/api/broker/trading212/status');
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).not.toContain('api_key_enc');
    expect(text).not.toContain('secret');
    expect(JSON.parse(text)).toMatchObject({ connected: true });
  });

  it('IDOR: user B cannot see or delete user A\'s connection', async () => {
    await connectTrading212With('userA', { apiKey: 'a-key' }, deps);

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
    await connectTrading212With('u1', { apiKey: 'k' }, deps);
    const app = appAs(deps, 'u1');
    const res = await app.request('/api/broker/trading212', { method: 'DELETE' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(fakes.peek.connections()).toHaveLength(0);
  });
});
