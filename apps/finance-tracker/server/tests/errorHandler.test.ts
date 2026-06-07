import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

// Mock the Sentry SDK so the test asserts captureException is invoked without a
// real DSN / network. captureException is a no-op in prod when SENTRY_DSN is
// unset (init skipped), but the error handler always calls it.
const captureException = vi.fn();
vi.mock('@sentry/node', () => ({
  captureException: (...a: unknown[]) => captureException(...a),
}));

import { errorHandler } from '../src/middleware/errorHandler';

beforeEach(() => captureException.mockReset());

describe('errorHandler', () => {
  it('reports a thrown route error to Sentry and returns 500', async () => {
    const app = new Hono();
    app.onError(errorHandler);
    app.get('/boom', () => {
      throw new Error('kaboom');
    });

    const res = await app.request('/boom');

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'internal_error' });
    expect(captureException).toHaveBeenCalledTimes(1);
    expect(captureException.mock.calls[0][0]).toBeInstanceOf(Error);
    expect((captureException.mock.calls[0][0] as Error).message).toBe('kaboom');
  });
});
