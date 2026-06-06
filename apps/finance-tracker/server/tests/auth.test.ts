import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { authMiddleware } from '../src/middleware/auth';

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
// users collection has no existing record (getFirstListItem rejects) so the
// middleware takes the create path and gets pb-id-1 back.
vi.mock('../src/lib/pb', () => ({
  pbAdmin: vi.fn().mockResolvedValue({
    collection: () => ({
      getFirstListItem: vi.fn().mockRejectedValue(new Error('not found')),
      create: vi.fn().mockResolvedValue({ id: 'pb-id-1' }),
    }),
  }),
}));

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
});
