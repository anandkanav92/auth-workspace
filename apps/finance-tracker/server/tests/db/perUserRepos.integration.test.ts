// INTEGRATION TEST (not a unit test): exercises the five per-user repos
// (accounts, holdings, transactions, imports, holdings_snapshot) against a
// real, locally-spawned PocketBase v0.23.11 with our committed migrations
// applied (see tests/pb-test-server.ts globalSetup).
//
// It asserts two things per repo:
//   1. CRUD roundtrip: create → list → get → update → delete works through the
//      admin-token-backed repo.
//   2. Cross-user isolation: repo.list(userA) NEVER returns userB's rows. This
//      is the defensive `user = {:userId}` scoping in PerUserRepo — important
//      because the admin token bypasses PocketBase's own per-user rules.
//
// The repos go through src/lib/pb.ts's pbAdmin(); globalSetup points
// PB_ADMIN_EMAIL/PB_ADMIN_PASSWORD at the seeded superuser.

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import PocketBase from 'pocketbase';
import { USER_A, USER_B } from '../pb-test-server';
import { accountsRepo } from '../../src/db/accounts';
import { holdingsRepo } from '../../src/db/holdings';
import { transactionsRepo } from '../../src/db/transactions';
import { importsRepo } from '../../src/db/imports';
import { holdingsSnapshotRepo } from '../../src/db/holdingsSnapshot';
import { brokerConnectionsRepo } from '../../src/db/brokerConnections';
import { encryptSecret, decryptSecret } from '../../src/lib/crypto';

const PB_URL = process.env.PB_URL!;

// Resolve the two seeded users' PocketBase ids by authenticating as them.
let userAId: string;
let userBId: string;
// Each child collection needs a parent account owned by the same user.
let accountAId: string;
let accountBId: string;

beforeAll(async () => {
  expect(PB_URL, 'globalSetup should have exported PB_URL').toBeTruthy();

  const pbA = new PocketBase(PB_URL);
  const pbB = new PocketBase(PB_URL);
  await pbA.collection('users').authWithPassword(USER_A.email, USER_A.password);
  await pbB.collection('users').authWithPassword(USER_B.email, USER_B.password);
  userAId = pbA.authStore.record!.id;
  userBId = pbB.authStore.record!.id;

  // Pre-create one account per user via the repo itself (also smoke-tests it).
  const accA = await accountsRepo.create({
    user: userAId,
    source: 'manual',
    label: 'A parent account',
  });
  const accB = await accountsRepo.create({
    user: userBId,
    source: 'manual',
    label: 'B parent account',
  });
  accountAId = accA.id;
  accountBId = accB.id;
});

describe('AccountsRepo', () => {
  it('CRUD roundtrip', async () => {
    const created = await accountsRepo.create({
      user: userAId,
      source: 'trading212',
      label: 'T212 ISA',
    });
    expect(created.id).toBeTruthy();
    expect(created.label).toBe('T212 ISA');

    const listed = await accountsRepo.list(userAId);
    expect(listed.find((a) => a.id === created.id)).toBeTruthy();

    const got = await accountsRepo.get(created.id);
    expect(got.label).toBe('T212 ISA');

    const updated = await accountsRepo.update(created.id, { label: 'T212 Invest' });
    expect(updated.label).toBe('T212 Invest');

    const ok = await accountsRepo.delete(created.id);
    expect(ok).toBe(true);
    const after = await accountsRepo.list(userAId);
    expect(after.find((a) => a.id === created.id)).toBeUndefined();
  });

  it('list(userA) never returns userB rows', async () => {
    await accountsRepo.create({
      user: userBId,
      source: 'manual',
      label: 'B-only account',
    });
    const aSees = await accountsRepo.list(userAId);
    expect(aSees.every((a) => a.user === userAId)).toBe(true);
    expect(aSees.find((a) => a.label === 'B-only account')).toBeUndefined();
  });
});

