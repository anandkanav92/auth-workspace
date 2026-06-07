import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Hono } from 'hono';

// --- in-memory fakes for the repos the route touches --------------------------
type HoldingRow = {
  id: string;
  user: string;
  account: string;
  ticker: string;
  isin?: string;
  quantity: number;
  cost_basis?: number | null;
  cost_currency?: string | null;
  source: string;
};
type AccountRow = { id: string; user: string };
type ImportRow = Record<string, unknown> & { id: string; created: string };

let accounts: AccountRow[] = [];
let holdings: HoldingRow[] = [];
let imports: ImportRow[] = [];
let hid = 0;
let iid = 0;

vi.mock('../src/db/accounts', () => ({
  accountsRepo: {
    get: vi.fn(async (id: string) => {
      const a = accounts.find((x) => x.id === id);
      if (!a) throw new Error('not found');
      return a;
    }),
  },
}));

vi.mock('../src/db/holdings', () => ({
  holdingsRepo: {
    listForUser: vi.fn(async (user: string, opts: { account?: string } = {}) =>
      holdings.filter(
        (h) => h.user === user && (!opts.account || h.account === opts.account),
      ),
    ),
  },
}));

vi.mock('../src/db/imports', () => ({
  importsRepo: {
    findByHash: vi.fn(async (user: string, account: string, hash: string) =>
      imports.find(
        (i) => i.user === user && i.account === account && i.file_hash === hash,
      ) ?? null,
    ),
  },
}));

// The atomic commit (C1) goes through pbAdmin().createBatch() (see
// src/db/importCommit.ts), so we mock the batch client here. The fake batch
// queues collection ops and applies them to the in-memory arrays ONLY on
// send() — mirroring PocketBase's all-or-nothing semantics. A queued op may set
// `throwOnSend` to simulate a mid-batch failure, in which case send() rejects
// WITHOUT mutating any array (the no-wipe guarantee).
type BatchOp =
  | { kind: 'delete'; collection: string; id: string }
  | { kind: 'create'; collection: string; data: Record<string, unknown>; throwOnSend?: boolean };
let batchOps: BatchOp[] = [];

vi.mock('../src/lib/pb', () => ({
  pbAdmin: vi.fn(async () => ({
    createBatch: () => {
      const ops: BatchOp[] = [];
      const sub = (collection: string) => ({
        delete: (id: string) => {
          ops.push({ kind: 'delete', collection, id });
        },
        create: (data: Record<string, unknown>) => {
          ops.push({ kind: 'create', collection, data, throwOnSend: data.__fail === true });
        },
      });
      return {
        collection: (name: string) => sub(name),
        send: async () => {
          batchOps = ops; // expose for assertions
          // Validate the WHOLE batch first; mutate nothing if any op fails.
          if (ops.some((o) => o.kind === 'create' && o.throwOnSend)) {
            throw new Error('Batch request failed (simulated mid-batch failure).');
          }
          const results: Array<{ status: number; body: Record<string, unknown> }> = [];
          for (const o of ops) {
            if (o.kind === 'delete') {
              holdings = holdings.filter((h) => h.id !== o.id);
              results.push({ status: 200, body: {} });
            } else if (o.collection === 'holdings') {
              const row = { ...(o.data as Omit<HoldingRow, 'id'>), id: `h${++hid}` };
              holdings.push(row as HoldingRow);
              results.push({ status: 200, body: row as unknown as Record<string, unknown> });
            } else {
              const row = { ...o.data, id: `i${++iid}`, created: new Date().toISOString() };
              imports.push(row as ImportRow);
              results.push({ status: 200, body: row });
            }
          }
          return results;
        },
      };
    },
  })),
}));

// symbol_profiles + price_cache: pretend nothing is known/cached, swallow writes.
vi.mock('../src/db/symbolProfiles', () => ({
  symbolProfilesRepo: {
    get: vi.fn(async () => null),
    upsert: vi.fn(async (d: unknown) => d),
  },
}));
vi.mock('../src/db/priceCache', () => ({
  priceCacheRepo: { upsert: vi.fn(async (d: unknown) => d) },
}));

