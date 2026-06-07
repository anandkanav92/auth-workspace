// INTEGRATION TEST (not a unit test): drives the real /api/import route handlers
// against a locally-spawned PocketBase with our committed migrations applied
// (tests/pb-test-server.ts globalSetup). This is the end-to-end proof of the
// upload→preview→commit→re-upload-409 roundtrip through the actual repos +
// PocketBase writes (holdings inserted, imports row written, dedup enforced).
//
// Network is stubbed: resolveTicker echoes the broker symbol and the Yahoo
// provider returns nothing, so no external calls happen during the run. Auth is
// shimmed exactly as in portfolio.integration.test.ts.

import { describe, it, expect, beforeAll, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Hono } from 'hono';
import PocketBase from 'pocketbase';
import { USER_A } from '../pb-test-server';

vi.mock('../../src/importers/resolveTicker', () => ({
  resolveTicker: vi.fn(async (_isin: string, brokerSymbol: string) => brokerSymbol),
}));
vi.mock('../../src/providers/yahoo', () => ({
  YahooPriceProvider: class {
    async profile() {
      return null;
    }
    async quote() {
      return null;
    }
    async search() {
      return [];
    }
  },
}));

import { accountRoutes } from '../../src/routes/accounts';
import { holdingRoutes } from '../../src/routes/holdings';
import { importRoutes } from '../../src/routes/import';
import { errorHandler } from '../../src/middleware/errorHandler';

const PB_URL = process.env.PB_URL!;
const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(HERE, '..', 'fixtures');

let userAId: string;
let app: Hono;

beforeAll(async () => {
  const pbA = new PocketBase(PB_URL);
  await pbA.collection('users').authWithPassword(USER_A.email, USER_A.password);
  userAId = pbA.authStore.record!.id;

  app = new Hono();
  app.onError(errorHandler);
  app.use('/api/*', async (c, next) => {
    c.set('uid', 'fb-A');
    c.set('email', 'a@test');
    c.set('pbUserId', userAId);
    await next();
  });
  app.route('/api/accounts', accountRoutes);
  app.route('/api/holdings', holdingRoutes);
  app.route('/api/import', importRoutes);
});

async function json(method: string, path: string, body: unknown) {
  return app.request(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function uploadFixture(name: string, accountId: string) {
  const form = new FormData();
  form.append('file', new Blob([readFileSync(join(FIXTURES, name))]), name);
  form.append('accountId', accountId);
  return app.request('/api/import/upload', { method: 'POST', body: form });
}

describe('M6 import roundtrip (E2E against real PocketBase)', () => {
  it('upload → preview → commit → re-upload-same is 409', async () => {
    // 1. Create a Trading 212 account.
    const acc = await (
      await json('POST', '/api/accounts', { source: 'trading212', label: 'T212 Invest' })
    ).json();
    expect(acc.user).toBe(userAId);

    // 2. Upload the T212 statement → preview (no holdings written yet).
    const previewRes = await uploadFixture('t212-synthetic.pdf', acc.id);
    expect(previewRes.status).toBe(200);
    const preview = await previewRes.json();
    expect(preview.previewId).toBeTruthy();
    expect(preview.summary.total).toBe(4);
    const before = await (await app.request(`/api/holdings?accountId=${acc.id}`)).json();
    expect(before).toHaveLength(0);

    // 3. Commit → holdings inserted, imports row written.
    const commit = await json('POST', '/api/import/commit', { previewId: preview.previewId });
    expect(commit.status).toBe(200);
    expect((await commit.json()).rowCount).toBe(4);

    const holdings = await (
      await app.request(`/api/holdings?accountId=${acc.id}`)
    ).json();
    expect(holdings.length).toBeGreaterThan(0);
    // T212 carries cost basis.
    expect(holdings[0].cost_basis).not.toBeNull();
    expect(holdings.find((h: { ticker: string }) => h.ticker === 'AAPL')).toBeTruthy();

    // 4. Re-uploading the same file to the same account → 409.
    const dup = await uploadFixture('t212-synthetic.pdf', acc.id);
    expect(dup.status).toBe(409);
    expect((await dup.json()).error).toBe('already_imported');
  });

  it('Revolut import commits holdings with null cost basis', async () => {
    const acc = await (
      await json('POST', '/api/accounts', { source: 'revolut', label: 'Revolut' })
    ).json();

    const preview = await (await uploadFixture('revolut-synthetic.pdf', acc.id)).json();
    expect(preview.summary.total).toBe(5);
    await json('POST', '/api/import/commit', { previewId: preview.previewId });

    const holdings = await (
      await app.request(`/api/holdings?accountId=${acc.id}`)
    ).json();
    expect(holdings).toHaveLength(5);
    // Revolut has no cost basis. PocketBase's NumberField coerces a written null
    // to 0 on read, so the RELIABLE "no cost data" marker is the (TextField)
    // cost_currency staying empty — that's what the P&L tiles (M11) key off.
    for (const h of holdings) {
      expect(h.cost_currency == null || h.cost_currency === '').toBe(true);
      expect(h.cost_basis == null || h.cost_basis === 0).toBe(true);
    }
  });

  it('snapshot-replace: a second (different) import replaces prior holdings', async () => {
    const acc = await (
      await json('POST', '/api/accounts', { source: 'trading212', label: 'Replace' })
    ).json();

    const p1 = await (await uploadFixture('t212-synthetic.pdf', acc.id)).json();
    await json('POST', '/api/import/commit', { previewId: p1.previewId });
    const first = await (await app.request(`/api/holdings?accountId=${acc.id}`)).json();
    expect(first).toHaveLength(4);

    // Different statement (Revolut) → snapshot-replace drops the 4 T212 rows.
    const p2 = await (await uploadFixture('revolut-synthetic.pdf', acc.id)).json();
    await json('POST', '/api/import/commit', { previewId: p2.previewId });
    const second = await (await app.request(`/api/holdings?accountId=${acc.id}`)).json();
    expect(second).toHaveLength(5);
    expect(second.find((h: { ticker: string }) => h.ticker === 'AAPL')).toBeUndefined();
    expect(second.find((h: { ticker: string }) => h.ticker === 'META')).toBeTruthy();
  });
});
