# Investment Dashboard Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task.

**Goal:** Ship v1 of `apps/finance-tracker/` — a polish-first multi-tenant investment dashboard with Excel statement import, manual CRUD, hourly price refresh, and Phase 1 analytics tiles.

**Architecture:** Vite + React 19 + TS PWA → Hono BFF → PocketBase (per-user data + shared market data). Yahoo Finance primary + Finnhub fallback + ECB FX. Firebase Google Auth. Snapshot-replace upload semantics; transactions log for manual events; nightly `holdings_snapshot` cron for history.

**Tech Stack:** Vite 8, React 19, TypeScript 5, Tailwind CSS v4, shadcn/ui, ECharts via echarts-for-react, Framer Motion, TanStack Query + Router, Hono, yahoo-finance2, finnhub, PocketBase JS SDK, papaparse, sheetjs/xlsx, zod, vitest, playwright (smoke only).

**Reference:** See `2026-06-06-investment-dashboard-design.md` in this folder for the full validated design.

---

## Milestone overview

| # | Milestone | Depends on | Done when |
|---|---|---|---|
| 0 | Workspace scaffolding | — | `pnpm --filter finance-tracker dev` serves a blank PWA on :5174 and BFF on :3110 |
| 1 | PocketBase schema | — (can parallel with M0) | All 8 collections + rules exist; smoke test reads each |
| 2 | BFF: auth middleware + health | 0, 1 | `GET /api/auth/me` returns user info for a valid Firebase ID token; 401 otherwise |
| 3 | External providers (Yahoo + Finnhub + ECB) | 0 | Unit tests pass for each provider against fixture responses; live smoke test caches one ticker |
| 4 | Data access layer (typed PocketBase wrappers) | 1, 2 | All 8 collection accessors have tests against a throwaway PocketBase instance |
| 5 | Accounts + holdings + transactions CRUD endpoints | 2, 4 | E2E test: create account → add holding → sell → query holdings reflects state |
| 6 | Statement importers | 4 | Real T212 + Revolut fixture files parse to expected ParsedStatement; import endpoint roundtrips |
| 7 | Search endpoint + ticker resolution | 3, 4 | `GET /api/search?q=apple` returns AAPL et al, caching new hits to `symbol_profiles` |
| 8 | Cron jobs (price refresh, FX, snapshots) | 3, 4 | All 4 crons fire on schedule under fake-timers; idempotent across reruns |
| 9 | Frontend: theming + layout shell | 0 | Hero strip + bottom tab bar + light/dark toggle render in both modes |
| 10 | Frontend: auth gate + routing | 2, 9 | Sign in, sign out work end-to-end; protected routes redirect |
| 11 | Frontend: tile components | 4, 5, 7, 9 | All 6 Phase 1 tiles render correctly against fixture portfolio |
| 12 | Frontend: upload + import UX | 6, 9 | Drag-drop CSV/XLSX → preview screen → confirm writes; idempotency on re-upload |
| 13 | Frontend: search + add position UX | 7, 9 | Cmd-K → ticker → add modal → holding appears in dashboard |
| 14 | Frontend: holdings list + sell UX | 5, 11 | Holdings page renders; sell flow writes transaction + decrements holding |
| 15 | Polish pass (skeletons, animations, empty states, undo) | 11–14 | Lighthouse PWA score ≥ 90; UI checklist green |
| 16 | Production deployment + cron + monitoring | all | App live at `invest.cya.run` with hourly refresh running |

**Parallelism opportunities:**
- M0, M1, M3 are independent; can run in three streams.
- M9 + M10 (frontend foundations) can start as soon as M0 done; don't need backend.
- M11–14 can be split across 4 parallel frontend tasks once M2, M5, M7 land.

---

## Conventions used throughout this plan

- **TDD cycle** for backend logic: write failing test → run → implement → run → commit. UI tasks use behaviour tests (Vitest + Testing Library) where they meaningfully verify behaviour; pure styling tasks use visual checklists.
- **Commit cadence:** one commit per task. Conventional Commits: `feat(finance-tracker): ...`, `test(finance-tracker): ...`, `chore(finance-tracker): ...`.
- **All paths** are relative to `auth-workspace/`.
- **Reference existing apps** for stylistic patterns: `apps/dutch-app/` for Tailwind + TS conventions; `apps/habit-tracker/` for PocketBase usage patterns (especially `src/lib/pb.js` and `src/hooks/useHabits.js`).

---

## Milestone 0 — Workspace scaffolding

**Goal:** Two services in `apps/finance-tracker/` (`web/` and `server/`), running via `pnpm dev`, building under Docker.

### Task 0.1: Create app skeleton

**Files:**
- Create: `apps/finance-tracker/package.json`
- Create: `apps/finance-tracker/.gitignore`
- Create: `apps/finance-tracker/README.md`

**Step 1 — Create the package.json**

```json
{
  "name": "finance-tracker",
  "private": true,
  "version": "0.1.0",
  "scripts": {
    "dev": "pnpm --parallel /^dev:/",
    "dev:web": "pnpm --filter ./web dev",
    "dev:server": "pnpm --filter ./server dev",
    "build": "pnpm --filter ./web build && pnpm --filter ./server build",
    "test": "pnpm --recursive test"
  }
}
```

**Step 2 — Add gitignore + readme**

`.gitignore`:
```
node_modules
dist
.env
.env.local
*.log
```

`README.md` — 10 lines, points to the design doc.

**Step 3 — Commit**

```bash
git add apps/finance-tracker/package.json apps/finance-tracker/.gitignore apps/finance-tracker/README.md
git commit -m "feat(finance-tracker): scaffold app folder"
```

### Task 0.2: Scaffold the Vite + React + TS frontend

