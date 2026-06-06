import { describe, it, expect, beforeAll } from 'vitest';

// pb.ts reads PB_ADMIN_TOKEN / PB_URL at import time and throws if no admin
// credentials are present, so we set them BEFORE importing the module. We use
// the token path (reviewer fix B2) — no live PocketBase or real credentials.
// The token is a minimal unsigned JWT with a far-future `exp` so PocketBase's
// authStore.isValid getter (which decodes the payload and checks expiry)
// reports the client as authenticated.
function fakeJwt(expSeconds: number): string {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ exp: expSeconds })).toString('base64url');
  return `${header}.${payload}.`;
}

let pbAdmin: (typeof import('../../src/lib/pb'))['pbAdmin'];

beforeAll(async () => {
  process.env.PB_URL = 'http://127.0.0.1:8090';
  process.env.PB_ADMIN_TOKEN = fakeJwt(Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365);
  ({ pbAdmin } = await import('../../src/lib/pb'));
});

describe('pbAdmin', () => {
  it('returns a new instance per call (no shared authStore)', async () => {
    const a = await pbAdmin();
    const b = await pbAdmin();
    expect(a).not.toBe(b);
  });

  it('authenticates the returned client', async () => {
    const pb = await pbAdmin();
    expect(pb.authStore.isValid).toBe(true);
  });
});
