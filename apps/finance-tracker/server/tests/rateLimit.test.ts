import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { rateLimit } from '../src/middleware/rateLimit';

describe('rateLimit', () => {
  it('returns 429 after limit', async () => {
    const app = new Hono()
      .use('/api/*', rateLimit({ limit: 3, windowMs: 60_000, keyFn: () => 'uid-1' }))
      .get('/api/x', (c) => c.text('ok'));
    for (let i = 0; i < 3; i++) {
      const r = await app.request('/api/x');
      expect(r.status).toBe(200);
    }
    const blocked = await app.request('/api/x');
    expect(blocked.status).toBe(429);
  });

  it('keys per-UID — different UIDs share no counter', async () => {
    let uid = 'a';
    const app = new Hono()
      .use('/api/*', rateLimit({ limit: 1, windowMs: 60_000, keyFn: () => uid }))
      .get('/api/x', (c) => c.text('ok'));
    expect((await app.request('/api/x')).status).toBe(200);
    expect((await app.request('/api/x')).status).toBe(429); // a blocked
    uid = 'b';
    expect((await app.request('/api/x')).status).toBe(200); // b fresh
  });
});
