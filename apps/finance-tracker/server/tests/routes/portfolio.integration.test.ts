// INTEGRATION TEST (not a unit test): drives the real M5 route handlers against
// a locally-spawned PocketBase v0.23.11 with our committed migrations applied
// (see tests/pb-test-server.ts globalSetup). The repos go through pbAdmin()
// (admin token) which BYPASSES PocketBase rules — so this suite is the
// end-to-end proof that the route layer's requireOwned ownership checks hold.
//
// Auth is shimmed: instead of verifying a Firebase token, a test middleware maps
// the `X-Test-User` header to a real PocketBase users-collection id (resolved by
// authenticating the seeded test users). Everything below that — routes, repos,
// PocketBase writes, the transactions audit log — is the production path.

import { describe, it, expect, beforeAll } from 'vitest';
import { Hono } from 'hono';
import PocketBase from 'pocketbase';
import { USER_A, USER_B } from '../pb-test-server';
import { accountRoutes } from '../../src/routes/accounts';
import { holdingRoutes } from '../../src/routes/holdings';
import { transactionRoutes } from '../../src/routes/transactions';
import { errorHandler } from '../../src/middleware/errorHandler';

const PB_URL = process.env.PB_URL!;

let userAId: string;
let userBId: string;
let app: Hono;

beforeAll(async () => {
  const pbA = new PocketBase(PB_URL);
  const pbB = new PocketBase(PB_URL);
  await pbA.collection('users').authWithPassword(USER_A.email, USER_A.password);
  await pbB.collection('users').authWithPassword(USER_B.email, USER_B.password);
  userAId = pbA.authStore.record!.id;
  userBId = pbB.authStore.record!.id;

  app = new Hono();
  app.onError(errorHandler);
  // Auth shim: map X-Test-User → that user's PocketBase id.
  app.use('/api/*', async (c, next) => {
    const who = c.req.header('X-Test-User');
    const pbUserId = who === 'B' ? userBId : userAId;
    c.set('uid', `fb-${who ?? 'A'}`);
    c.set('email', `${who ?? 'A'}@test`);
    c.set('pbUserId', pbUserId);
    await next();
  });
  app.route('/api/accounts', accountRoutes);
  app.route('/api/holdings', holdingRoutes);
  app.route('/api/transactions', transactionRoutes);
});

