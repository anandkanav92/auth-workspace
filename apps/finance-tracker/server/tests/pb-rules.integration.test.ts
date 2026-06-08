// SPIKE 5 — the core per-user privacy guarantee (design §11, plan Task 1.4).
//
// INTEGRATION TEST (not a unit test): runs against a real, locally-spawned
// PocketBase v0.23.11 with our committed migrations applied (see
// tests/pb-test-server.ts globalSetup). It asserts two things:
//
//   1. Per-user isolation: user A can observe NONE of user B's rows across
//      ALL FIVE per-user collections (accounts, holdings, transactions,
//      imports, holdings_snapshot) via getFullList() — the REST list rule —
//      and, for accounts, via subscribe('*') — the realtime stream rule.
//
//   2. Shared-collection write lock: a normal authed user CANNOT create rows
//      in the superuser-only shared collections (symbol_profiles, price_cache).
//
// If any assertion fails, the multi-tenant isolation / write lock is broken
// and the app must not ship. Requires EventSource (run with
// NODE_OPTIONS=--experimental-eventsource, wired in the test:integration script).

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import PocketBase from 'pocketbase';
import { USER_A, USER_B } from './pb-test-server';

const PB_URL = process.env.PB_URL!;

// All five per-user collections share the same rule string. We exercise every
// one so a future hand-edit weakening any single collection's rule is caught.
const PER_USER_COLLECTIONS = [
  'accounts',
  'holdings',
  'transactions',
  'imports',
  'holdings_snapshot',
  'broker_connections',
] as const;