**Files:**
- Create: `apps/finance-tracker/web/package.json`
- Create: `apps/finance-tracker/web/vite.config.ts`
- Create: `apps/finance-tracker/web/tsconfig.json`
- Create: `apps/finance-tracker/web/index.html`
- Create: `apps/finance-tracker/web/src/main.tsx`
- Create: `apps/finance-tracker/web/src/App.tsx`

**Step 1 — Use Vite to scaffold (don't commit node_modules)**

```bash
cd apps/finance-tracker
pnpm create vite@latest web -- --template react-ts
```

Accept defaults. Manually edit `web/package.json` to add: `"@myorg/auth-google": "workspace:*"`, `"firebase": "^11.0.0"`.

**Step 2 — Pin port + add PWA basics**

In `web/vite.config.ts`:
```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5174, host: true },
});
```

**Step 3 — Verify it runs**

```bash
pnpm install
pnpm --filter web dev
# → expect "Local: http://localhost:5174"
```

**Step 4 — Commit**

```bash
git add apps/finance-tracker/web pnpm-lock.yaml
git commit -m "feat(finance-tracker): scaffold Vite React TS frontend"
```

### Task 0.3: Scaffold the Hono BFF

**Files:**
- Create: `apps/finance-tracker/server/package.json`
- Create: `apps/finance-tracker/server/tsconfig.json`
- Create: `apps/finance-tracker/server/src/index.ts`

**Step 1 — Set up the package**

`server/package.json`:
```json
{
  "name": "finance-tracker-server",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "test": "vitest run"
  },
  "dependencies": {
    "hono": "^4.0.0",
    "@hono/node-server": "^1.0.0",
    "firebase-admin": "^13.0.0",
    "pocketbase": "^0.23.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "tsx": "^4.7.0",
    "typescript": "^5",
    "@types/node": "^20",
    "vitest": "^4.1.0"
  }
}
```

**Step 2 — Minimal Hono server**

`server/src/index.ts`:
```ts
import { serve } from '@hono/node-server';
import { Hono } from 'hono';

const app = new Hono();

app.get('/health', (c) => c.json({ ok: true, ts: Date.now() }));

const port = Number(process.env.PORT) || 3110;
serve({ fetch: app.fetch, port });
console.log(`finance-tracker BFF on :${port}`);
```

**Step 3 — Verify it runs**

```bash
pnpm install
pnpm --filter finance-tracker-server dev
# in another shell:
curl http://localhost:3110/health
# expect: {"ok":true,"ts":...}
```

**Step 4 — Commit**

```bash
git add apps/finance-tracker/server pnpm-lock.yaml
git commit -m "feat(finance-tracker): scaffold Hono BFF with /health endpoint"
```

### Task 0.4: Wire up parallel `pnpm dev`

**Files:**
- Verify: `apps/finance-tracker/package.json` scripts use `pnpm -r --parallel` correctly.

**Step 1 — Test it**

```bash
cd auth-workspace
pnpm --filter finance-tracker dev
# expect both web (5174) and server (3110) to start
```

**Step 2 — Commit if any tweaks needed**

```bash
git commit -m "chore(finance-tracker): tweak parallel dev scripts" --allow-empty
```

### Task 0.5: Stub Dockerfile + docker-compose

**Files:**
- Create: `apps/finance-tracker/Dockerfile`
- Create: `apps/finance-tracker/docker-compose.yml`

**Step 1 — Multi-stage Dockerfile**

```dockerfile
# Stage 1: build web
FROM node:24-alpine AS web-builder
WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages packages
COPY apps/finance-tracker apps/finance-tracker
RUN corepack enable && pnpm install --frozen-lockfile
ARG VITE_FIREBASE_API_KEY
ARG VITE_FIREBASE_AUTH_DOMAIN
ARG VITE_FIREBASE_PROJECT_ID
ARG VITE_FIREBASE_APP_ID
ENV VITE_FIREBASE_API_KEY=$VITE_FIREBASE_API_KEY \
    VITE_FIREBASE_AUTH_DOMAIN=$VITE_FIREBASE_AUTH_DOMAIN \
    VITE_FIREBASE_PROJECT_ID=$VITE_FIREBASE_PROJECT_ID \
    VITE_FIREBASE_APP_ID=$VITE_FIREBASE_APP_ID
RUN pnpm --filter finance-tracker-web build

# Stage 2: build server
FROM node:24-alpine AS server-builder
WORKDIR /app
COPY --from=web-builder /app .
RUN pnpm --filter finance-tracker-server build

# Stage 3: runtime
FROM node:24-alpine
WORKDIR /app
COPY --from=server-builder /app/apps/finance-tracker/server/dist ./server
COPY --from=web-builder /app/apps/finance-tracker/web/dist ./web
COPY --from=server-builder /app/node_modules ./node_modules
EXPOSE 80
ENV PORT=80
CMD ["node", "server/index.js"]
```

**Step 2 — Compose**

```yaml
services:
  finance-tracker:
    build:
      context: ../..
      dockerfile: apps/finance-tracker/Dockerfile
      args:
        VITE_FIREBASE_API_KEY: ${VITE_FIREBASE_API_KEY}
        VITE_FIREBASE_AUTH_DOMAIN: ${VITE_FIREBASE_AUTH_DOMAIN}
        VITE_FIREBASE_PROJECT_ID: ${VITE_FIREBASE_PROJECT_ID}
        VITE_FIREBASE_APP_ID: ${VITE_FIREBASE_APP_ID}
    ports:
      - "3110:80"
    env_file:
      - .env
    restart: unless-stopped
    networks:
      - mac-mini-net
networks:
  mac-mini-net:
    external: true
```

**Step 3 — Note**: server's static-file serving (Hono's `serveStatic`) for the `web/dist` directory will be wired in Milestone 2. Don't `docker build` yet — it'll fail. This task just lays the file.

**Step 4 — Commit**

