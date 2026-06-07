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
    create: vi.fn(async (data: Omit<HoldingRow, 'id'>) => {
      const row = { ...data, id: `h${++hid}` };
      holdings.push(row);
      return row;
    }),
    delete: vi.fn(async (id: string) => {
      holdings = holdings.filter((h) => h.id !== id);
      return true;
    }),
  },
}));

vi.mock('../src/db/imports', () => ({
  importsRepo: {
    findByHash: vi.fn(async (user: string, account: string, hash: string) =>
      imports.find(
        (i) => i.user === user && i.account === account && i.file_hash === hash,
      ) ?? null,
    ),
    create: vi.fn(async (data: Record<string, unknown>) => {
      const row = { ...data, id: `i${++iid}`, created: new Date().toISOString() };
      imports.push(row);
      return row;
    }),
  },
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