describe('PocketBase per-user isolation (Spike 5)', () => {
  let pbA: PocketBase;
  let pbB: PocketBase;

  beforeAll(async () => {
    expect(typeof (globalThis as { EventSource?: unknown }).EventSource).toBe(
      'function',
    ); // realtime depends on it
    expect(PB_URL, 'globalSetup should have exported PB_URL').toBeTruthy();

    pbA = new PocketBase(PB_URL);
    pbB = new PocketBase(PB_URL);
    pbA.autoCancellation(false);
    pbB.autoCancellation(false);

    await pbA.collection('users').authWithPassword(USER_A.email, USER_A.password);
    await pbB.collection('users').authWithPassword(USER_B.email, USER_B.password);
  });

  afterAll(() => {
    pbA?.collection('accounts').unsubscribe();
    pbA?.authStore.clear();
    pbB?.authStore.clear();
  });

  // Build a minimal valid row owned by `userId` for `coll`. Child collections
  // (everything except accounts) need a valid `account` relation owned by the
  // same user, so the caller passes B's pre-created account id.
  function minimalRow(
    coll: (typeof PER_USER_COLLECTIONS)[number],
    userId: string,
    accountId: string,
    label: string,
  ): Record<string, unknown> {
    const nowIso = new Date().toISOString();
    switch (coll) {
      case 'accounts':
        return { user: userId, source: 'manual', label };
      case 'holdings':
        return {
          user: userId,
          account: accountId,
          ticker: label, // doubles as the leak marker (unique per row)
          quantity: 1,
          source: 'manual',
        };
      case 'transactions':
        return {
          user: userId,
          account: accountId,
          type: 'buy',
          ticker: label,
          quantity: 1,
          price: 1,
          currency: 'USD',
          occurred_at: nowIso,
          source: 'manual',
        };
      case 'imports':
        return {
          user: userId,
          account: accountId,
          source: 'revolut',
          filename: label,
          file_hash: label, // unique per row, satisfies (user, file_hash) index
          status: 'success',
        };
      case 'holdings_snapshot':
        return {
          user: userId,
          account: accountId,
          ticker: label,
          quantity: 1,
          eur_value: 1,
          date: nowIso,
        };
      case 'broker_connections':
        // Owned directly by user (no `account` relation). The marker rides in
        // api_key_enc, which mimics our base64(iv).base64(tag).base64(ct) shape.
        return {
          user: userId,
          broker: 'trading212',
          api_key_enc: `${label}.y.z`,
        };
    }
  }

  // A stable per-collection marker we can search for in A's view of each
  // collection. accounts uses `label`; the rest carry the marker in `ticker`
  // (or `filename` for imports), but every row also carries B's `user` id,
  // which is the authoritative leak check below.
  function markerFor(coll: (typeof PER_USER_COLLECTIONS)[number]): string {
    return `B-secret-${coll}`;
  }

  it('getFullList(): user A sees NONE of user B rows across all five per-user collections', async () => {
    const bId = pbB.authStore.record!.id;

    // Child collections need an account owned by B; create it once and reuse.
    const bAccount = await pbB
      .collection('accounts')
      .create({ user: bId, source: 'manual', label: 'B-parent-account' });

    for (const coll of PER_USER_COLLECTIONS) {
      const marker = markerFor(coll);
      await pbB.collection(coll).create(minimalRow(coll, bId, bAccount.id, marker));

      const aSees = await pbA.collection(coll).getFullList();

      // No row should carry the B-owned marker. accounts uses `label`, most
      // children carry it in `ticker`/`filename`, and broker_connections
      // embeds it in `api_key_enc`, so scan every string field as a substring.
      const markerHaystack = aSees
        .flatMap((r) => Object.values(r))
        .filter((v): v is string => typeof v === 'string')
        .join(' ');
      expect(
        markerHaystack,
        `A leaked B's ${coll} row (marker visible)`,
      ).not.toContain(marker);

      // ...and, the authoritative check: A must see none of B's rows at all.
      expect(
        aSees.every((r) => r.user !== bId),
        `A leaked at least one ${coll} row owned by B`,
      ).toBe(true);
    }
  });

  it("broker_connections accepts status='syncing' after the migration", async () => {
    // Guards migration 1780900300: the SelectField must now allow 'syncing' (the
    // server-authoritative in-progress lock) alongside connected/error. If the
    // migration didn't widen the values, this create is rejected.
    const aId = pbA.authStore.record!.id;
    const row = await pbA.collection('broker_connections').create({
      user: aId,
      broker: 'trading212',
      api_key_enc: 'syncing-test.y.z',
      status: 'syncing',
    });
    expect(row.status).toBe('syncing');

    // It can be flipped back to connected/error (the full lifecycle).
    const updated = await pbA
      .collection('broker_connections')
      .update(row.id, { status: 'connected' });
    expect(updated.status).toBe('connected');

    await pbA.collection('broker_connections').delete(row.id);
  });

  it("subscribe('*'): user A receives NO realtime event for user B's create (accounts)", async () => {
    const aReceived: Array<{ label: string; user: string }> = [];

    await pbA.collection('accounts').subscribe('*', (e) => {
      aReceived.push({ label: e.record.label, user: e.record.user });
    });
    // Give the SSE connection a beat to establish before B writes.
    await new Promise((r) => setTimeout(r, 500));

    const bId = pbB.authStore.record!.id;
    await pbB
      .collection('accounts')
      .create({ user: bId, source: 'manual', label: 'B-secret-realtime' });

    // Wait well past any realtime propagation window (~1.5s per the spike note).
    await new Promise((r) => setTimeout(r, 1500));

    await pbA.collection('accounts').unsubscribe();

    expect(
      aReceived.find((r) => r.label === 'B-secret-realtime'),
      'A must not receive B realtime events',
    ).toBeUndefined();
    expect(aReceived.every((r) => r.user !== bId)).toBe(true);
  });

  it('shared collections: a normal authed user CANNOT write (superuser-only rule)', async () => {
    const nowIso = new Date().toISOString();

    // symbol_profiles: create must be rejected (null createRule = superuser only).
    await expect(
      pbA.collection('symbol_profiles').create({
        ticker: 'TEST',
        name: 'x',
        exchange: 'x',
        asset_type: 'stock',
        listing_currency: 'USD',
        data_source: 'yahoo',
        last_refreshed_at: nowIso,
      }),
      'authed user must not be able to create symbol_profiles',
    ).rejects.toThrow();

    // price_cache: same lock, cheap to check.
    await expect(
      pbA.collection('price_cache').create({
        ticker: 'TEST',
        price: 1,
        currency: 'USD',
        data_source: 'yahoo',
        last_fetched_at: nowIso,
      }),
      'authed user must not be able to create price_cache',
    ).rejects.toThrow();
  });

  it('sanity: user A DOES see its own row via both list and realtime', async () => {
    const aReceived: string[] = [];
    await pbA.collection('accounts').subscribe('*', (e) => {
      aReceived.push(e.record.label);
    });
    await new Promise((r) => setTimeout(r, 500));

    const aId = pbA.authStore.record!.id;
    await pbA
      .collection('accounts')
      .create({ user: aId, source: 'manual', label: 'A-own' });

    await new Promise((r) => setTimeout(r, 1500));
    await pbA.collection('accounts').unsubscribe();

    const aSees = await pbA.collection('accounts').getFullList();
    expect(aSees.map((r) => r.label)).toContain('A-own');
    expect(aReceived).toContain('A-own'); // realtime delivers A's own create
  });
});