```bash
git add apps/finance-tracker/Dockerfile apps/finance-tracker/docker-compose.yml
git commit -m "feat(finance-tracker): add Dockerfile + compose skeleton"
```

---

## Milestone 1 — PocketBase schema

**Goal:** All 8 collections (5 per-user + 3 shared) exist in PocketBase with correct rules.

**Reference:** This workspace's PocketBase instance is shared across apps. We're adding our 8 collections alongside `habit-tracker`'s ones. Use the PocketBase admin UI on first pass (`http://localhost:8090/_/`), then export the schema to JSON and check it in.

### Task 1.1: Create per-user collections

**Files:**
- Create: `apps/finance-tracker/server/pb-schema/per-user.json` (collection definitions)

**Step 1 — Define each collection (in admin UI, then export)**

For each of `accounts`, `holdings`, `transactions`, `imports`, `holdings_snapshot`:

- Add field `user`: type `relation`, target `users`, required, single, cascadeDelete=true
- Add fields per the design doc (see §4)
- Set all five list/view/create/update/delete rules to:
  ```
  @request.auth.id != "" && user = @request.auth.id
  ```

**Step 2 — Add indexes**

- `holdings`: composite index on `(user, account, ticker)` — unique.
- `transactions`: index on `(user, account, occurred_at)`.
- `imports`: index on `(user, file_hash)` — unique (idempotency).
- `holdings_snapshot`: index on `(user, account, ticker, date)` — unique.

**Step 3 — Export schema**

```bash
# from the PB admin UI: Settings → Export collections → save the JSON
mv ~/Downloads/pb_schema.json apps/finance-tracker/server/pb-schema/per-user.json
```

**Step 4 — Commit**

```bash
git add apps/finance-tracker/server/pb-schema/per-user.json
git commit -m "feat(finance-tracker): add per-user PocketBase collections"
```

### Task 1.2: Create shared collections

**Files:**
- Create: `apps/finance-tracker/server/pb-schema/shared.json`

**Step 1 — Define `symbol_profiles`, `price_cache`, `fx_rates`**

For each:
- listRule + viewRule: `@request.auth.id != ""`
- createRule + updateRule + deleteRule: **leave blank** (superuser only)

Fields per design doc §4.

**Step 2 — Indexes**

- `symbol_profiles`: unique on `ticker`; non-unique on `isin`.
- `price_cache`: unique on `ticker`.
- `fx_rates`: unique on `date`.

**Step 3 — Export + commit**

```bash
git add apps/finance-tracker/server/pb-schema/shared.json
git commit -m "feat(finance-tracker): add shared PocketBase collections"
```

### Task 1.3: Verify rules with a smoke test

**Files:**
- Create: `apps/finance-tracker/server/tests/pb-rules.test.ts`

**Step 1 — Write the test**

```ts
import { describe, it, expect, beforeAll } from 'vitest';
import PocketBase from 'pocketbase';

describe('PocketBase per-user rules', () => {
  let pbA: PocketBase, pbB: PocketBase;
  beforeAll(async () => {
    pbA = new PocketBase(process.env.PB_URL);
    pbB = new PocketBase(process.env.PB_URL);
    await pbA.collection('users').authWithPassword('a@test', 'testtest');
    await pbB.collection('users').authWithPassword('b@test', 'testtest');
  });

  it('user A cannot see user B holdings', async () => {
    await pbB.collection('accounts').create({ user: pbB.authStore.model!.id, source: 'manual', label: 'B' });
    const seen = await pbA.collection('accounts').getFullList();
    expect(seen.find((a) => a.label === 'B')).toBeUndefined();
  });
});
```

**Step 2 — Run it**

```bash
pnpm --filter finance-tracker-server test
```

Expected: PASS.

**Step 3 — Commit**

```bash
git add apps/finance-tracker/server/tests/pb-rules.test.ts
git commit -m "test(finance-tracker): verify PocketBase per-user isolation"
```

---

## Milestone 2 — BFF auth middleware

**Goal:** Every `/api/*` endpoint requires a valid Firebase ID token. PocketBase user is upserted on first hit.

### Task 2.1: Firebase Admin init

**Files:**
- Create: `apps/finance-tracker/server/src/lib/firebase.ts`

```ts
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT!);
initializeApp({ credential: cert(sa) });

export const firebaseAuth = getAuth();
```

Commit: `chore(finance-tracker): wire Firebase Admin SDK`

### Task 2.2: PocketBase admin client

**Files:**
- Create: `apps/finance-tracker/server/src/lib/pb.ts`

```ts
import PocketBase from 'pocketbase';

const pb = new PocketBase(process.env.PB_URL);

export async function pbAdmin(): Promise<PocketBase> {
  if (!pb.authStore.isValid) {
    await pb.admins.authWithPassword(process.env.PB_ADMIN_EMAIL!, process.env.PB_ADMIN_PASSWORD!);
  }
  return pb;
}
```

Commit: `chore(finance-tracker): add PocketBase admin client`

### Task 2.3: Auth middleware + /api/auth/me

**Files:**
- Create: `apps/finance-tracker/server/src/middleware/auth.ts`
- Create: `apps/finance-tracker/server/src/routes/auth.ts`
- Modify: `apps/finance-tracker/server/src/index.ts`
- Create: `apps/finance-tracker/server/tests/auth.test.ts`

**Step 1 — Test first**

```ts
// tests/auth.test.ts
import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';
import { authMiddleware } from '../src/middleware/auth';

vi.mock('../src/lib/firebase', () => ({
  firebaseAuth: { verifyIdToken: vi.fn().mockResolvedValue({ uid: 'fb-uid-123', email: 'a@test' }) },
}));

describe('auth middleware', () => {
  it('401 when no Authorization header', async () => {
    const app = new Hono().use('/api/*', authMiddleware).get('/api/x', (c) => c.text('ok'));
    const res = await app.request('/api/x');
    expect(res.status).toBe(401);
  });

  it('passes with valid token, sets c.var.uid', async () => {
    const app = new Hono().use('/api/*', authMiddleware).get('/api/x', (c) => c.json({ uid: c.var.uid }));
    const res = await app.request('/api/x', { headers: { Authorization: 'Bearer faketoken' } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ uid: 'fb-uid-123' });
  });
});
```

