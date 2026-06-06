import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import * as Sentry from '@sentry/node';

// Reviewer fix N4: central error handler so every unhandled route error is
// reported to Sentry (no-op when SENTRY_DSN is unset — Sentry.init was skipped,
// captureException just drops). HTTPExceptions keep their intended status; any
// other throw becomes a 500. Wire via app.onError(errorHandler).
export function errorHandler(err: Error, c: Context): Response {
  Sentry.captureException(err);
  if (err instanceof HTTPException) {
    return err.getResponse();
  }
  return c.json({ error: 'internal_error' }, 500);
}
