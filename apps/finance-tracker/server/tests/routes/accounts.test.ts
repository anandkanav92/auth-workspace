import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

// In-memory accounts store backing the mocked repo. Each test resets it.
type Row = { id: string; user: string; source: string; label: string; currency?: string };
let rows: Row[] = [];

vi.mock('../../src/db/accounts', () => ({
  accountsRepo: {
    list: vi.fn(async (userId: string) => rows.filter((r) => r.user === userId)),
    get: vi.fn(async (id: string) => {
      const r = rows.find((x) => x.id === id);
      if (!r) throw Object.assign(new Error('not found'), { status: 404 });
      return r;
    }),
    create: vi.fn(async (data: Omit<Row, 'id'>) => {
      const r = { id: `acc-${rows.length + 1}`, ...data };
      rows.push(r);
      return r;
    }),
    update: vi.fn(async (id: string, patch: Partial<Row>) => {
      const r = rows.find((x) => x.id === id)!;
      Object.assign(r, patch);
      return r;
    }),
    delete: vi.fn(async (id: string) => {
      rows = rows.filter((x) => x.id !== id);
      return true;
    }),
  },
}));

import { accountRoutes } from '../../src/routes/accounts';
import { errorHandler } from '../../src/middleware/errorHandler';

/** Build a test app that injects `pbUserId` as the authed user. */
function appAs(pbUserId: string) {
  const app = new Hono();
  app.onError(errorHandler);
  app.use('/api/*', async (c, next) => {
    c.set('uid', `fb-${pbUserId}`);
    c.set('email', `${pbUserId}@test`);
    c.set('pbUserId', pbUserId);
    await next();
  });
  app.route('/api/accounts', accountRoutes);
  return app;
}

beforeEach(() => {
  rows = [];
});

describe('POST /api/accounts', () => {
  it('creates an account owned by the authed user (ignores body.user)', async () => {
    const app = appAs('u1');
    const res = await app.request('/api/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // attempt to spoof another owner — must be ignored
      body: JSON.stringify({ source: 'manual', label: 'Mine', user: 'EVIL' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.user).toBe('u1');
    expect(body.label).toBe('Mine');
  });

  it('400 on an invalid body', async () => {
    const app = appAs('u1');
    const res = await app.request('/api/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'not-a-broker', label: '' }),
    });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/accounts', () => {
  it('returns only the authed user rows', async () => {
    rows = [
      { id: 'a1', user: 'u1', source: 'manual', label: 'A1' },
      { id: 'b1', user: 'u2', source: 'manual', label: 'B1' },
    ];
    const res = await appAs('u1').request('/api/accounts');
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].label).toBe('A1');
  });
});

describe('IDOR: cross-user access by id → 404', () => {
  beforeEach(() => {
    rows = [{ id: 'b1', user: 'u2', source: 'manual', label: "B's account" }];
  });

  it('user u1 CANNOT PATCH user u2 account (404, not modified)', async () => {
    const res = await appAs('u1').request('/api/accounts/b1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: 'hacked' }),
    });
    expect(res.status).toBe(404);
    expect(rows[0].label).toBe("B's account"); // untouched
  });

  it('user u1 CANNOT DELETE user u2 account (404, still present)', async () => {
    const res = await appAs('u1').request('/api/accounts/b1', { method: 'DELETE' });
    expect(res.status).toBe(404);
    expect(rows.find((r) => r.id === 'b1')).toBeTruthy(); // not deleted
  });

  it('the owner CAN PATCH + DELETE their own account', async () => {
    const patch = await appAs('u2').request('/api/accounts/b1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: 'renamed' }),
    });
    expect(patch.status).toBe(200);
    expect(rows[0].label).toBe('renamed');

    const del = await appAs('u2').request('/api/accounts/b1', { method: 'DELETE' });
    expect(del.status).toBe(200);
    expect(rows.find((r) => r.id === 'b1')).toBeUndefined();
  });
});