**Step 2 — Implement**

```ts
// src/middleware/auth.ts
import { createMiddleware } from 'hono/factory';
import { firebaseAuth } from '../lib/firebase';
import { pbAdmin } from '../lib/pb';

export const authMiddleware = createMiddleware<{
  Variables: { uid: string; email: string; pbUserId: string };
}>(async (c, next) => {
  const auth = c.req.header('Authorization');
  if (!auth?.startsWith('Bearer ')) return c.json({ error: 'unauthorized' }, 401);
  try {
    const decoded = await firebaseAuth.verifyIdToken(auth.slice(7));
    c.set('uid', decoded.uid);
    c.set('email', decoded.email!);
    // upsert PocketBase user
    const pb = await pbAdmin();
    const pbUser = await pb.collection('users').getFirstListItem(`firebase_uid="${decoded.uid}"`).catch(() => null);
    const pbUserId = pbUser?.id || (await pb.collection('users').create({
      firebase_uid: decoded.uid,
      email: decoded.email,
      emailVisibility: false,
      password: crypto.randomUUID(),
      passwordConfirm: '',
    })).id;
    c.set('pbUserId', pbUserId);
    await next();
  } catch (e) {
    return c.json({ error: 'invalid token' }, 401);
  }
});
```

**Step 3 — Wire route + run tests**

```ts
// src/routes/auth.ts
import { Hono } from 'hono';
export const authRoutes = new Hono().get('/me', (c) =>
  c.json({ uid: c.var.uid, email: c.var.email, pbUserId: c.var.pbUserId })
);
```

```ts
// src/index.ts (modify)
import { authMiddleware } from './middleware/auth';
import { authRoutes } from './routes/auth';
app.use('/api/*', authMiddleware);
app.route('/api/auth', authRoutes);
```

```bash
pnpm --filter finance-tracker-server test
# expect 2 PASS
```

**Step 4 — Commit**

```bash
git add apps/finance-tracker/server/src/middleware/auth.ts \
        apps/finance-tracker/server/src/routes/auth.ts \
        apps/finance-tracker/server/src/index.ts \
        apps/finance-tracker/server/tests/auth.test.ts
git commit -m "feat(finance-tracker): add Firebase auth middleware + /api/auth/me"
```

---

## Milestone 3 — External data providers

**Goal:** Three providers (`YahooPriceProvider`, `FinnhubPriceProvider`, `EcbFxProvider`) behind clean interfaces. Tested against fixture responses, smoked against live.

### Task 3.1: Provider interfaces

**Files:**
- Create: `apps/finance-tracker/server/src/providers/types.ts`

```ts
export type Quote = { ticker: string; price: number; currency: string; asOf: Date };

export type SymbolProfile = {
  ticker: string; isin?: string; name: string; exchange: string;
  listingCurrency: string; sector?: string; industry?: string;
  country?: string; marketCap?: number; peRatio?: number;
  beta?: number; dividendYield?: number;
};

export interface PriceProvider {
  name: 'yahoo' | 'finnhub';
  quote(ticker: string): Promise<Quote | null>;
  profile(ticker: string): Promise<SymbolProfile | null>;
  search(query: string): Promise<Array<{ ticker: string; name: string; exchange: string }>>;
}

export interface FxProvider {
  name: 'ecb';
  latest(): Promise<Record<string, number>>;
}
```

Commit: `chore(finance-tracker): define provider interfaces`

### Task 3.2: YahooPriceProvider

**Files:**
- Create: `apps/finance-tracker/server/src/providers/yahoo.ts`
- Create: `apps/finance-tracker/server/tests/providers/yahoo.test.ts`
- Create: `apps/finance-tracker/server/tests/fixtures/yahoo-aapl-quoteSummary.json`

**Step 1 — Write test against fixture**

Capture a real `yahoo-finance2.quoteSummary('AAPL', { modules: ['price','summaryDetail','assetProfile','defaultKeyStatistics'] })` response once into the fixture file. Then:

```ts
import { describe, it, expect, vi } from 'vitest';
import yahooFinance from 'yahoo-finance2';
import fixture from '../fixtures/yahoo-aapl-quoteSummary.json';
import { YahooPriceProvider } from '../../src/providers/yahoo';

describe('YahooPriceProvider', () => {
  it('maps quoteSummary to Quote + SymbolProfile', async () => {
    vi.spyOn(yahooFinance, 'quoteSummary').mockResolvedValue(fixture as any);
    const p = new YahooPriceProvider();
    const q = await p.quote('AAPL');
    expect(q?.price).toBeGreaterThan(0);
    const prof = await p.profile('AAPL');
    expect(prof?.sector).toBe('Technology');
    expect(prof?.country).toBe('United States');
  });

  it('returns null for unknown ticker', async () => {
    vi.spyOn(yahooFinance, 'quoteSummary').mockRejectedValue(new Error('Not Found'));
    const p = new YahooPriceProvider();
    expect(await p.quote('NOPE')).toBeNull();
  });
});
```

**Step 2 — Implement**