// Don't hit Yahoo for profile/price enrichment.
vi.mock('../src/providers/yahoo', () => ({
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

// ISIN→ticker resolution has its own unit test; here it just echoes the broker
// symbol so the route test exercises upload/diff/commit, not the network.
vi.mock('../src/importers/resolveTicker', () => ({
  resolveTicker: vi.fn(async (_isin: string, brokerSymbol: string) => brokerSymbol),
}));

import { importRoutes } from '../src/routes/import';
import { errorHandler } from '../src/middleware/errorHandler';
import { _clearPreviews } from '../src/routes/importPreview';

const HERE = dirname(fileURLToPath(import.meta.url));
const T212 = join(HERE, 'fixtures', 't212-synthetic.pdf');

function makeApp() {
  const app = new Hono();
  app.onError(errorHandler);
  app.use('/api/*', async (c, next) => {
    c.set('uid', 'fb-A');
    c.set('email', 'a@test');
    c.set('pbUserId', 'userA');
    await next();
  });
  app.route('/api/import', importRoutes);
  return app;
}

async function uploadT212(app: Hono, accountId: string) {
  const form = new FormData();
  form.append('file', new Blob([readFileSync(T212)]), 't212.pdf');
  form.append('accountId', accountId);
  return app.request('/api/import/upload', { method: 'POST', body: form });
}

beforeEach(() => {
  accounts = [{ id: 'accA', user: 'userA' }];
  holdings = [];
  imports = [];
  batchOps = [];
  hid = 0;
  iid = 0;
  _clearPreviews();
});

describe('POST /api/import/upload + /commit', () => {
  it('previews a T212 statement, then commits it into holdings', async () => {
    const app = makeApp();

    const previewRes = await uploadT212(app, 'accA');
    expect(previewRes.status).toBe(200);
    const preview = await previewRes.json();
    expect(preview.previewId).toBeTruthy();
    expect(preview.summary.total).toBe(4); // all 4 fixture positions are new
    expect(preview.summary.new).toBe(4);
    expect(preview.diff.every((d: { status: string }) => d.status === 'new')).toBe(true);

    // Nothing written to holdings yet — preview is read-only.
    expect(holdings).toHaveLength(0);

    const commitRes = await app.request('/api/import/commit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ previewId: preview.previewId }),
    });
    expect(commitRes.status).toBe(200);
    const committed = await commitRes.json();
    expect(committed.ok).toBe(true);
    expect(committed.rowCount).toBe(4);

    expect(holdings).toHaveLength(4);
    const aapl = holdings.find((h) => h.ticker === 'AAPL');
    expect(aapl?.cost_basis).toBeCloseTo(3.5 * 150, 4); // T212 carries cost basis
    expect(imports).toHaveLength(1);
    expect(imports[0].status).toBe('success');
  });

  it('re-uploading the same file to the same account → 409', async () => {
    const app = makeApp();
    const p = await (await uploadT212(app, 'accA')).json();
    await app.request('/api/import/commit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ previewId: p.previewId }),
    });

    const dup = await uploadT212(app, 'accA');
    expect(dup.status).toBe(409);
    expect((await dup.json()).error).toBe('already_imported');
  });

  it('snapshot-replace: commit deletes prior holdings before inserting', async () => {
    const app = makeApp();
    holdings.push({
      id: 'old1',
      user: 'userA',
      account: 'accA',
      ticker: 'OLD',
      quantity: 99,
      source: 'manual',
    });
    const p = await (await uploadT212(app, 'accA')).json();
    await app.request('/api/import/commit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ previewId: p.previewId }),
    });
    expect(holdings.find((h) => h.ticker === 'OLD')).toBeUndefined();
    expect(holdings).toHaveLength(4);
  });

  it('commits all deletes + creates + the imports row in ONE batch (C1 atomicity)', async () => {
    const app = makeApp();
    holdings.push({
      id: 'old1',
      user: 'userA',
      account: 'accA',
      ticker: 'OLD',
      quantity: 99,
      source: 'manual',
    });
    const p = await (await uploadT212(app, 'accA')).json();
    await app.request('/api/import/commit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ previewId: p.previewId }),
    });

    // Everything went through a single batch.send(): 1 delete (OLD) + 4 holding
    // creates + 1 imports-row create.
    expect(batchOps.filter((o) => o.kind === 'delete')).toHaveLength(1);
    expect(
      batchOps.filter((o) => o.kind === 'create' && o.collection === 'holdings'),
    ).toHaveLength(4);
    expect(
      batchOps.filter((o) => o.kind === 'create' && o.collection === 'imports'),
    ).toHaveLength(1);
    // The imports-row create is LAST so its (per-account) unique-index check
    // rolls back the deletes too if it ever fires (I1).
    expect(batchOps.at(-1)).toMatchObject({ kind: 'create', collection: 'imports' });
  });

  it('rejects an upload to an account the caller does not own → 404', async () => {
    const app = makeApp();
    accounts.push({ id: 'accB', user: 'userB' });
    const res = await uploadT212(app, 'accB');
    expect(res.status).toBe(404);
  });

  it('commit with an unknown/expired previewId → 404 "preview expired"', async () => {
    const app = makeApp();
    const res = await app.request('/api/import/commit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ previewId: 'does-not-exist' }),
    });
    expect(res.status).toBe(404);
    // HTTPException renders `message` as the plain-text body.
    expect(await res.text()).toMatch(/preview expired or not found/);
  });
});
