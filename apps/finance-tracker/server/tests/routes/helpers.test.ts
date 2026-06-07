import { describe, it, expect, vi } from 'vitest';
import { HTTPException } from 'hono/http-exception';
import { requireOwned, parseBody } from '../../src/routes/_helpers';
import { z } from 'zod';

describe('requireOwned (ownership chokepoint)', () => {
  it('returns the record when the owner matches', async () => {
    const repo = { get: vi.fn().mockResolvedValue({ id: 'r1', user: 'u1' }) };
    const rec = await requireOwned(repo, 'r1', 'u1');
    expect(rec).toEqual({ id: 'r1', user: 'u1' });
  });

  it('throws 404 when the record belongs to another user (no 403 — no existence leak)', async () => {
    const repo = { get: vi.fn().mockResolvedValue({ id: 'r1', user: 'OTHER' }) };
    await expect(requireOwned(repo, 'r1', 'u1')).rejects.toMatchObject({
      status: 404,
    });
  });

  it('throws 404 when the record does not exist (repo.get rejects)', async () => {
    const notFound = Object.assign(new Error('not found'), { status: 404 });
    const repo = { get: vi.fn().mockRejectedValue(notFound) };
    const err = await requireOwned(repo, 'missing', 'u1').catch((e) => e);
    expect(err).toBeInstanceOf(HTTPException);
    expect(err.status).toBe(404);
  });
});

describe('parseBody', () => {
  const schema = z.object({ label: z.string().min(1) });

  it('returns parsed data on a valid body', () => {
    expect(parseBody(schema, { label: 'ok' })).toEqual({ label: 'ok' });
  });

  it('throws a 400 HTTPException on an invalid body', () => {
    const err = (() => {
      try {
        parseBody(schema, { label: '' });
      } catch (e) {
        return e as HTTPException;
      }
    })();
    expect(err).toBeInstanceOf(HTTPException);
    expect(err!.status).toBe(400);
  });
});