```ts
// src/providers/yahoo.ts
import yahooFinance from 'yahoo-finance2';
import type { PriceProvider, Quote, SymbolProfile } from './types';

export class YahooPriceProvider implements PriceProvider {
  name = 'yahoo' as const;

  private async getSummary(ticker: string) {
    try {
      return await yahooFinance.quoteSummary(ticker, {
        modules: ['price', 'summaryDetail', 'assetProfile', 'defaultKeyStatistics'],
      });
    } catch {
      return null;
    }
  }

  async quote(ticker: string): Promise<Quote | null> {
    const s = await this.getSummary(ticker);
    if (!s?.price?.regularMarketPrice) return null;
    return {
      ticker,
      price: s.price.regularMarketPrice,
      currency: s.price.currency!,
      asOf: new Date((s.price.regularMarketTime as Date) || Date.now()),
    };
  }

  async profile(ticker: string): Promise<SymbolProfile | null> {
    const s = await this.getSummary(ticker);
    if (!s?.price) return null;
    return {
      ticker,
      name: s.price.longName || s.price.shortName || ticker,
      exchange: s.price.exchangeName!,
      listingCurrency: s.price.currency!,
      sector: s.assetProfile?.sector,
      industry: s.assetProfile?.industry,
      country: s.assetProfile?.country,
      marketCap: s.price.marketCap,
      peRatio: s.summaryDetail?.trailingPE,
      beta: s.defaultKeyStatistics?.beta,
      dividendYield: s.summaryDetail?.dividendYield,
    };
  }

  async search(query: string) {
    const res = await yahooFinance.search(query, { quotesCount: 10, newsCount: 0 });
    return (res.quotes || []).filter((q: any) => q.symbol).map((q: any) => ({
      ticker: q.symbol, name: q.longname || q.shortname || q.symbol, exchange: q.exchange,
    }));
  }
}
```

**Step 3 — Run tests + commit**

```bash
pnpm --filter finance-tracker-server test providers/yahoo
git add apps/finance-tracker/server/src/providers/yahoo.ts \
        apps/finance-tracker/server/tests/providers/yahoo.test.ts \
        apps/finance-tracker/server/tests/fixtures/yahoo-aapl-quoteSummary.json
git commit -m "feat(finance-tracker): add YahooPriceProvider"
```

### Task 3.3: FinnhubPriceProvider

**Files:**
- Create: `apps/finance-tracker/server/src/providers/finnhub.ts`
- Create: `apps/finance-tracker/server/tests/providers/finnhub.test.ts`
- Create: `apps/finance-tracker/server/tests/fixtures/finnhub-{quote,profile2}.json`

Same TDD cycle. Use `fetch` directly (no npm dep needed — Finnhub's API is trivial):

```ts
export class FinnhubPriceProvider implements PriceProvider {
  name = 'finnhub' as const;
  constructor(private apiKey = process.env.FINNHUB_API_KEY!) {}

  async quote(ticker: string): Promise<Quote | null> {
    const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${this.apiKey}`);
    if (!r.ok) return null;
    const j = await r.json();
    if (!j.c) return null;
    return { ticker, price: j.c, currency: 'USD', asOf: new Date(j.t * 1000) };
  }

  async profile(ticker: string): Promise<SymbolProfile | null> {
    const r = await fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${ticker}&token=${this.apiKey}`);
    if (!r.ok) return null;
    const j = await r.json();
    return {
      ticker, name: j.name, exchange: j.exchange, listingCurrency: j.currency,
      country: j.country, marketCap: j.marketCapitalization * 1_000_000,
    };
  }

  async search(query: string) {
    const r = await fetch(`https://finnhub.io/api/v1/search?q=${encodeURIComponent(query)}&token=${this.apiKey}`);
    if (!r.ok) return [];
    const j = await r.json();
    return (j.result || []).map((s: any) => ({ ticker: s.symbol, name: s.description, exchange: '' }));
  }
}
```

Commit: `feat(finance-tracker): add FinnhubPriceProvider`

### Task 3.4: EcbFxProvider

**Files:**
- Create: `apps/finance-tracker/server/src/providers/ecb.ts`
- Create: `apps/finance-tracker/server/tests/providers/ecb.test.ts`
- Create: `apps/finance-tracker/server/tests/fixtures/ecb-eurofxref-daily.xml`

```ts
export class EcbFxProvider implements FxProvider {
  name = 'ecb' as const;

  async latest(): Promise<Record<string, number>> {
    const r = await fetch('https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml');
    const xml = await r.text();
    const rates: Record<string, number> = { EUR: 1 };
    for (const m of xml.matchAll(/currency='([A-Z]+)' rate='([\d.]+)'/g)) {
      rates[m[1]] = parseFloat(m[2]);
    }
    return rates;
  }
}
```

Test parses the captured XML fixture and asserts USD, GBP, JPY are present.

Commit: `feat(finance-tracker): add EcbFxProvider`

### Task 3.5: Provider chain (Yahoo → Finnhub fallback)

**Files:**
- Create: `apps/finance-tracker/server/src/providers/chain.ts`
- Create: `apps/finance-tracker/server/tests/providers/chain.test.ts`

```ts
import type { PriceProvider, Quote, SymbolProfile } from './types';

export class ProviderChain implements PriceProvider {
  name = 'yahoo' as const;
  constructor(private providers: PriceProvider[]) {}

  async quote(t: string) { return this.firstNonNull((p) => p.quote(t)); }
  async profile(t: string) { return this.firstNonNull((p) => p.profile(t)); }
  async search(q: string) {
    for (const p of this.providers) {
      const r = await p.search(q).catch(() => []);
      if (r.length) return r;
    }
    return [];
  }

