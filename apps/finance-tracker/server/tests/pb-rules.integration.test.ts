// SPIKE 5 — the core per-user privacy guarantee (design §11, plan Task 1.4).
//
// INTEGRATION TEST (not a unit test): runs against a real, locally-spawned
// PocketBase v0.23.11 with our committed migrations applied (see
// tests/pb-test-server.ts globalSetup). It asserts that user A can observe
// NONE of user B's `accounts` rows via either:
//   1. getFullList()  — the REST list rule, and
//   2. subscribe('*') — the realtime stream rule.
//
// If either assertion fails, the multi-tenant isolation is broken and the
// app must not ship. Requires EventSource (run with
// NODE_OPTIONS=--experimental-eventsource, wired in the test:integration script).

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import PocketBase from 'pocketbase';
import { USER_A, USER_B } from './pb-test-server';

const PB_URL = process.env.PB_URL!;

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

  it('getFullList(): user A does NOT see user B rows', async () => {
    const bId = pbB.authStore.record!.id;
    await pbB
      .collection('accounts')
      .create({ user: bId, source: 'manual', label: 'B-secret-list' });

    const aSees = await pbA.collection('accounts').getFullList();
    const labels = aSees.map((r) => r.label);

    expect(labels).not.toContain('B-secret-list');
    // Stronger: A must see none of B's rows at all.
    expect(aSees.every((r) => r.user !== bId)).toBe(true);
  });

  it("subscribe('*'): user A receives NO realtime event for user B's create", async () => {
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