describe('HoldingsRepo', () => {
  it('CRUD roundtrip (with nullable cost_basis)', async () => {
    const created = await holdingsRepo.create({
      user: userAId,
      account: accountAId,
      ticker: 'AAPL',
      quantity: 10,
      cost_basis: null, // Revolut PDF case
      cost_currency: null,
      source: 'revolut',
    });
    expect(created.id).toBeTruthy();

    const listed = await holdingsRepo.list(userAId);
    expect(listed.find((h) => h.id === created.id)).toBeTruthy();

    const got = await holdingsRepo.get(created.id);
    expect(got.ticker).toBe('AAPL');

    const updated = await holdingsRepo.update(created.id, { quantity: 15 });
    expect(updated.quantity).toBe(15);

    const ok = await holdingsRepo.delete(created.id);
    expect(ok).toBe(true);
  });

  it('list(userA) never returns userB rows', async () => {
    await holdingsRepo.create({
      user: userBId,
      account: accountBId,
      ticker: 'BSECRET',
      quantity: 1,
      source: 'manual',
    });
    const aSees = await holdingsRepo.list(userAId);
    expect(aSees.every((h) => h.user === userAId)).toBe(true);
    expect(aSees.find((h) => h.ticker === 'BSECRET')).toBeUndefined();
  });
});

describe('TransactionsRepo', () => {
  it('CRUD roundtrip', async () => {
    const created = await transactionsRepo.create({
      user: userAId,
      account: accountAId,
      type: 'buy',
      ticker: 'MSFT',
      quantity: 3,
      price: 400,
      currency: 'USD',
      occurred_at: new Date().toISOString(),
      source: 'manual',
    });
    expect(created.id).toBeTruthy();

    const listed = await transactionsRepo.list(userAId);
    expect(listed.find((t) => t.id === created.id)).toBeTruthy();

    const got = await transactionsRepo.get(created.id);
    expect(got.type).toBe('buy');

    const updated = await transactionsRepo.update(created.id, { quantity: 4 });
    expect(updated.quantity).toBe(4);

    const ok = await transactionsRepo.delete(created.id);
    expect(ok).toBe(true);
  });

  it('list(userA) never returns userB rows', async () => {
    await transactionsRepo.create({
      user: userBId,
      account: accountBId,
      type: 'buy',
      ticker: 'BSECRETTX',
      quantity: 1,
      price: 1,
      currency: 'USD',
      occurred_at: new Date().toISOString(),
      source: 'manual',
    });
    const aSees = await transactionsRepo.list(userAId);
    expect(aSees.every((t) => t.user === userAId)).toBe(true);
    expect(aSees.find((t) => t.ticker === 'BSECRETTX')).toBeUndefined();
  });

  // Task 2.2 — broker-sync idempotency via the (user, source, external_id)
  // partial unique index. Exercises the real PocketBase constraint.
  describe('upsertByExternalId (idempotent sync key)', () => {
    function syncRow(extId: string, over: Partial<Transaction> = {}) {
      return {
        user: userAId,
        account: accountAId,
        type: 'buy' as const,
        ticker: 'EXTID',
        quantity: 1,
        price: 100,
        currency: 'USD',
        occurred_at: new Date().toISOString(),
        source: 'trading212' as const,
        external_id: extId,
        ...over,
      };
    }

    it('upserting twice with the same (user, source, external_id) yields ONE row (updated)', async () => {
      const extId = `t212-evt-${Date.now()}`;
      const first = await transactionsRepo.upsertByExternalId(syncRow(extId));
      const second = await transactionsRepo.upsertByExternalId(
        syncRow(extId, { quantity: 5 }),
      );

      // Same row id — updated in place, not duplicated.
      expect(second.id).toBe(first.id);
      expect(second.quantity).toBe(5);

      const matches = (await transactionsRepo.list(userAId)).filter(
        (t) => t.external_id === extId,
      );
      expect(matches).toHaveLength(1);

      await transactionsRepo.delete(first.id);
    });

    // Migration 1780900200 relaxed transactions.quantity (required → optional)
    // because PocketBase treats a required NumberField 0 as blank. A dividend
    // ledger row carries quantity 0 — before the relaxation PocketBase rejected
    // it with a 400 "Failed to create record." This proves it now persists.
    it('a dividend-like row with quantity 0 upserts successfully', async () => {
      const extId = `t212-div-zeroqty-${Date.now()}`;
      const created = await transactionsRepo.upsertByExternalId(
        syncRow(extId, { type: 'dividend', quantity: 0, ticker: 'DIVZERO' }),
      );

      expect(created.id).toBeTruthy();
      expect(created.quantity).toBe(0);
      expect(created.type).toBe('dividend');

      await transactionsRepo.delete(created.id);
    });

    it('different external_ids create distinct rows', async () => {
      const base = `t212-distinct-${Date.now()}`;
      const a = await transactionsRepo.upsertByExternalId(syncRow(`${base}-1`));
      const b = await transactionsRepo.upsertByExternalId(syncRow(`${base}-2`));

      expect(a.id).not.toBe(b.id);

      await transactionsRepo.delete(a.id);
      await transactionsRepo.delete(b.id);
    });

    it('rows with empty/absent external_id do NOT collide (partial index)', async () => {
      // Two manual rows with no external_id — the partial index excludes them,
      // so both must persist without a unique violation.
      const manualA = await transactionsRepo.create({
        user: userAId,
        account: accountAId,
        type: 'buy',
        ticker: 'MANUAL1',
        quantity: 1,
        price: 1,
        currency: 'USD',
        occurred_at: new Date().toISOString(),
        source: 'manual',
      });
      const manualB = await transactionsRepo.create({
        user: userAId,
        account: accountAId,
        type: 'buy',
        ticker: 'MANUAL2',
        quantity: 2,
        price: 2,
        currency: 'USD',
        occurred_at: new Date().toISOString(),
        source: 'manual',
        external_id: '', // explicit empty — still excluded by the index
      });

      expect(manualA.id).toBeTruthy();
      expect(manualB.id).toBeTruthy();
      expect(manualA.id).not.toBe(manualB.id);

      await transactionsRepo.delete(manualA.id);
      await transactionsRepo.delete(manualB.id);
    });
  });
});