  private async firstNonNull<T>(fn: (p: PriceProvider) => Promise<T | null>): Promise<T | null> {
    for (const p of this.providers) {
      const r = await fn(p).catch(() => null);
      if (r) return r;
    }
    return null;
  }
}
```

Test: chain returns Yahoo result when available, falls back to Finnhub when Yahoo returns null.

Commit: `feat(finance-tracker): add provider chain with Yahoo→Finnhub fallback`

---

## Milestone 4 — Data access layer

**Goal:** Typed PocketBase wrappers per collection. Keep all SQL-ish logic in this layer; routes call methods, not raw PocketBase.

### Task 4.1: Zod schemas mirroring PocketBase types

Create `server/src/db/schemas.ts` with `z.object({...})` for each collection. Generate TS types via `z.infer`.

Commit: `chore(finance-tracker): add Zod schemas for collections`

### Task 4.2: Per-user repos

For each of `accounts`, `holdings`, `transactions`, `imports`, `holdings_snapshot`:

- Create `server/src/db/<collection>.ts` exporting a class with methods: `list(pbUserId)`, `get(id)`, `create(data)`, `update(id, patch)`, `delete(id)`. Internally uses an admin PocketBase client but **scopes filters by `user = pbUserId`** for safety even though rules enforce it.
- Tests against a docker-compose-spun-up PocketBase instance.

5 commits, one per collection: `feat(finance-tracker): add <collection> repo`

### Task 4.3: Shared repos

For `symbol_profiles`, `price_cache`, `fx_rates`: classes with `upsert`, `get`, `list`. Admin-token writes.

3 commits.

---

## Milestone 5 — Account + holdings + transactions CRUD endpoints

**Goal:** Authenticated REST endpoints for per-user CRUD.

### Endpoint surface

```
POST   /api/accounts                      → create
GET    /api/accounts                      → list (this user only)
PATCH  /api/accounts/:id                  → update
DELETE /api/accounts/:id                  → delete (cascades to holdings via PB rule)

GET    /api/holdings?accountId=...        → list (or all if no filter)
POST   /api/holdings                      → manual add (writes tx + upsert holding)
PATCH  /api/holdings/:id                  → adjust qty/cost (writes adjustment tx)
DELETE /api/holdings/:id                  → full sell (writes sell tx, qty→0)
POST   /api/holdings/:id/sell             → partial sell (writes sell tx, decrements)

GET    /api/transactions?accountId=...    → list, paged
```

### Tasks (one per endpoint, TDD cycle each)

- 5.1: `POST /api/accounts` with test
- 5.2: `GET /api/accounts`
- 5.3: `PATCH /api/accounts/:id`
- 5.4: `DELETE /api/accounts/:id`
- 5.5: `GET /api/holdings`
- 5.6: `POST /api/holdings` (writes `transactions{type:'buy'}` then upserts holding by `(user, account, ticker)`)
- 5.7: `POST /api/holdings/:id/sell` (writes `transactions{type:'sell'}`, decrements holding; if qty becomes 0, sets a `closed_at` field)
- 5.8: `PATCH /api/holdings/:id` (writes `transactions{type:'adjustment'}`)
- 5.9: `DELETE /api/holdings/:id` (full sell; prompts for sale price client-side)
- 5.10: `GET /api/transactions` with pagination

Each is its own commit: `feat(finance-tracker): <endpoint>`.

### Task 5.11: E2E test

```ts
// tests/e2e/portfolio.test.ts
it('full lifecycle: account → add → adjust → sell', async () => {
  const acc = await POST('/api/accounts', { source: 'manual', label: 'Test' });
  await POST('/api/holdings', { account: acc.id, ticker: 'AAPL', quantity: 10, cost_basis: 1500, cost_currency: 'EUR' });
  await PATCH(`/api/holdings/${h.id}`, { quantity: 12 });
  await POST(`/api/holdings/${h.id}/sell`, { quantity: 5, price: 180, currency: 'USD' });
  const txns = await GET('/api/transactions');
  expect(txns.length).toBe(3); // buy + adjustment + sell
});
```

Commit: `test(finance-tracker): e2e portfolio lifecycle`

---

## Milestone 6 — Statement importers

**Goal:** Trading 212 CSV + Revolut XLSX parse to `ParsedStatement`; import endpoint roundtrips with preview/commit semantics.

### Task 6.1: StatementImporter interface + ISIN→ticker resolution helper

Create `server/src/importers/types.ts` (interface from design §6).

Create `server/src/importers/resolveTicker.ts`: given an ISIN, hit `symbol_profiles` cache; if miss, call `YahooPriceProvider.search(isin)` (Yahoo accepts ISINs in search), cache the result.

Commit: `feat(finance-tracker): add importer interface + ISIN resolver`

### Task 6.2: Trading212CsvImporter

**Files:**
- Create: `server/src/importers/trading212.ts`
- Create: `server/tests/importers/trading212.test.ts`
- Create: `server/tests/fixtures/t212-sample.csv`

Use the documented T212 CSV schema:
```
Action,Time,ISIN,Ticker,Name,No. of shares,Price / share,Currency (Price / share),Exchange rate,...
```

Aggregate buy/sell actions into net positions per ticker. Test with a fixture CSV containing 3 buys + 1 sell of the same ticker; expect net position with cost-basis-averaged.

Commit: `feat(finance-tracker): add Trading212CsvImporter`

### Task 6.3: RevolutXlsxImporter

**Files:**
- Create: `server/src/importers/revolut.ts`
- Create: `server/tests/importers/revolut.test.ts`
- Create: `server/tests/fixtures/revolut-sample.xlsx`

Use SheetJS (`xlsx`). Find the "Positions" or "Holdings" section by header detection. Map columns. Test asserts a known position exists in the parsed output.

Commit: `feat(finance-tracker): add RevolutXlsxImporter`

### Task 6.4: Import endpoint — `/api/import/upload` (preview)

**Files:**
- Create: `server/src/routes/import.ts`
- Create: `server/tests/import.test.ts`

```
POST /api/import/upload  (multipart/form-data)
  body: file, accountId

  1. sha256(file)
  2. check imports collection for same hash on same account → 409 if found
  3. detect importer by file magic + filename
  4. parse → positions[]
  5. compute diff vs current holdings of that account
  6. for each new ticker not in symbol_profiles: synchronously fetch profile + price
  7. return { previewId, diff, summary }
