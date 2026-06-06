import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';

const app = new Hono();

app.get('/health', (c) => c.json({ ok: true, ts: Date.now() }));

// --- Single-container static serving (finalized in M2) ---------------------
// In production the built web SPA lives next to the compiled server. From
// dist/index.js that is ../web; from src/index.ts (tsx dev) it is ../../web/dist.
// We only mount serveStatic when the directory actually exists so `pnpm dev`
// (no build yet) keeps working and the dev server never 500s on a missing dir.
const here = dirname(fileURLToPath(import.meta.url));
const webDistCandidates = [join(here, '../web'), join(here, '../../web/dist')];
const webRoot = webDistCandidates.find((p) => existsSync(p));

if (webRoot) {
  app.use('/*', serveStatic({ root: webRoot }));
  // SPA fallback: any unmatched, non-API route returns index.html.
  // All /api/* routes must be registered ABOVE this SPA fallback (see M2).
  // API paths must never be swallowed by the catch-all: fall through to the
  // (future) API handlers / 404 so they never receive index.html.
  const serveIndex = serveStatic({ path: join(webRoot, 'index.html') });
  app.get('*', (c, next) => {
    if (c.req.path.startsWith('/api/')) return next();
    return serveIndex(c, next);
  });
  console.log(`finance-tracker serving web from ${webRoot}`);
}

const port = Number(process.env.PORT) || 3110;
serve({ fetch: app.fetch, port });
console.log(`finance-tracker BFF on :${port}`);
