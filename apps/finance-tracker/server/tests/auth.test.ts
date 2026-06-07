import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { authMiddleware } from '../src/middleware/auth';
import { pbAdmin } from '../src/lib/pb';

// Per-test controllable token verification (reviewer fix I6): the failing path
// MUST be exercised, so each test sets `verifyImpl` to succeed/throw. We drive
// behaviour through a swappable closure rather than vi.fn().mockReset()+
// mockRejectedValue(): in vitest v4 that combination eagerly creates a rejected
// "template" promise that the per-test mock-state tracker reports as an
// unhandled rejection even when the middleware awaits and catches it (false
// positive). A plain closure the spy delegates to has no such template, so the
// rejection is created fresh per call and is genuinely handled by the catch.
let verifyImpl: (token: string) => Promise<{ uid: string; email?: string }>;
beforeEach(() => {
  verifyImpl = () => {
    throw new Error('verifyImpl not configured for this test');
  };
});

vi.mock('../src/lib/firebase', () => ({
  firebaseAuth: { verifyIdToken: (token: string) => verifyImpl(token) },
}));

// pbAdmin is mocked so no live PocketBase / credentials are needed. The mocked
// users collection has no existing record (getFirstListItem rejects with a
// 404-shaped error, matching Fix 1) so the middleware takes the create path and
// gets pb-id-1 back. `filter` mirrors the real SDK's pb.filter(raw, params)
// binding (Fix 2) — it just returns the raw string for the mock's purposes.
vi.mock('../src/lib/pb', () => {
  const notFound = Object.assign(new Error('not found'), { status: 404 });
  return {
    pbAdmin: vi.fn().mockResolvedValue({
      filter: (raw: string) => raw,
      collection: () => ({
        getFirstListItem: vi.fn().mockRejectedValue(notFound),
        create: vi.fn().mockResolvedValue({ id: 'pb-id-1' }),
      }),
    }),
  };
});

describe('auth middleware', () => {
  it('401 when no Authorization header', async () => {
    const app = new Hono()
      .use('/api/*', authMiddleware)
      .get('/api/x', (c) => c.text('ok'));
    const res = await app.request('/api/x');
    expect(res.status).toBe(401);
  });

  it('401 when token verification throws', async () => {
    verifyImpl = () => Promise.reject(new Error('Firebase: invalid signature'));
    const app = new Hono()
      .use('/api/*', authMiddleware)
      .get('/api/x', (c) => c.text('ok'));
    const res = await app.request('/api/x', {
      headers: { Authorization: 'Bearer bad' },
    });
    expect(res.status).toBe(401);
  });

  it('passes with valid token, sets c.var.uid + c.var.pbUserId', async () => {
    verifyImpl = () => Promise.resolve({ uid: 'fb-uid-123', email: 'a@test' });
    const app = new Hono()
      .use('/api/*', authMiddleware)
      .get('/api/x', (c) => c.json({ uid: c.var.uid, pbUserId: c.var.pbUserId }));
    const res = await app.request('/api/x', {
      headers: { Authorization: 'Bearer good' },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ uid: 'fb-uid-123', pbUserId: 'pb-id-1' });
  });

  // Reviewer fix B1b: the UID->pbUserId LRU cache means a second request with the
  // same UID must NOT re-query PocketBase. The token, however, is ALWAYS verified.
  it('caches UID->pbUserId: pbAdmin once, verifyIdToken per request', async () => {
    // Unique UID so the module-level LRU (which persists across tests in this
    // file) is guaranteed empty for this case — no cross-test contamination.
    const uid = 'fb-uid-cache-only';
    let verifyCalls = 0;
    verifyImpl = () => {
      verifyCalls += 1;
      return Promise.resolve({ uid, email: 'cache@test' });
    };

    // Reset pbAdmin call history so the assertion is independent of prior tests.
    vi.mocked(pbAdmin).mockClear();

    const app = new Hono()
      .use('/api/*', authMiddleware)
      .get('/api/x', (c) => c.json({ pbUserId: c.var.pbUserId }));

    const first = await app.request('/api/x', {
      headers: { Authorization: 'Bearer good' },
    });
    const second = await app.request('/api/x', {
      headers: { Authorization: 'Bearer good' },
    });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    // The PocketBase lookup happened exactly once; the second request was served
    // from the LRU cache.
    expect(vi.mocked(pbAdmin)).toHaveBeenCalledTimes(1);
    // The token is verified on every request, cache hit or not.
    expect(verifyCalls).toBe(2);
  });
});