```

Store the parsed result in a short-lived cache (in-memory map keyed by `previewId`, 10-min TTL) so commit can pick it up without re-parsing.

Commit: `feat(finance-tracker): add /api/import/upload (preview)`

### Task 6.5: Import commit endpoint — `/api/import/commit`

```
POST /api/import/commit
  body: { previewId }

  1. load preview
  2. delete all holdings for (user, account)
  3. insert new holdings from preview
  4. write imports row (hash, filename, row_count, status='success')
  5. return summary
```

Commit: `feat(finance-tracker): add /api/import/commit`

### Task 6.6: E2E roundtrip test

```ts
it('upload→preview→commit→re-upload-same is 409', async () => {
  const acc = await POST('/api/accounts', { source: 'trading212', label: 'T212 ISA' });
  const f = new FormData(); f.append('file', new Blob([fs.readFileSync('fixtures/t212-sample.csv')]), 't212.csv'); f.append('accountId', acc.id);
  const preview = await POSTmulti('/api/import/upload', f);
  await POST('/api/import/commit', { previewId: preview.previewId });
  const holdings = await GET(`/api/holdings?accountId=${acc.id}`);
  expect(holdings.length).toBeGreaterThan(0);
  const dup = await POSTmulti('/api/import/upload', f);
  expect(dup.status).toBe(409);
});
```

Commit: `test(finance-tracker): e2e import roundtrip + idempotency`

---

## Milestone 7 — Search + ticker resolution

**Goal:** `GET /api/search?q=apple` returns matches, caches new tickers into `symbol_profiles`.

### Task 7.1

- 7.1: `/api/search` endpoint hitting `symbol_profiles` first, falling back to `provider.search()`, caching new hits.
- 7.2: Tests: cached hit doesn't call provider; cache miss calls provider once + caches result.

Commits: `feat(finance-tracker): add /api/search`, `test(finance-tracker): search caching behaviour`.

---

## Milestone 8 — Cron jobs

**Goal:** Four crons (hourly prices, daily FX, nightly snapshots, weekly profile refresh). Run in the BFF process via `node-cron`. Idempotent.

### Tasks

- 8.1: `node-cron` setup in `server/src/cron/index.ts`; environment-gated (only enabled when `CRON_ENABLED=true`).
- 8.2: `refreshPrices.ts` — query `SELECT DISTINCT ticker FROM holdings WHERE quantity > 0` (across all users), batch fetch, upsert `price_cache`. Test: stub provider, assert correct upserts.
- 8.3: `refreshFx.ts` — call ECB, upsert `fx_rates` by today's date. Idempotent re-run.
- 8.4: `snapshotHoldings.ts` — for every account, for every holding, insert `holdings_snapshot{date: today}`. Skip if today's row already exists for that holding.
- 8.5: `refreshProfiles.ts` — find `symbol_profiles` with `last_refreshed_at < now - 7d`, refresh.
- 8.6: E2E test using `vi.useFakeTimers()` — advance to 09:00 Mon Amsterdam time, assert refreshPrices was called.

6 commits.

---

## Milestone 9 — Frontend: theming + layout shell

**Goal:** Empty PWA renders hero strip + bottom tab bar in both light and dark modes.

### Tasks

- 9.1: Install Tailwind v4. Add tokens.css with semantic variables (`--bg`, `--surface`, `--fg`, `--muted`, `--accent`, `--success`, `--danger`, `--warning`) for both light and dark.
- 9.2: Install shadcn/ui (CLI: `npx shadcn-ui@latest init`). Add components: button, sheet, dialog, dropdown-menu, command, skeleton, toast.
- 9.3: Theme provider hook: reads `localStorage('theme')` with `prefers-color-scheme` fallback; applies `data-theme` attribute to `<html>`. `<ThemeToggle />` cycles light/dark/system.
- 9.4: Layout components — `<HeroStrip />`, `<AccountTabs />`, `<TileGrid />`, `<BottomTabBar />`, `<FabMenu />`. Render with placeholder data.
- 9.5: Storybook-style visual smoke at `/dev/layout` showing both modes side-by-side.

5 commits.

---

## Milestone 10 — Frontend: auth gate + routing

### Tasks

- 10.1: `initAuth()` call at app entry (`src/main.tsx`) using `@myorg/auth-google`.
- 10.2: `AuthGate` component: shows `LoginPage` if `!user`, else children.
- 10.3: `LoginPage` with a single "Sign in with Google" button (`<SignInButton />` from `@myorg/auth-google`).
- 10.4: TanStack Router setup. Routes: `/portfolio`, `/account/:id`, `/account/:id/holdings`, `/settings`, `/import`, `/dev/layout`.
- 10.5: API client (`src/lib/api.ts`) — fetch wrapper that attaches Firebase ID token to every call, parses JSON, throws typed errors.
- 10.6: `useMe()` hook — TanStack Query against `/api/auth/me`. Drives the user avatar / sign-out menu.

6 commits.

---

## Milestone 11 — Frontend: tile components

### Tasks

- 11.1: `tiles/types.ts` + `tiles/registry.ts` + `tiles/usePortfolioData.ts` (TanStack Query joining `/api/holdings` + cached prices + symbol profiles + FX into a `Portfolio` object).
- 11.2: `<Allocation />` — donut chart (ECharts) with tabs for sector/country/currency.
- 11.3: `<Concentration />` — top 5 list with horizontal bars.
- 11.4: `<DiversificationScore />` — composite headline + 3 sub-scores; SVG circular progress (no chart lib needed).
- 11.5: `<Income />` — weighted yield + expected annual.
- 11.6: `<Quality />` — weighted P/E + weighted beta with one-line interpretation.
- 11.7: `<Treemap />` — full-width ECharts treemap, sized by value, coloured by P&L %.
- 11.8: Each tile gets a Vitest behaviour test against a fixture portfolio: `render(<Tile />, { wrapper: TestQueryProvider }); expect(screen.getByText(...))`.

8 commits.

---

## Milestone 12 — Frontend: upload + import UX

### Tasks

- 12.1: `/import` page with a drag-and-drop zone (`react-dropzone`).
- 12.2: On drop → POST to `/api/import/upload`. Show loading skeleton.
- 12.3: Preview screen — diff table (current → new), new-tickers callout, "Confirm 3 changes" CTA.
- 12.4: On confirm → POST to `/api/import/commit`. Show success toast, redirect to that account's dashboard.
- 12.5: 409 handling — clear modal "Already imported on YYYY-MM-DD, view that import?".
- 12.6: Playwright smoke test of the full flow against a test BFF.

6 commits.

---

## Milestone 13 — Frontend: search + add position UX

### Tasks

- 13.1: Cmd-K command palette using `cmdk` library wrapped in shadcn `<Command />`.
- 13.2: Debounced search calling `/api/search?q=...`. Show ticker + name + exchange.
- 13.3: "Add to..." sheet on selection: account dropdown, qty, cost, currency, date. Validate with Zod.
- 13.4: Submit → POST `/api/holdings`. Toast + close. Tile data invalidates.
- 13.5: Mobile variant: full-screen search overlay accessed from the bottom tab bar.

5 commits.

---

## Milestone 14 — Frontend: holdings list + sell

### Tasks

- 14.1: `/account/:id/holdings` route — flat list, virtualised if > 50 rows (`@tanstack/react-virtual`).
- 14.2: Position row: ticker badge + name + qty + EUR value + day P&L + weight%.
- 14.3: Tap → `<PositionSheet />` (shadcn sheet from bottom) with: full detail + edit qty/cost + partial sell + full sell buttons.
- 14.4: Sell flow → form (qty + price + currency) → POST `/api/holdings/:id/sell`. Optimistic decrement. Toast with undo (undo posts an adjustment to revert).
- 14.5: Closed positions visible behind a toggle ("Show closed").

5 commits.

---

## Milestone 15 — Polish pass

### Tasks

- 15.1: Skeleton screens for every async loading state. No spinners.
- 15.2: Number count-up animations on price refresh (Framer Motion).
- 15.3: Empty states with illustrations + single CTA.
- 15.4: Toast on every mutation, undo for destructive actions.
- 15.5: Pull-to-refresh on iOS Safari + Android Chrome.
- 15.6: Haptic feedback on confirm (`navigator.vibrate(10)`).
- 15.7: PWA manifest, icons (multiple sizes), splash screens.
- 15.8: Service worker for offline read of last-fetched data (Workbox or Vite plugin).
- 15.9: Lighthouse audit, target ≥ 90 PWA / ≥ 90 Performance.

9 commits.

---

## Milestone 16 — Deployment

### Tasks

- 16.1: Production `.env` template in `apps/finance-tracker/.env.example` (no real secrets).
- 16.2: Mac Mini: scp `.env`, `docker compose build`, `docker compose up -d`.
- 16.3: Cloudflare Tunnel — add `invest.cya.run → http://localhost:3110` route, reload tunnel.
- 16.4: Firebase Console: add `invest.cya.run` to Authorized Domains.
- 16.5: Verify smoke — sign in, upload a real T212 export, see real prices.
- 16.6: Set up cron monitor — ntfy alert if any cron fails 2x in a row.
- 16.7: Backup verification — confirm next nightly PocketBase backup includes our 8 collections.
- 16.8: DEPLOY.md in the app folder, modelled on `habit-tracker/DEPLOY.md`.

