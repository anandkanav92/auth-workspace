# Investment Dashboard Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task.

**Goal:** Ship v1 of `apps/finance-tracker/` — a polish-first multi-tenant investment dashboard with Excel statement import, manual CRUD, hourly price refresh, and Phase 1 analytics tiles.

**Architecture:** Vite + React 19 + TS PWA → Hono BFF → PocketBase (per-user data + shared market data). Yahoo Finance primary + Finnhub fallback + ECB FX. Firebase Google Auth. Snapshot-replace upload semantics; transactions log for manual events; nightly `holdings_snapshot` cron for history.

**Tech Stack:** Vite 8, React 19, TypeScript 5, Tailwind CSS v4, shadcn/ui, ECharts via echarts-for-react, Framer Motion, TanStack Query + Router, Hono, yahoo-finance2 (v3, `new YahooFinance()`), finnhub, PocketBase JS SDK, pdfjs-dist (PDF statement parsing), fast-xml-parser (ECB), zod, vitest, playwright (smoke only).

**Reference:** See `2026-06-06-investment-dashboard-design.md` in this folder for the full validated design.

---

## Milestone overview

| # | Milestone | Depends on | Done when |
|---|---|---|---|
| 0 | Workspace scaffolding | — | `pnpm --filter finance-tracker dev` serves a blank PWA on :5173 and BFF on :3110 |
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
| 12 | Frontend: upload + import UX | 6, 9 | Drag-drop PDF → preview screen → confirm writes; idempotency on re-upload |
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
- **`c.var.pbUserId` is the only correct identifier for per-user PocketBase queries.** Never use `c.var.uid` (Firebase UID) directly in PB filters — repos and route handlers must filter by `user = pbUserId`. Drilled into reviewers as a code-review checklist item.
- **Cost basis methodology: weighted average cost.** When a user adds a position they already hold, new `cost_basis = (existing_cost + new_cost) / (existing_qty + new_qty)` × new_qty (stored as totals). On partial sell, `cost_basis` is reduced proportionally to the sold quantity. No FIFO/LIFO/tax-lot accounting in v1.

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
  server: { port: 5173, host: true },   // matches design §9 CORS allowlist (reviewer fix I10)
});
```

**Step 3 — Verify it runs**

```bash
pnpm install
pnpm --filter web dev
# → expect "Local: http://localhost:5173"
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
# expect both web (5173) and server (3110) to start
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

# Stage 3: runtime (production deps only — reviewer fix N7)
FROM node:24-alpine
WORKDIR /app
RUN corepack enable
COPY --from=server-builder /app/apps/finance-tracker/server/dist ./server
COPY --from=web-builder /app/apps/finance-tracker/web/dist ./web
COPY --from=server-builder /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=server-builder /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=server-builder /app/apps/finance-tracker/server/package.json ./server/package.json
RUN cd server && pnpm install --prod --frozen-lockfile --ignore-scripts
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

### Task 1.3: Migration runner (apply schema to prod)

**Reviewer fix (B7):** the original plan exported schema as JSON for git but had no story for applying it to production. Filling the gap.

**Files:**
- Create: `apps/finance-tracker/server/pb-schema/apply.ts`
- Create: `apps/finance-tracker/server/pb-schema/README.md`

**Approach:** use PocketBase's official **JS migrations** (in `pb_migrations/`), not "import the JSON from the admin UI". For each schema change:

1. Make the change in the local PocketBase admin UI.
2. From the admin UI, generate a migration file: Settings → Migrations → Create migration.
3. Commit the resulting `pb_migrations/*.js` file alongside our code.
4. On container boot, PocketBase auto-applies any new migrations.

**Step 1 — Document the workflow**

```markdown
# pb-schema/README.md

Migrations are PocketBase JS migration files committed under
`apps/finance-tracker/server/pb-schema/migrations/`. On every container
boot, PocketBase auto-applies any pending migrations from this directory.

## Creating a new migration
1. Make schema change in the local admin UI (http://localhost:8090/_/).
2. Settings → Migrations → "Take snapshot" → name it descriptively.
3. Move the generated file from your local PB instance into
   `apps/finance-tracker/server/pb-schema/migrations/` and commit.

## Applying in prod
The Mac Mini PocketBase container mounts our `migrations/` directory.
Migrations apply in lexicographic order on boot.
```

**Step 2 — Update docker-compose to mount migrations directory** (modify M0.5)

```yaml
volumes:
  - ./pb-schema/migrations:/pb/pb_migrations:ro
```

**Step 3 — Commit**

```bash
git add apps/finance-tracker/server/pb-schema/README.md apps/finance-tracker/docker-compose.yml
git commit -m "feat(finance-tracker): document PocketBase migration workflow"
```

