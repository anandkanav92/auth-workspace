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
import { holdingsRepo } from '../../src/db/holdings';
import { importsRepo } from '../../src/db/imports';
import { putPreview } from '../../src/routes/importPreview';

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

  // C1: a mid-insert failure must NOT wipe the account. We craft a preview whose
  // SECOND position has an over-long ticker (holdings.ticker max=32 → PocketBase
  // validation error). The atomic batch (delete-all + inserts + imports-row)
  // must roll back entirely: the account's PRIOR holdings survive and no success
  // imports row is written.
  it('mid-insert failure rolls back — prior holdings survive, no success import (C1)', async () => {
    const acc = await (
      await json('POST', '/api/accounts', { source: 'trading212', label: 'NoWipe' })
    ).json();

    // Seed two prior holdings the way a previous import would have.
    await holdingsRepo.create({
      user: userAId,
      account: acc.id,
      ticker: 'PRIOR1',
      isin: 'US0000000001',
      quantity: 10,
      cost_basis: 1000,
      cost_currency: 'USD',
      source: 'trading212',
    });
    await holdingsRepo.create({
      user: userAId,
      account: acc.id,
      ticker: 'PRIOR2',
      isin: 'US0000000002',
      quantity: 5,
      cost_basis: 500,
      cost_currency: 'USD',
      source: 'trading212',
    });

    // Build a preview directly: one valid position + one with an invalid ticker
    // (> 32 chars) that PocketBase will reject mid-batch.
    const badTicker = 'X'.repeat(40); // exceeds holdings.ticker max=32
    const previewId = putPreview({
      pbUserId: userAId,
      account: acc.id,
      source: 'trading212',
      filename: 'midfail.pdf',
      fileHash: 'deadbeef-midfail-' + Date.now(),
      positions: [
        { ticker: 'GOOD', isin: 'US0000000003', quantity: 1, cost_basis: 100, cost_currency: 'USD' },
        { ticker: badTicker, isin: 'US0000000004', quantity: 2, cost_basis: 200, cost_currency: 'USD' },
      ],
      diff: [],
    });

    const commit = await json('POST', '/api/import/commit', { previewId });
    expect(commit.status).toBeGreaterThanOrEqual(500); // surfaced as a 5xx

    // No wipe: the two PRIOR holdings still exist, and neither new position was
    // inserted (full rollback).
    const after = await holdingsRepo.listForUser(userAId, { account: acc.id });
    const tickers = after.map((h) => h.ticker).sort();
    expect(tickers).toEqual(['PRIOR1', 'PRIOR2']);
    expect(after.find((h) => h.ticker === 'GOOD')).toBeUndefined();

    // No success imports row was written for this account.
    const imports = await importsRepo.list(userAId);
    expect(
      imports.find((i) => i.account === acc.id && i.status === 'success'),
    ).toBeUndefined();
  });

  // I1: the same file is allowed into a SECOND account (runtime dedup is keyed
  // by (user, account, file_hash)). Before the index fix this 500'd AFTER wiping
  // account B; now the (user, account, file_hash) unique index matches the
  // runtime scope, so B succeeds and re-importing to A is what 409s.
  it('same file → account A (ok), account B (ok now, was 500), account A again (409) (I1)', async () => {
    const accA = await (
      await json('POST', '/api/accounts', { source: 'trading212', label: 'DedupA' })
    ).json();
    const accB = await (
      await json('POST', '/api/accounts', { source: 'trading212', label: 'DedupB' })
    ).json();

    // 1. Same file into account A → succeeds.
    const pA = await (await uploadFixture('t212-synthetic.pdf', accA.id)).json();
    const commitA = await json('POST', '/api/import/commit', { previewId: pA.previewId });
    expect(commitA.status).toBe(200);
    const holdingsA = await (await app.request(`/api/holdings?accountId=${accA.id}`)).json();
    expect(holdingsA).toHaveLength(4);

    // 2. SAME file into account B → must SUCCEED now (was a 500-after-wipe).
    const uploadB = await uploadFixture('t212-synthetic.pdf', accB.id);
    expect(uploadB.status).toBe(200);
    const pB = await uploadB.json();
    const commitB = await json('POST', '/api/import/commit', { previewId: pB.previewId });
    expect(commitB.status).toBe(200);
    const holdingsB = await (await app.request(`/api/holdings?accountId=${accB.id}`)).json();
    expect(holdingsB).toHaveLength(4);

    // Account A is untouched by the B import.
    const holdingsAAfter = await (await app.request(`/api/holdings?accountId=${accA.id}`)).json();
    expect(holdingsAAfter).toHaveLength(4);

    // 3. SAME file into account A AGAIN → 409 (per-account dedup still blocks).
    const dupA = await uploadFixture('t212-synthetic.pdf', accA.id);
    expect(dupA.status).toBe(409);
    expect((await dupA.json()).error).toBe('already_imported');
  });
});