8 commits.

---

## Validation spikes (do these *before* implementation starts)

These are listed in design doc §11. Each is < 1 hour and may invalidate assumptions:

1. **Sample T212 export** — pull a real CSV from a live T212 account, eyeball columns.
2. **Sample Revolut export** — generate a current statement, confirm `.xlsx` (not PDF).
3. **Yahoo ticker resolution** — for ~20 likely tickers (AAPL, MSFT, ASML.AS, VWRL.L, IWDA.AS, BAS.DE, etc.) confirm `quoteSummary` returns sector + country + market cap.
4. **ECB FX freshness** — schedule the daily endpoint at 16:30 Amsterdam for 3 days, confirm same-day data lands consistently.
5. **PocketBase rule under realtime** — subscribe as user A, create a row for user B, confirm A doesn't see it.

If any of these come back ugly, revisit the design before continuing.

---

## Risks + open mitigations

| Risk | Mitigation |
|---|---|
| Yahoo Finance unofficial endpoint breaks | Finnhub fallback already in chain. If both break, manual price entry route + ECharts shows "stale" badge. |
| User uploads a malformed Excel | Preview step catches it; commit only runs after preview JSON is valid. |
| PocketBase realtime leaks across users | Smoke test in M1.3 catches the most common rule mistake; explicit double-filtering in the data access layer (filter by `user = pbUserId` even though rule enforces it). |
| Cron jobs miss a tick under fake-timer tests but pass in prod (or vice versa) | M8.6 forces fake-timer test; smoke-deploy the cron container with a 5-minute fake schedule to verify wiring. |
| Treemap with 100+ positions becomes unreadable | ECharts treemap supports drill-down; group small slices into "Other" with a click to expand. Implement in M11.7 from day one. |

---

## Execution Handoff

Plan complete and saved to `apps/finance-tracker/docs/plans/2026-06-06-investment-dashboard-implementation.md`. Two execution options:

**1. Subagent-Driven (this session)** — I dispatch a fresh subagent per task, review between tasks, fast iteration in this session.

**2. Parallel Session (separate)** — Open a new session with `superpowers:executing-plans`, batch execution with checkpoints.

**Which approach?**