describe('ImportsRepo', () => {
  it('CRUD roundtrip', async () => {
    const created = await importsRepo.create({
      user: userAId,
      account: accountAId,
      source: 'trading212',
      filename: 'statement-a.pdf',
      file_hash: 'hash-a-1',
      status: 'success',
    });
    expect(created.id).toBeTruthy();

    const listed = await importsRepo.list(userAId);
    expect(listed.find((i) => i.id === created.id)).toBeTruthy();

    const got = await importsRepo.get(created.id);
    expect(got.filename).toBe('statement-a.pdf');

    const updated = await importsRepo.update(created.id, { status: 'partial' });
    expect(updated.status).toBe('partial');

    const ok = await importsRepo.delete(created.id);
    expect(ok).toBe(true);
  });

  it('list(userA) never returns userB rows', async () => {
    await importsRepo.create({
      user: userBId,
      account: accountBId,
      source: 'revolut',
      filename: 'b-statement.pdf',
      file_hash: 'hash-b-secret',
      status: 'success',
    });
    const aSees = await importsRepo.list(userAId);
    expect(aSees.every((i) => i.user === userAId)).toBe(true);
    expect(aSees.find((i) => i.file_hash === 'hash-b-secret')).toBeUndefined();
  });
});

describe('HoldingsSnapshotRepo', () => {
  it('CRUD roundtrip', async () => {
    const created = await holdingsSnapshotRepo.create({
      user: userAId,
      account: accountAId,
      ticker: 'NVDA',
      quantity: 2,
      eur_value: 1000,
      date: new Date().toISOString(),
    });
    expect(created.id).toBeTruthy();

    const listed = await holdingsSnapshotRepo.list(userAId);
    expect(listed.find((s) => s.id === created.id)).toBeTruthy();

    const got = await holdingsSnapshotRepo.get(created.id);
    expect(got.ticker).toBe('NVDA');

    const updated = await holdingsSnapshotRepo.update(created.id, {
      eur_value: 1100,
    });
    expect(updated.eur_value).toBe(1100);

    const ok = await holdingsSnapshotRepo.delete(created.id);
    expect(ok).toBe(true);
  });

  it('list(userA) never returns userB rows', async () => {
    await holdingsSnapshotRepo.create({
      user: userBId,
      account: accountBId,
      ticker: 'BSNAP',
      quantity: 1,
      eur_value: 1,
      date: new Date().toISOString(),
    });
    const aSees = await holdingsSnapshotRepo.list(userAId);
    expect(aSees.every((s) => s.user === userAId)).toBe(true);
    expect(aSees.find((s) => s.ticker === 'BSNAP')).toBeUndefined();
  });
});

