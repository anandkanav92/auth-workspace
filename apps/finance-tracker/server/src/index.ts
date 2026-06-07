import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import * as Sentry from '@sentry/node';
import { authMiddleware } from './middleware/auth';
import { rateLimit } from './middleware/rateLimit';
import { authRoutes } from './routes/auth';
import { accountRoutes } from './routes/accounts';
import { holdingRoutes } from './routes/holdings';
import { transactionRoutes } from './routes/transactions';
import { importRoutes } from './routes/import';
import { searchRoutes } from './routes/search';
import { marketDataRoutes } from './routes/marketData';
import { portfolioRoutes } from './routes/portfolio';
import { errorHandler } from './middleware/errorHandler';

// Reviewer fix N4: error tracking. No-op locally (init skipped without a DSN).
if (process.env.SENTRY_DSN) {
  Sentry.init({ dsn: process.env.SENTRY_DSN, tracesSampleRate: 0.1 });
}

const app = new Hono();

// Central error handler reports unhandled route errors to Sentry.
app.onError(errorHandler);

app.get('/health', (c) => c.json({ ok: true, ts: Date.now() }));

// --- API routes (MUST be registered ABOVE the SPA fallback below) ----------
// Every /api/* request requires a valid Firebase ID token; authMiddleware sets
// c.var.uid / email / pbUserId for downstream handlers. Rate limiting runs
// AFTER auth so we have a UID to key the per-user budget on (60 req/min).
app.use('/api/*', authMiddleware);
app.use('/api/*', rateLimit({ limit: 60, windowMs: 60_000, keyFn: (c) => c.var.uid }));
app.route('/api/auth', authRoutes);
app.route('/api/accounts', accountRoutes);
app.route('/api/holdings', holdingRoutes);
app.route('/api/transactions', transactionRoutes);
app.route('/api/import', importRoutes);
app.route('/api/search', searchRoutes);
app.route('/api/portfolio', portfolioRoutes);
// Shared market data (prices / profiles / fx). Routes declare their own
// /prices, /profiles, /fx subpaths so they mount under the /api prefix. Authed
// but NOT user-scoped (same model as /api/search).
app.route('/api', marketDataRoutes);

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

// --- Background cron jobs (M8) ---------------------------------------------
// Gated by CRON_ENABLED so tests and `pnpm dev` never auto-run real network
// jobs; only the production container sets CRON_ENABLED=true. Jobs schedule in
// Europe/Amsterdam and are idempotent across reruns/restarts.
if (process.env.CRON_ENABLED === 'true') {
  const { startCron, CRON_JOBS } = await import('./cron/index');
  startCron();
  console.log(
    `finance-tracker cron enabled (${CRON_JOBS.map((j) => j.name).join(', ')})`,
  );

  // Self-heal market data on boot. node-cron only fires at scheduled times, so a
  // deploy/restart BETWEEN ticks leaves price_cache + fx_rates stale — or empty
  // on a first boot. The schedules make this acute: prices refresh only on
  // weekday hours, FX only at 16:30. Without this, a fresh deploy + import on a
  // weekend shows €0 for everything until Monday. Run FX then prices once now;
  // best-effort and fully detached so a slow/failed upstream never blocks boot.
  void (async () => {
    try {
      const { runRefreshFx } = await import('./cron/refreshFx');
      console.log('[boot] refreshFx', await runRefreshFx());
    } catch (err) {
      console.error('[boot] refreshFx failed:', err);
    }
    try {
      const { runRefreshPrices } = await import('./cron/refreshPrices');
      console.log('[boot] refreshPrices', await runRefreshPrices());
    } catch (err) {
      console.error('[boot] refreshPrices failed:', err);
    }
    // Seed today's holdings snapshot (idempotent per day) so the value-over-time
    // chart has a point immediately and starts accumulating from first deploy.
    try {
      const { runSnapshotHoldings } = await import('./cron/snapshotHoldings');
      console.log('[boot] snapshotHoldings', await runSnapshotHoldings());
    } catch (err) {
      console.error('[boot] snapshotHoldings failed:', err);
    }
  })();
}