### Task 1.4: Verify rules with a smoke test

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

**Reviewer fix (B2):** the original sketch shared a single PocketBase instance across all requests, racing on `authStore` under concurrent writes. Replaced with a per-call fresh client backed by a long-lived admin **impersonation token** loaded from `PB_ADMIN_TOKEN` at boot. If `PB_ADMIN_TOKEN` is absent, fall back to email/password and log a startup warning.

**Files:**
- Create: `apps/finance-tracker/server/src/lib/pb.ts`
- Create: `apps/finance-tracker/server/tests/lib/pb.test.ts`

```ts
// src/lib/pb.ts
import PocketBase from 'pocketbase';

const ADMIN_TOKEN = process.env.PB_ADMIN_TOKEN;
const ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.PB_ADMIN_PASSWORD;
const PB_URL = process.env.PB_URL!;

if (!ADMIN_TOKEN && !(ADMIN_EMAIL && ADMIN_PASSWORD)) {
  throw new Error('Set PB_ADMIN_TOKEN, or PB_ADMIN_EMAIL+PB_ADMIN_PASSWORD');
}
if (!ADMIN_TOKEN) {
  console.warn('PB_ADMIN_TOKEN not set — falling back to admin email/password. Issue a long-lived token in prod.');
}

/** Returns a fresh PB client per call. Never share authStore across requests. */
export async function pbAdmin(): Promise<PocketBase> {
  const pb = new PocketBase(PB_URL);
  if (ADMIN_TOKEN) {
    pb.authStore.save(ADMIN_TOKEN, null);
    return pb;
  }
  await pb.admins.authWithPassword(ADMIN_EMAIL!, ADMIN_PASSWORD!);
  return pb;
}
```

**Test (token wiring):**

```ts
import { describe, it, expect } from 'vitest';
import { pbAdmin } from '../../src/lib/pb';

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
```

Commit: `chore(finance-tracker): add PocketBase admin client (token-based, no shared authStore)`

### Task 2.3: Auth middleware + /api/auth/me

**Reviewer fixes:**
- **B1a:** `passwordConfirm` must equal `password` (the original sketch sent `''`, which would reject 100% of new sign-ins).
- **B1b:** add an LRU cache keyed by Firebase UID → PB user ID so we don't hit PocketBase on every authed request (was a wasted roundtrip per request).
- **I6:** add an explicit test where `verifyIdToken` *throws*, asserting the middleware returns 401. The original test mocked `verifyIdToken` to always succeed, so any implementation (even one that skipped verification entirely) would have passed.

**Files:**
- Create: `apps/finance-tracker/server/src/middleware/auth.ts`
- Create: `apps/finance-tracker/server/src/lib/uidCache.ts`
- Create: `apps/finance-tracker/server/src/routes/auth.ts`
- Modify: `apps/finance-tracker/server/src/index.ts`
- Create: `apps/finance-tracker/server/tests/auth.test.ts`

**Step 1 — Test first (now with three cases)**

```ts
// tests/auth.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { authMiddleware } from '../src/middleware/auth';

const verifyIdToken = vi.fn();
vi.mock('../src/lib/firebase', () => ({ firebaseAuth: { verifyIdToken: (...a: any[]) => verifyIdToken(...a) } }));
vi.mock('../src/lib/pb', () => ({
  pbAdmin: vi.fn().mockResolvedValue({
    collection: () => ({
      getFirstListItem: vi.fn().mockRejectedValue(new Error('not found')),
      create: vi.fn().mockResolvedValue({ id: 'pb-id-1' }),
    }),
  }),
}));

beforeEach(() => verifyIdToken.mockReset());

describe('auth middleware', () => {
  it('401 when no Authorization header', async () => {
    const app = new Hono().use('/api/*', authMiddleware).get('/api/x', (c) => c.text('ok'));
    const res = await app.request('/api/x');
    expect(res.status).toBe(401);
  });

  it('401 when token verification throws', async () => {
    verifyIdToken.mockRejectedValue(new Error('Firebase: invalid signature'));
    const app = new Hono().use('/api/*', authMiddleware).get('/api/x', (c) => c.text('ok'));
    const res = await app.request('/api/x', { headers: { Authorization: 'Bearer bad' } });
    expect(res.status).toBe(401);
  });

  it('passes with valid token, sets c.var.uid + c.var.pbUserId', async () => {
    verifyIdToken.mockResolvedValue({ uid: 'fb-uid-123', email: 'a@test' });
    const app = new Hono().use('/api/*', authMiddleware)
      .get('/api/x', (c) => c.json({ uid: c.var.uid, pbUserId: c.var.pbUserId }));
    const res = await app.request('/api/x', { headers: { Authorization: 'Bearer good' } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ uid: 'fb-uid-123', pbUserId: 'pb-id-1' });
  });
});
```