describe('BrokerConnectionsRepo', () => {
  // 32-byte key as a 64-hex string, mirroring tests/lib/crypto.test.ts.
  const KEY = 'b'.repeat(64);

  // The integration PocketBase is shared/persistent across test files, and the
  // (user, broker) unique index means a leftover 'trading212' row (e.g. from
  // the pb-rules suite) would both break isolation assertions and collide on
  // create. Start each test from a clean slate for both users.
  beforeEach(async () => {
    for (const uid of [userAId, userBId]) {
      const existing = await brokerConnectionsRepo.list(uid);
      for (const row of existing) {
        await brokerConnectionsRepo.delete((row as { id: string }).id);
      }
    }
  });

  it('CRUD roundtrip', async () => {
    const created = await brokerConnectionsRepo.create({
      user: userAId,
      broker: 'trading212',
      api_key_enc: 'iv.tag.ct',
    });
    expect(created.id).toBeTruthy();

    const listed = await brokerConnectionsRepo.list(userAId);
    expect(listed.find((c) => c.id === created.id)).toBeTruthy();

    const got = await brokerConnectionsRepo.get(created.id);
    expect(got.broker).toBe('trading212');

    const updated = await brokerConnectionsRepo.update(created.id, {
      status: 'error',
    });
    expect(updated.status).toBe('error');

    const ok = await brokerConnectionsRepo.delete(created.id);
    expect(ok).toBe(true);
  });

  it('getForUser is user-scoped: userB cannot read userA connection', async () => {
    const created = await brokerConnectionsRepo.create({
      user: userAId,
      broker: 'trading212',
      api_key_enc: 'iv.tag.ct',
    });

    // User A reads its own connection back...
    const aSees = await brokerConnectionsRepo.getForUser(userAId, 'trading212');
    expect(aSees?.id).toBe(created.id);

    // ...but the same broker scoped to user B must not surface A's row.
    const bSees = await brokerConnectionsRepo.getForUser(userBId, 'trading212');
    expect(bSees).toBeNull();

    await brokerConnectionsRepo.delete(created.id);
  });

  it('persists an encrypted key and decrypts it on read back', async () => {
    const cipher = encryptSecret('secret-key', KEY);
    // The stored value must not leak the plaintext.
    expect(cipher).not.toContain('secret-key');

    const created = await brokerConnectionsRepo.create({
      user: userAId,
      broker: 'trading212',
      api_key_enc: cipher,
    });

    const fetched = await brokerConnectionsRepo.getForUser(
      userAId,
      'trading212',
    );
    expect(fetched).not.toBeNull();
    expect(fetched!.api_key_enc).toBe(cipher);
    expect(decryptSecret(fetched!.api_key_enc, KEY)).toBe('secret-key');

    await brokerConnectionsRepo.delete(created.id);
  });
});
