import type { Context } from 'hono';
import { createMiddleware } from 'hono/factory';
import { LRUCache } from 'lru-cache';

// Reviewer fix B3: design §9 promised per-Firebase-UID, 60 req/min on /api/* but
// no plan task created it. Fixed-window counter backed by an LRU so stale keys
// evict themselves (ttl = windowMs). keyFn lets callers key on c.var.uid.
type Opts = { limit: number; windowMs: number; keyFn: (c: Context) => string };

export function rateLimit(opts: Opts) {
  const cache = new LRUCache<string, { count: number; resetAt: number }>({
    max: 10_000,
    ttl: opts.windowMs,
  });
  return createMiddleware(async (c, next) => {
    const key = opts.keyFn(c);
    const now = Date.now();
    const entry = cache.get(key);
    if (!entry || entry.resetAt < now) {
      cache.set(key, { count: 1, resetAt: now + opts.windowMs });
    } else {
      entry.count++;
      if (entry.count > opts.limit) {
        c.header('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
        return c.json({ error: 'rate_limited' }, 429);
      }
    }
    await next();
  });
}