**Step 2 — Implement (with LRU cache + fixed passwordConfirm)**

```ts
// src/lib/uidCache.ts
import { LRUCache } from 'lru-cache';
export const uidToPbId = new LRUCache<string, string>({ max: 1000, ttl: 1000 * 60 * 60 });
```

```ts
// src/middleware/auth.ts
import { createMiddleware } from 'hono/factory';
import { firebaseAuth } from '../lib/firebase';
import { pbAdmin } from '../lib/pb';
import { uidToPbId } from '../lib/uidCache';

export const authMiddleware = createMiddleware<{
  Variables: { uid: string; email: string; pbUserId: string };
}>(async (c, next) => {
  const auth = c.req.header('Authorization');
  if (!auth?.startsWith('Bearer ')) return c.json({ error: 'unauthorized' }, 401);

  let decoded;
  try {
    decoded = await firebaseAuth.verifyIdToken(auth.slice(7));
  } catch {
    return c.json({ error: 'invalid token' }, 401);
  }

  c.set('uid', decoded.uid);
  c.set('email', decoded.email ?? '');

  let pbUserId = uidToPbId.get(decoded.uid);
  if (!pbUserId) {
    const pb = await pbAdmin();
    const existing = await pb.collection('users').getFirstListItem(`firebase_uid="${decoded.uid}"`).catch(() => null);
    if (existing) {
      pbUserId = existing.id;
    } else {
      const password = crypto.randomUUID();
      const created = await pb.collection('users').create({
        firebase_uid: decoded.uid,
        email: decoded.email,
        emailVisibility: false,
        password,
        passwordConfirm: password,   // ← reviewer fix B1a
      });
      pbUserId = created.id;
    }
    uidToPbId.set(decoded.uid, pbUserId);   // ← reviewer fix B1b
  }
  c.set('pbUserId', pbUserId);
  await next();
});
```

**Auth-collection design decision (closes design §13 open item):** we use PocketBase's `users` auth collection with `firebase_uid` as an indexed field (not the PB primary key). PB's `id` stays auto-generated. The cache is keyed on `firebase_uid → pb_id`. This is simpler than custom-keying the PB record and avoids edge cases where Firebase UIDs change format.

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
        apps/finance-tracker/server/src/lib/uidCache.ts \
        apps/finance-tracker/server/src/routes/auth.ts \
        apps/finance-tracker/server/src/index.ts \
        apps/finance-tracker/server/tests/auth.test.ts
git commit -m "feat(finance-tracker): add Firebase auth middleware + /api/auth/me"
```

### Task 2.4: Per-UID rate limiting

**Reviewer fix (B3):** rate limiting promised in the design (§9: "per-Firebase-UID, 60 req/min on /api/*") had no corresponding plan task. Adding it explicitly.

**Files:**
- Create: `apps/finance-tracker/server/src/middleware/rateLimit.ts`
- Modify: `apps/finance-tracker/server/src/index.ts`
- Create: `apps/finance-tracker/server/tests/rateLimit.test.ts`

**Step 1 — Test**

```ts
import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';
import { rateLimit } from '../src/middleware/rateLimit';

describe('rateLimit', () => {
  it('returns 429 after limit', async () => {
    const app = new Hono().use('/api/*', rateLimit({ limit: 3, windowMs: 60_000, keyFn: () => 'uid-1' }))
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
    const app = new Hono().use('/api/*', rateLimit({ limit: 1, windowMs: 60_000, keyFn: () => uid }))
      .get('/api/x', (c) => c.text('ok'));
    expect((await app.request('/api/x')).status).toBe(200);
    expect((await app.request('/api/x')).status).toBe(429); // a blocked
    uid = 'b';
    expect((await app.request('/api/x')).status).toBe(200); // b fresh
  });
});
```

**Step 2 — Implement (token-bucket via LRU)**

```ts
// src/middleware/rateLimit.ts
import { createMiddleware } from 'hono/factory';
import { LRUCache } from 'lru-cache';

type Opts = { limit: number; windowMs: number; keyFn: (c: any) => string };