// --- tiny typed fetch helpers over the in-process Hono app ------------------
async function api(
  method: string,
  path: string,
  opts: { body?: unknown; user?: 'A' | 'B' } = {},
) {
  const headers: Record<string, string> = { 'X-Test-User': opts.user ?? 'A' };
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await app.request(path, {
    method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  return res;
}

describe('M5 portfolio lifecycle (E2E against real PocketBase)', () => {
  it('account → add → adjust → sell yields 3 transactions and correct holding state', async () => {
    // 1. Create an account.
    const accRes = await api('POST', '/api/accounts', {
      body: { source: 'manual', label: 'E2E Lifecycle' },
    });
    expect(accRes.status).toBe(201);
    const acc = await accRes.json();
    expect(acc.user).toBe(userAId);

    // 2. Add a holding (writes a buy tx + creates the holding).
    const addRes = await api('POST', '/api/holdings', {
      body: {
        account: acc.id,
        ticker: 'AAPL',
        quantity: 10,
        cost_basis: 1500,
        cost_currency: 'EUR',
      },
    });
    expect(addRes.status).toBe(201);
    const holding = await addRes.json();
    expect(holding.quantity).toBe(10);
    expect(holding.cost_basis).toBe(1500);

    // 3. Adjust quantity (writes an adjustment tx + recompute).
    const adjRes = await api('PATCH', `/api/holdings/${holding.id}`, {
      body: { quantity: 12 },
    });
    expect(adjRes.status).toBe(200);
    const adjusted = await adjRes.json();
    expect(adjusted.quantity).toBe(12);
    expect(adjusted.cost_basis).toBeCloseTo(1800, 2); // 150/share preserved

    // 4. Partial sell (writes a sell tx + decrements).
    const sellRes = await api('POST', `/api/holdings/${holding.id}/sell`, {
      body: { quantity: 5, price: 180, currency: 'USD' },
    });
    expect(sellRes.status).toBe(200);
    const sold = await sellRes.json();
    expect(sold.quantity).toBe(7);
    expect(sold.cost_basis).toBeCloseTo(1800 * (7 / 12), 2);

    // 5. Exactly three transactions logged for this account: buy + adjustment + sell.
    const txRes = await api('GET', `/api/transactions?accountId=${acc.id}`);
    const txBody = await txRes.json();
    expect(txBody.items).toHaveLength(3);
    const types = txBody.items.map((t: { type: string }) => t.type).sort();
    expect(types).toEqual(['adjustment', 'buy', 'sell']);

    // 6. Holdings list still shows the open position.
    const hRes = await api('GET', `/api/holdings?accountId=${acc.id}`);
    const holdings = await hRes.json();
    expect(holdings).toHaveLength(1);
    expect(holdings[0].quantity).toBe(7);
  });

  it('weighted-average upsert: re-adding the same ticker sums qty + total cost', async () => {
    const acc = await (
      await api('POST', '/api/accounts', { body: { source: 'manual', label: 'WAvg' } })
    ).json();

    await api('POST', '/api/holdings', {
      body: { account: acc.id, ticker: 'MSFT', quantity: 10, cost_basis: 4000, cost_currency: 'EUR' },
    });
    const second = await (
      await api('POST', '/api/holdings', {
        body: { account: acc.id, ticker: 'MSFT', quantity: 5, cost_basis: 2500, cost_currency: 'EUR' },
      })
    ).json();

    expect(second.quantity).toBe(15);
    expect(second.cost_basis).toBe(6500); // 4000 + 2500 totals
    const holdings = await (await api('GET', `/api/holdings?accountId=${acc.id}`)).json();
    expect(holdings.filter((h: { ticker: string }) => h.ticker === 'MSFT')).toHaveLength(1);
  });

  it('full sell (DELETE) closes the position (quantity 0, excluded from list)', async () => {
    const acc = await (
      await api('POST', '/api/accounts', { body: { source: 'manual', label: 'FullSell' } })
    ).json();
    const h = await (
      await api('POST', '/api/holdings', {
        body: { account: acc.id, ticker: 'NVDA', quantity: 4, cost_basis: 2000, cost_currency: 'EUR' },
      })
    ).json();

    const del = await api('DELETE', `/api/holdings/${h.id}`, {
      body: { price: 600, currency: 'USD' },
    });
    expect(del.status).toBe(200);

    const open = await (await api('GET', `/api/holdings?accountId=${acc.id}`)).json();
    expect(open).toHaveLength(0); // closed (quantity 0) filtered out
  });
});

describe('M5 cross-user IDOR enforcement (real PocketBase, admin repo bypasses rules)', () => {
  let bAccountId: string;
  let bHoldingId: string;

  beforeAll(async () => {
    // User B creates an account + holding through the real route handlers.
    const acc = await (
      await api('POST', '/api/accounts', { user: 'B', body: { source: 'manual', label: "B private" } })
    ).json();
    bAccountId = acc.id;
    const h = await (
      await api('POST', '/api/holdings', {
        user: 'B',
        body: { account: acc.id, ticker: 'TSLA', quantity: 3, cost_basis: 900, cost_currency: 'EUR' },
      })
    ).json();
    bHoldingId = h.id;
  });

  // --- accounts ---
  it('A cannot PATCH B account by id → 404', async () => {
    const res = await api('PATCH', `/api/accounts/${bAccountId}`, {
      user: 'A',
      body: { label: 'pwned' },
    });
    expect(res.status).toBe(404);
  });

  it('A cannot DELETE B account by id → 404 (still exists for B)', async () => {
    const res = await api('DELETE', `/api/accounts/${bAccountId}`, { user: 'A' });
    expect(res.status).toBe(404);
    const bSees = await (await api('GET', '/api/accounts', { user: 'B' })).json();
    expect(bSees.find((a: { id: string }) => a.id === bAccountId)).toBeTruthy();
  });

  // --- holdings ---
  it('A cannot PATCH B holding by id → 404', async () => {
    const res = await api('PATCH', `/api/holdings/${bHoldingId}`, {
      user: 'A',
      body: { quantity: 999 },
    });
    expect(res.status).toBe(404);
  });

  it('A cannot SELL B holding by id → 404', async () => {
    const res = await api('POST', `/api/holdings/${bHoldingId}/sell`, {
      user: 'A',
      body: { quantity: 1, price: 1, currency: 'USD' },
    });
    expect(res.status).toBe(404);
  });

  it('A cannot DELETE (full-sell) B holding by id → 404', async () => {
    const res = await api('DELETE', `/api/holdings/${bHoldingId}`, {
      user: 'A',
      body: { price: 1, currency: 'USD' },
    });
    expect(res.status).toBe(404);
  });

  it("B's holding is untouched after A's failed attempts", async () => {
    const bSees = await (
      await api('GET', `/api/holdings?accountId=${bAccountId}`, { user: 'B' })
    ).json();
    const tsla = bSees.find((h: { ticker: string }) => h.ticker === 'TSLA');
    expect(tsla.quantity).toBe(3); // unchanged
  });

  it('A cannot add a holding into B account (IDOR via account id) → 404', async () => {
    const res = await api('POST', '/api/holdings', {
      user: 'A',
      body: { account: bAccountId, ticker: 'EVIL', quantity: 1, cost_basis: 1, cost_currency: 'EUR' },
    });
    expect(res.status).toBe(404);
  });

  it("A's transaction list never contains B's transactions", async () => {
    const aTx = await (await api('GET', '/api/transactions', { user: 'A' })).json();
    const aAccounts = await (await api('GET', '/api/accounts', { user: 'A' })).json();
    const aAccountIds = new Set(aAccounts.map((a: { id: string }) => a.id));
    for (const t of aTx.items) {
      expect(aAccountIds.has(t.account)).toBe(true);
    }
  });
});