export function rateLimit(opts: Opts) {
  const cache = new LRUCache<string, { count: number; resetAt: number }>({ max: 10_000, ttl: opts.windowMs });
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
```

**Step 3 — Wire it in (after auth middleware so we have a UID to key on)**

```ts
// src/index.ts
app.use('/api/*', authMiddleware);
app.use('/api/*', rateLimit({ limit: 60, windowMs: 60_000, keyFn: (c) => c.var.uid }));
```

**Step 4 — Commit**

```bash
git add apps/finance-tracker/server/src/middleware/rateLimit.ts \
        apps/finance-tracker/server/tests/rateLimit.test.ts \
        apps/finance-tracker/server/src/index.ts
git commit -m "feat(finance-tracker): add per-UID rate limit middleware (60/min)"
```

### Task 2.5: Error tracking (Sentry)

**Reviewer fix (N4):** no observability story anywhere in the plan. Adding the cheapest possible version: Sentry init in both web and server, with `SENTRY_DSN` env var. Skipped when unset (local dev).

**Files:**
- Modify: `apps/finance-tracker/server/src/index.ts` — `import * as Sentry from '@sentry/node'; if (process.env.SENTRY_DSN) Sentry.init({ dsn: process.env.SENTRY_DSN, tracesSampleRate: 0.1 });`
- Modify: `apps/finance-tracker/web/src/main.tsx` — Sentry browser init guarded by `import.meta.env.VITE_SENTRY_DSN`.
- Modify: `apps/finance-tracker/server/src/middleware/errorHandler.ts` — Hono `onError` calls `Sentry.captureException`.

Test: throw inside a route, assert Sentry mock was called.

Commit: `feat(finance-tracker): wire Sentry error tracking (no-op without DSN)`

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
  assetType: 'stock' | 'etf' | 'other';   // spike 3: drives allocation look-through
  listingCurrency: string; sector?: string; industry?: string;
  country?: string; marketCap?: number; peRatio?: number;
  beta?: number; dividendYield?: number;
  sectorWeightings?: Record<string, number>;  // ETFs only: sector → weight
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

> **Spike 3 findings baked in (see `docs/spikes/2026-06-06-spikes-3-4-results.md`):**
> 1. `yahoo-finance2` v3 requires `new YahooFinance()` — the v2 default-singleton import throws.
> 2. ETFs return NULL for sector/country/marketCap via `assetProfile`. For ETFs we branch on `quoteType` and pull `topHoldings.sectorWeightings` so the Allocation tile can do sector look-through. (VWRL.L, IWDA.AS, etc. — the most common holdings for our target user — depend on this.)

```ts
// src/providers/yahoo.ts
import YahooFinance from 'yahoo-finance2';
import type { PriceProvider, Quote, SymbolProfile } from './types';

export class YahooPriceProvider implements PriceProvider {
  name = 'yahoo' as const;
  private yf = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

  private async getSummary(ticker: string, modules: string[]) {
    try {
      return await this.yf.quoteSummary(ticker, { modules: modules as any });
    } catch {
      return null;
    }
  }

  async quote(ticker: string): Promise<Quote | null> {
    const s = await this.getSummary(ticker, ['price']);
    if (!s?.price?.regularMarketPrice) return null;
    return {
      ticker,
      price: s.price.regularMarketPrice,
      currency: s.price.currency!,
      asOf: new Date((s.price.regularMarketTime as Date) || Date.now()),
    };
  }

  async profile(ticker: string): Promise<SymbolProfile | null> {
    const s = await this.getSummary(ticker, ['price', 'summaryDetail', 'assetProfile', 'defaultKeyStatistics', 'quoteType']);
    if (!s?.price) return null;
    const assetType = s.quoteType?.quoteType === 'ETF' ? 'etf'
      : s.quoteType?.quoteType === 'EQUITY' ? 'stock' : 'other';

    let sectorWeightings: Record<string, number> | undefined;
    if (assetType === 'etf') {
      const th = await this.getSummary(ticker, ['topHoldings']);
      const raw = th?.topHoldings?.sectorWeightings;
      if (raw) {
        sectorWeightings = {};
        for (const entry of raw) {
          const [k, v] = Object.entries(entry)[0] as [string, number];
          sectorWeightings[k] = v;
        }
      }
    }

    return {
      ticker,
      assetType,
      name: s.price.longName || s.price.shortName || ticker,
      exchange: s.price.exchangeName!,
      listingCurrency: s.price.currency!,
      sector: s.assetProfile?.sector,        // null for ETFs — expected
      industry: s.assetProfile?.industry,
      country: s.assetProfile?.country,      // null for ETFs — expected
      marketCap: s.price.marketCap,
      peRatio: s.summaryDetail?.trailingPE,
      beta: s.defaultKeyStatistics?.beta,
      dividendYield: s.summaryDetail?.dividendYield,
      sectorWeightings,                       // populated only for ETFs
    };
  }

  async search(query: string) {
    const res = await this.yf.search(query, { quotesCount: 10, newsCount: 0 });
    return (res.quotes || []).filter((q: any) => q.symbol).map((q: any) => ({
      ticker: q.symbol, name: q.longname || q.shortname || q.symbol, exchange: q.exchange,
    }));
  }
}
```

The fixture in Step 1 must capture **both** an equity (`AAPL`, full `assetProfile`) and an ETF (`VWRL.L`, null `assetProfile` + populated `topHoldings.sectorWeightings`). Add a test asserting `profile('VWRL.L').assetType === 'etf'` and `sectorWeightings` is non-empty, and `profile('AAPL').sector === 'Technology'`.

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
// Reviewer fix N8: use fast-xml-parser instead of fragile regex
import { XMLParser } from 'fast-xml-parser';

export class EcbFxProvider implements FxProvider {
  name = 'ecb' as const;
  private parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' });

  async latest(): Promise<Record<string, number>> {
    const r = await fetch('https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml');
    if (!r.ok) throw new Error(`ECB FX fetch failed: ${r.status}`);
    const xml = await r.text();
    const doc = this.parser.parse(xml);
    const cubes = doc?.['gesmes:Envelope']?.Cube?.Cube?.Cube ?? [];
    const list = Array.isArray(cubes) ? cubes : [cubes];
    const rates: Record<string, number> = { EUR: 1 };
    for (const c of list) {
      if (c.currency && c.rate) rates[c.currency] = parseFloat(c.rate);
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

**Goal:** Trading 212 PDF + Revolut PDF parse to `ParsedStatement`; import endpoint roundtrips with preview/commit semantics.

> **Spikes 1 & 2 changed this milestone (see `docs/spikes/2026-06-06-spikes-1-2-results.md`).** Both brokers export **PDF**, not CSV/XLSX. We parse PDF tables. Trading 212's "open positions" table carries cost basis; Revolut's "portfolio breakdown" does not (positions imported with `cost_basis = null`). The earlier `safe-xlsx` / CSV / XLSX tasks are replaced by the PDF tasks below.

### Task 6.0: PDF parsing safety harness

User-uploaded PDFs are an untrusted-input surface. We use `pdfjs-dist` (Mozilla pdf.js) which disables JS execution in PDFs by default, plus our own size/page caps and a parse timeout. PDFs here are digitally generated (clean text), so this is position-aware text extraction, **not** OCR.

**Files:**
- Modify: `apps/finance-tracker/server/package.json` — add `pdfjs-dist`
- Create: `apps/finance-tracker/server/src/importers/safe-pdf.ts`
- Create: `apps/finance-tracker/server/tests/importers/safe-pdf.test.ts`

**Step 1 — Dep**
```json
"pdfjs-dist": "^4.5.0"
```

**Step 2 — Chokepoint: extract positioned text items, one array per page**

```ts
// src/importers/safe-pdf.ts
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

const MAX_FILE_BYTES = 15 * 1024 * 1024;   // 15 MB
const MAX_PAGES = 40;
const PARSE_TIMEOUT_MS = 15_000;

export class PdfParseError extends Error { constructor(msg: string) { super(msg); this.name = 'PdfParseError'; } }

export type PositionedText = { str: string; x: number; y: number; page: number };

export async function extractPositionedText(buffer: Buffer): Promise<PositionedText[]> {
  if (buffer.length > MAX_FILE_BYTES) throw new PdfParseError(`file too large: ${buffer.length}`);

  const task = pdfjs.getDocument({ data: new Uint8Array(buffer), isEvalSupported: false });
  const doc = await withTimeout(task.promise, PARSE_TIMEOUT_MS, 'pdf load');
  if (doc.numPages > MAX_PAGES) throw new PdfParseError(`too many pages: ${doc.numPages}`);

  const out: PositionedText[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    for (const item of content.items as any[]) {
      if (!item.str?.trim()) continue;
      out.push({ str: item.str, x: item.transform[4], y: item.transform[5], page: p });
    }
  }
  return out;
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, rej) => setTimeout(() => rej(new PdfParseError(`${label} timed out`)), ms)),
  ]);
}
```

**Step 3 — A table-reconstruction helper** (`src/importers/pdf-table.ts`): group `PositionedText` items into rows by `y` (within a tolerance), order cells within a row by `x`, and slice the rows between a detected header row and the next section heading. Tested against fixtures in 6.2 / 6.3.

**Step 4 — Tests:** oversize buffer throws; non-PDF garbage throws; a known fixture returns >0 positioned items with sane coordinates.

**Step 5 — Commit**
```bash
git commit -m "feat(finance-tracker): safe-pdf harness (size/page caps, timeout, no eval)"
```

All PDF parsing **must** go through `extractPositionedText()`. M0 lint/grep check blocks raw `getDocument(` outside `safe-pdf.ts`.

### Task 6.1: StatementImporter interface + ISIN→ticker resolution helper

Create `server/src/importers/types.ts` (interface from design §6 — note `cost_basis?` and `cost_currency?` are **optional**).

Create `server/src/importers/resolveTicker.ts`: given an ISIN, hit `symbol_profiles` cache; if miss, call `YahooPriceProvider.search(isin)` (Yahoo accepts ISINs in search), cache the result. ISIN is the canonical join key for both brokers (both PDFs always populate it — confirmed in spikes).

Commit: `feat(finance-tracker): add importer interface + ISIN resolver`

### Task 6.2: Trading212PdfImporter

**Files:**
- Create: `server/src/importers/trading212.ts`
- Create: `server/tests/importers/trading212.test.ts`
- Create: `server/tests/fixtures/t212-positions-redacted.pdf` (1-page, holdings table only, PII stripped)

**Approach:** `detect()` matches the "TRADING 212" + "Activity statement" text markers. `parse()` uses `extractPositionedText()` + `pdf-table.ts` to locate the **"Invest account – open positions summary"** table by its header row (`INSTRUMENT ISIN ... AVERAGE PRICE ... VALUE (EUR)`), then reads rows until the section ends. For each row emit:
```ts
{ ticker: <resolved from ISIN>, isin, quantity: QUANTITY,
  cost_basis: QUANTITY * AVERAGE_PRICE, cost_currency: INSTRUMENT_CURRENCY }
```

Test against the redacted fixture: assert a known position (e.g. AAPL, ISIN US0378331005) parses with correct quantity and a non-null cost basis; assert an ETF row (e.g. SGLN) parses; assert row count matches the fixture.

Commit: `feat(finance-tracker): add Trading212PdfImporter`

### Task 6.3: RevolutPdfImporter

**Files:**
- Create: `server/src/importers/revolut.ts`
- Create: `server/tests/importers/revolut.test.ts`
- Create: `server/tests/fixtures/revolut-portfolio-redacted.pdf` (1-page, breakdown table only, PII stripped)

**Approach:** `detect()` matches "Revolut" + "Account Statement". `parse()` locates the **"USD Portfolio breakdown"** table by header (`Symbol Company ISIN Quantity Price Value % of Portfolio`), reads rows until "Positions Value". For each row emit:
```ts
{ ticker: <Symbol, verified against ISIN>, isin, quantity: Quantity,
  cost_basis: undefined, cost_currency: undefined }   // spike 2: no cost basis
```

Test against the redacted fixture: assert a known position (e.g. META, ISIN US30303M1027) parses with correct quantity and `cost_basis === undefined`; assert the parser stops at "Positions Value" (doesn't bleed into the transactions table).

Commit: `feat(finance-tracker): add RevolutPdfImporter (current value, no cost basis)`

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

**Reviewer note (I13):** the preview cache lives in process memory. If the BFF restarts between upload and commit, the user re-uploads. Acceptable for v1 (single-instance deploy on the Mac Mini), but **document this limitation in the route handler** with a comment, and add `previewId` expiry in the error message: `"preview expired or not found"` (not `"invalid previewId"`) so the UI can prompt re-upload sensibly.

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
  const acc = await POST('/api/accounts', { source: 'trading212', label: 'T212 Invest' });
  const f = new FormData();
  f.append('file', new Blob([fs.readFileSync('fixtures/t212-positions-redacted.pdf')]), 't212.pdf');
  f.append('accountId', acc.id);
  const preview = await POSTmulti('/api/import/upload', f);
  await POST('/api/import/commit', { previewId: preview.previewId });
  const holdings = await GET(`/api/holdings?accountId=${acc.id}`);
  expect(holdings.length).toBeGreaterThan(0);
  expect(holdings[0].cost_basis).not.toBeNull(); // T212 carries cost basis
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
- 8.6: **Reviewer fix (I8) — `pruneSnapshots.ts`.** Weekly cron: collapse `holdings_snapshot` rows older than 90 days to one-per-week-per-holding (keep Sundays, delete the rest). Without pruning, 50 holdings × 365 days × 100 users = 1.8M rows/year. With pruning, that drops by ~85% past the 90-day window while preserving the time series for Phase 2 charts. Test asserts: weekday rows older than 90d removed; Sunday rows older than 90d retained; rows newer than 90d untouched.
- 8.7: E2E test using `vi.useFakeTimers()` — advance to 09:00 Mon Amsterdam time, assert refreshPrices was called.

7 commits.

---

## Milestone 9 — Frontend: theming + layout shell

**Goal:** Empty PWA renders hero strip + bottom tab bar in both light and dark modes.

### Tasks

- 9.1: Install Tailwind v4. Add tokens.css with semantic variables (`--bg`, `--surface`, `--fg`, `--muted`, `--accent`, `--success`, `--danger`, `--warning`) for both light and dark.
- 9.2: Install shadcn/ui (CLI: `npx shadcn-ui@latest init`). Add components: button, sheet, dialog, dropdown-menu, command, skeleton, toast.
- 9.3: Theme provider hook: reads `localStorage('theme')` with `prefers-color-scheme` fallback; applies `data-theme` attribute to `<html>`. `<ThemeToggle />` cycles light/dark/system.
- 9.4: Layout components — `<HeroStrip />`, `<AccountTabs />`, `<TileGrid />`, `<BottomTabBar />`, `<FabMenu />`. Render with placeholder data.
- 9.5: **Reviewer fix (N5) — i18n / formatting utility.** `src/lib/format.ts` exposes `formatEur(n)`, `formatPct(n)`, `formatDate(d)`, `formatQty(n)` using `Intl.NumberFormat` with locale `nl-NL`. Never let `.toFixed(2)` appear in component code. Unit test for each helper with edge cases (negative, very large, very small).
- 9.6: Storybook-style visual smoke at `/dev/layout` showing both modes side-by-side.

6 commits.

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

- 11.1: `tiles/types.ts` + `tiles/registry.ts` + `tiles/usePortfolioData.ts` (TanStack Query joining `/api/holdings` + cached prices + symbol profiles + FX into a `Portfolio` object). **Spike 2 fix:** `cost_basis` is nullable. Portfolio-level return aggregates **only** positions with a non-null cost basis; the Summary strip shows total return over the covered subset with a footnote ("excludes N positions without cost data — e.g. Revolut"). Per-position P&L renders "—" when cost is absent. Add a fixture test with one cost-bearing (T212) + one cost-null (Revolut) position asserting the return excludes the latter and the footnote count is 1.
- 11.2: `<Allocation />` — donut chart (ECharts) with tabs for sector/country/currency. **Spike 3 fix:** sector aggregation handles two cases — a `stock` contributes its full position value to its single `sector`; an `etf` distributes its position value across `sectorWeightings` (look-through). Holdings with no sector data (rare `other` type) go to an explicit **"Uncategorised"** bucket (reviewer fix I9). Geographic tab: ETFs lack clean country data from Yahoo, so they contribute to a **"Multiple/Diversified"** geo bucket rather than "Uncategorised" — documented as a v1 limitation, true geo look-through deferred to Phase 2. Test with a fixture portfolio mixing 2 stocks + 1 ETF, asserting the ETF's value is spread across sectors.
- 11.3: `<Concentration />` — top 5 list with horizontal bars.
- 11.4: `<DiversificationScore />` — **Reviewer fix (B4):** the design's composite `100 × (1 − cbrt(sector_HHI × geo_HHI × top5_share))` cubed two correlated signals (top5_share and HHI both measure top-position concentration). Replace top5_share with **Effective N** = `1 / overall_HHI` rendered as the headline, with sector / geo / currency HHI shown as three sub-scores beneath. Composite becomes optional. Add a fixture test asserting score values for canonical portfolios: single-position = 0, 2 equal = ~37, 5 equal = ~60, 50 equal = ~90. SVG circular progress for the headline.
- 11.5: `<Income />` — weighted yield + expected annual.
- 11.6: `<Quality />` — weighted P/E + weighted beta with one-line interpretation. **Reviewer fix (I11):** the harmonic mean for P/E is undefined when any constituent P/E ≤ 0 (loss-making companies). Exclude those positions from the calculation and show a banner: *"Quality excludes N loss-making positions (M% of portfolio)."* Test asserts the exclusion math.
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

## Validation spikes

Results recorded in `docs/spikes/`. Status as of 2026-06-06:

1. ✅ **T212 export** — DONE. Real statement is **PDF** (not CSV). "Open positions summary" table has ISIN + qty + average price (cost basis) + EUR value. GREEN. → `2026-06-06-spikes-1-2-results.md`
2. 🟡 **Revolut export** — DONE. Real statement is **PDF**. "Portfolio breakdown" has ISIN + qty + current value but **no cost basis**. YELLOW → decided: import current value only. → `2026-06-06-spikes-1-2-results.md`
3. 🟡 **Yahoo ticker resolution** — DONE. v3 API change + ETFs need `topHoldings` look-through. Both folded into the plan. → `2026-06-06-spikes-3-4-results.md`
4. ✅ **ECB FX freshness** — DONE. Feed fresh, 29 currencies, structure matches parser. GREEN. → `2026-06-06-spikes-3-4-results.md`
5. ⏳ **PocketBase rule under realtime** — PENDING (needs the workspace PB running). Instructions: `2026-06-06-manual-spikes-1-2-5.md`. This is the per-user privacy guarantee — run it as the first task of Milestone 1, block on GREEN.

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

## Effort estimate (revised after independent review)

**Plan claims:** ~110 tasks at ~30 min each → 55 hours. **Reviewer's reality check:**

| Block | Plan estimate | Realistic (one engineer) |
|---|---|---|
| M0–M4 (scaffolding + PB + auth + providers + DAL) | ~12h | ~30h |
| M5–M8 (CRUD + import + search + cron) | ~12h | ~35h |
| M9–M14 (frontend tiles + flows) | ~17h | ~80h |
| M15 (polish) | ~5h | ~25h |
| M16 (deploy + cron monitoring) | ~3h | ~12h |
| **Total** | **~55h** | **~180h (≈8–10 weeks part-time)** |

M11 (tiles) and M15 (polish) were the worst-underestimated. Treat the original 1-bullet-per-tile cadence as wishful thinking; budget 3–5 commits per Phase 1 tile in practice.

## Plan revisions (2026-06-06, after independent review)

| Ref | Change | Issue addressed |
|---|---|---|
| Conventions | Added `c.var.pbUserId` vs `c.var.uid` rule; cost-basis methodology (weighted-average) | I7, B5 |
| Task 2.2 | PB admin client uses token (not email/password), no shared authStore | B2 |
| Task 2.3 | Fixed `passwordConfirm` bug; LRU cache UID→pbUserId; added 401-on-token-throw test; closed design §13 auth choice | B1, I6 |
| Task 2.4 | **New** — per-UID rate limit middleware (60/min) | B3 |
| Task 2.5 | **New** — Sentry init (no-op without DSN) | N4 |
| Task 1.3 | **New** — PocketBase migration workflow doc + volume mount | B7 |
| Task 6.0 | **New** — safe-pdf parser harness (size/page caps, timeout, no eval, `pdfjs-dist`); replaced the earlier safe-xlsx after spikes 1–2 showed both brokers export PDF | B6 + spikes 1–2 |
| Tasks 6.2/6.3 | Rewritten as `Trading212PdfImporter` / `RevolutPdfImporter` (PDF table extraction); Revolut imports with null cost basis | spikes 1–2 |
| Task 3.2 | YahooPriceProvider rewritten for v3 `new YahooFinance()` + ETF `topHoldings` sector look-through | spike 3 |
| `symbol_profiles` / `SymbolProfile` | Added `assetType` + `sectorWeightings` for ETF allocation look-through | spike 3 |
| `holdings` | `cost_basis` + `cost_currency` made nullable | spike 2 |
| Task 6.4 | Documented in-memory preview cache limitation + sensible error message | I13 |
| Task 8.6 | **New** — `holdings_snapshot` pruning cron (keep weekly after 90d) | I8 |
| Task 9.5 | **New** — i18n `format.ts` utility (Intl.NumberFormat) | N5 |
| Task 11.4 | Diversification: Effective N + sub-scores replaces correlated cbrt composite; fixture-based test | B4 |
| Task 11.6 | Quality tile excludes negative P/E with explicit banner | I11 |
| Task 0.5 | Dockerfile runtime stage uses `pnpm install --prod` (no dev deps) | N7 |
| Task 3.4 | ECB parser uses `fast-xml-parser` (no fragile regex) | N8 |
| Vite config | Port 5173 (matches design §9 CORS allowlist) | I10 |

**Known-issues deferred** (acceptable risk, not blocking):
- I4 — shared-collection enumeration via PB list endpoint. Mitigated by PB not having a host port in production; smoke test in M16 confirms.
- I5 — integration tests labelled as unit tests. To be addressed during the M4 DAL build (testcontainers spin-up).
- I9 — Yahoo partial-data → `"Uncategorised"` bucket. Implementation detail in M11.2.
- I14 — service worker + auth header strategy. Address during M15.8 with Workbox `NetworkFirst` + auth-stripped cache keys.

---

## Execution Handoff

Plan complete and saved to `apps/finance-tracker/docs/plans/2026-06-06-investment-dashboard-implementation.md`. Two execution options:

**1. Subagent-Driven (this session)** — I dispatch a fresh subagent per task, review between tasks, fast iteration in this session.

**2. Parallel Session (separate)** — Open a new session with `superpowers:executing-plans`, batch execution with checkpoints.

**Which approach?**
