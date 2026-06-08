# Trading 212 API Sync — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (or superpowers:subagent-driven-development) to implement this plan task-by-task. Work in a dedicated git worktree. Design: `docs/plans/2026-06-08-trading212-api-sync-design.md`.

**Goal:** Replace destructive PDF snapshot-replace with automated, read-only Trading 212 API sync that maintains current holdings (+ avg cost), a deduplicated transaction ledger, change-tracking, and per-position analytics.

**Architecture:** Hybrid — `GET /portfolio` is the source of truth for current holdings + average cost; order/dividend history is an append-only ledger (deduped by T212 `external_id`). A `Trading212Provider` (strategy pattern, mirrors `providers/yahoo.ts`) is called by a sync service triggered manually + daily cron. The read-only API key is AES-256-GCM encrypted at rest in a per-user `broker_connections` collection.

**Tech Stack:** Hono BFF (tsx), PocketBase (JS migrations), Zod schemas, node:crypto (AES-256-GCM), node-cron, Vitest (unit + PB integration). Web: React 19, TanStack Query/Router, ECharts.

**Conventions to mirror (read these first):**
- Provider: `server/src/providers/{types,yahoo,currency}.ts`
- Repos: `server/src/db/{perUserRepo,sharedRepo,holdings,transactions,schemas}.ts`
- Routes + IDOR: `server/src/routes/{_helpers,holdings,import}.ts` (`requireOwned`, `parseBody`, `readJson`); auth sets `c.var.pbUserId` (`middleware/auth.ts`)
- Migrations: `server/pb-schema/migrations/*.js`
- Cron: `server/src/cron/{index,refreshFx}.ts` (deps-injected fn + lazy prod binding + registry entry)
- Web data: `web/src/lib/api.ts`, tiles in `web/src/tiles/`, routing `web/src/router.tsx`

---

## Prerequisites

**P1. Generate the encryption secret (on the Mac Mini, once):**
```bash
# 32 bytes hex for AES-256
openssl rand -hex 32
```
Add to `apps/finance-tracker/.env` (chmod 600, gitignored): `T212_KEY_ENC_SECRET=<hex>`. Add the var name (no value) to `.env.example`/docs.

**P2. The read-only T212 key** is generated (name `finance-dashboard`), IP-restricted to `77.173.30.177`. For Spike 0 it will be placed in a temp env var on the Mac Mini only.

---

## Milestone 0 — Spike: validate the live T212 API contract

> The API is beta; everything below (paths/fields/limits) must be confirmed before coding the provider. The IP-restricted key only works **from the Mac Mini** (egress `77.173.30.177`), so the spike runs there (requires you on Tailscale).

### Task 0.1 — Capture API shapes
**Files:** Create `apps/finance-tracker/docs/spikes/2026-06-08-t212-api-results.md` (findings only — **never commit the key or raw PII**).

**Step 1:** On the Mac Mini, export the key in the shell (not to disk):
```bash
read -rs T212_KEY   # paste the key, press enter
BASE=https://live.trading212.com
```
**Step 2:** Probe each endpoint, recording HTTP status, headers (rate-limit), and JSON shape (redact values):
```bash
for path in /api/v0/equity/account/info /api/v0/equity/portfolio \
            "/api/v0/equity/history/orders?limit=5" \
            "/api/v0/history/dividends?limit=5" \
            /api/v0/equity/account/cash; do
  echo "=== $path ==="
  curl -s -D - -o /tmp/body.json -H "Authorization: $T212_KEY" "$BASE$path"
  python3 -c "import json;d=json.load(open('/tmp/body.json'));print(json.dumps(d,indent=2)[:1500])" 2>/dev/null \
    || head -c 500 /tmp/body.json
done
```
**Step 3:** Record in the spike doc: exact base URL, auth header format, the **field names** for positions (ticker, quantity, averagePrice, ppl, currencyCode?), orders (id/dateExecuted/direction/quantity/fillPrice/...), dividends (id/paidOn/amount/...), the **pagination** mechanism (cursor/nextPagePath), **rate-limit** headers/limits, and how **GBX** instruments report currency/price. Note ticker format (e.g. `AAPL_US_EQ`) and how to map it to our tickers/ISINs.
**Step 4:** `unset T212_KEY`. Commit only the findings doc.

**Output:** field mappings + limits that parameterise Tasks 2.x.

---

## Milestone 1 — Connection: schema, encryption, endpoints, Settings UI

### Task 1.1 — `broker_connections` migration
**Files:** Create `apps/finance-tracker/server/pb-schema/migrations/1780900000_broker_connections.js` (mirror an existing create migration).

**Step 1:** Write the migration creating collection `broker_connections`, type `base`, fields: `user` (relation→users, required), `broker` (select: trading212), `api_key_enc` (text, required), `t212_account_id` (text), `currency` (text), `status` (select: connected|error, default connected), `last_synced_at` (date), `last_error` (text). Unique index `(user, broker)`. List/view/create/update/delete rules: `@request.auth.id = user.id` (per-user; mirror `holdings` rules).
**Step 2:** Restart PB locally / run the integration harness so the migration applies; verify the collection exists.
**Step 3:** Commit.

### Task 1.2 — Zod schema
**Files:** Modify `server/src/db/schemas.ts` (add `brokerConnectionSchema` + `...CreateSchema`/`...UpdateSchema` + inferred types, mirroring `accountSchema`).
**TDD:** add to `tests/db/schemas.test.ts` a parse test (valid row passes, missing `user` fails) → run (fail) → implement → run (pass) → commit.

### Task 1.3 — AES-256-GCM helper
**Files:** Create `server/src/lib/crypto.ts`; Test `server/tests/lib/crypto.test.ts`.

**Step 1 (failing test):**
```ts
import { describe, it, expect } from 'vitest';
import { encryptSecret, decryptSecret } from '../../src/lib/crypto';
describe('crypto', () => {
  const KEY = 'a'.repeat(64); // 32-byte hex
  it('round-trips', () => {
    const ct = encryptSecret('my-t212-key', KEY);
    expect(ct).not.toContain('my-t212-key');
    expect(decryptSecret(ct, KEY)).toBe('my-t212-key');
  });
  it('fails on tampered ciphertext', () => {
    const ct = encryptSecret('x', KEY);
    expect(() => decryptSecret(ct.slice(0, -2) + '00', KEY)).toThrow();
  });
});
```
**Step 2:** Run → fail. **Step 3:** Implement with `node:crypto` `createCipheriv('aes-256-gcm', key, iv)`; serialise `base64(iv).base64(tag).base64(ct)`; key = `Buffer.from(hex,'hex')`. **Step 4:** Run → pass. **Step 5:** Commit.

### Task 1.4 — Repo
**Files:** Create `server/src/db/brokerConnections.ts` (extend `PerUserRepo`, mirror `db/accounts.ts`); add `getForUser(userId, broker)` returning the single row or null. Unit-cover in the per-user integration test if present.

### Task 1.5 — Connect / status / disconnect endpoints
**Files:** Create `server/src/routes/broker.ts`; mount in `server/src/index.ts` at `/api/broker` (above SPA fallback, after auth+rateLimit). Test `server/tests/routes/broker.test.ts`.

Endpoints (all behind authMiddleware; user-scoped):
- `POST /api/broker/trading212/connect` `{ apiKey }` → call `provider.validateKey(apiKey)`; on success encrypt + upsert `broker_connections`, create/link a `trading212` account, set status connected, trigger an initial sync (fire-and-forget). On failure → 400 with a clear message; never store an invalid key.
- `GET /api/broker/trading212/status` → `{ connected, last_synced_at, status, last_error }` (NEVER returns the key).
- `DELETE /api/broker/trading212` → delete the connection row (keep holdings/ledger).

**TDD:** mock the provider; test connect-validates-before-store, status-never-leaks-key, IDOR (user A cannot read/delete user B's connection — 404). Run → implement → pass → commit.

### Task 1.6 — Settings "Connect Trading 212" UI
**Files:** Modify `web/src/routes/SettingsPage.tsx`; add `web/src/lib/broker.ts` (TanStack Query hooks `useBrokerStatus`, `useConnectBroker`, `useDisconnectBroker` via `lib/api.ts`).

A card: when disconnected → API-key input + "Connect" + a help link to the glossary section explaining read-only scopes + IP `77.173.30.177`; when connected → status, last-synced, "Sync now", "Disconnect", and an amber banner if `status==='error'` ("API access blocked — your IP may have changed; update the T212 allowlist & reconnect"). Commit.

---

## Milestone 2 — Provider + sync service

### Task 2.1 — `Trading212Provider`
**Files:** Create `server/src/providers/trading212.ts`; Test `server/tests/providers/trading212.test.ts`. Use field mappings from **Spike 0**.

Interface:
```ts
export interface BrokerProvider {
  validateKey(apiKey: string): Promise<{ ok: boolean; accountId?: string; currency?: string }>;
  fetchPositions(apiKey: string): Promise<ParsedPosition[]>; // reuse importers/types.ParsedPosition
  fetchOrders(apiKey: string, cursor?: string): Promise<{ items: LedgerEvent[]; nextCursor?: string }>;
  fetchDividends(apiKey: string, cursor?: string): Promise<{ items: LedgerEvent[]; nextCursor?: string }>;
}
```
- Map T212 position → `ParsedPosition` (ticker, isin, quantity, cost_basis = qty×averagePrice, cost_currency), reusing `normalizePence` for GBX.
- Map orders/dividends → `LedgerEvent` (new lightweight type: `{ externalId, type, ticker, isin?, quantity?, price?, currency?, fee?, occurredAt }`).
- Respect rate limits: a small `await sleep()` between paged calls; on `429` back off (read the limit header from Spike 0).
**TDD:** mock `fetch` (mirror `tests/providers/finnhub.test.ts`); assert field mapping incl. a GBX position, pagination follows `nextCursor`, `validateKey` returns ok on 200 / not-ok on 401. Run → implement → pass → commit.

### Task 2.2 — `external_id` on transactions
**Files:** Migration `server/pb-schema/migrations/1780900100_transactions_external_id.js` (add nullable `external_id` text + unique index `(user, source, external_id)` where set); modify `db/schemas.ts` transaction schema (+ `external_id?`); modify `db/transactions.ts` with `upsertByExternalId(row)` (find by (user, source, external_id) → update else create). TDD the repo method in the per-user integration test. Commit.

### Task 2.3 — Sync service
**Files:** Create `server/src/sync/trading212Sync.ts` (deps-injected fn + lazy prod binding, mirroring `cron/refreshFx.ts`); Test `server/tests/sync/trading212Sync.test.ts`.

`runTrading212SyncWith(deps, userId)`:
1. Load connection; decrypt key.
2. `fetchPositions` → replace this account's `holdings` (reuse the snapshot-replace batch helper from `db/importCommit.ts`, scoped to the account; ledger untouched).
3. Page `fetchOrders` → `transactions.upsertByExternalId` (type buy/sell).
4. Page `fetchDividends` → upsert (type dividend).
5. Stamp `last_synced_at`, status connected. On provider error → status error + last_error; never wipe.
**TDD:** fake provider + in-memory repos; assert holdings replaced, ledger deduped on re-run (idempotent), error path preserves data. Run → implement → pass → commit.

### Task 2.4 — "Sync now" wiring
**Files:** Modify `routes/broker.ts` (`POST /api/broker/trading212/sync` → `runTrading212Sync(userId)`); web `lib/broker.ts` `useSyncNow` + Settings button calls it, then invalidates `['holdings','transactions','accounts']`. Integration test the endpoint (mock provider). Commit.

---

## Milestone 3 — Scheduled sync + reconnect UX

### Task 3.1 — Daily cron
**Files:** Modify `server/src/cron/index.ts` — add job `trading212Sync` schedule `0 6 * * *` (Amsterdam) that iterates all `broker_connections` and runs the sync per user (per-user try/catch). Add `server/src/cron/syncBrokers.ts` (the runner). Test in `tests/cron/scheduler.test.ts` (job registered) + a runner unit test. Commit.

### Task 3.2 — Boot self-heal (optional, mirrors existing)
**Files:** `server/src/index.ts` boot block — after prices/fx, run broker sync once (best-effort, detached, try/catch) so a fresh deploy refreshes. Commit.

### Task 3.3 — Error/reconnect surfacing
Already partly in 1.6; ensure `status:error` + `last_error` render as the amber "update allowlist / reconnect" banner. Manual-verify. Commit.

---

## Milestone 4 — Activity feed + "since last sync"

### Task 4.1 — Ledger read endpoint
**Files:** `server/src/routes/transactions.ts` — ensure a user-scoped `GET /api/transactions?since=&type=&ticker=` (paginated, newest first). Add tests. Commit.

### Task 4.2 — Activity route + feed UI
**Files:** `web/src/router.tsx` add `/activity`; `web/src/components/layout/AppLayout.tsx` map the Activity tab to `/activity` (currently `/import`); create `web/src/routes/ActivityPage.tsx` + `web/src/lib/activity.ts` hook. Render a chronological list (buy/sell/dividend with date, ticker, qty, price, value) + a "Since last sync" summary card (opened/added/trimmed/closed + dividends, derived from events after `last_synced_at` of the prior sync — compute client-side from the ledger). Tests for the summary math (pure fn in `web/src/lib/activityMath.ts`). Commit.

---

## Milestone 5 — Per-position detail + sortable holdings

### Task 5.1 — Position detail data
**Files:** `web/src/lib/holdings.ts` / a new `positionDetailMath.ts` — given a ticker + ledger + current position + live price, compute: avg cost, market value, unrealised P&L €/%, realised P&L (average-cost over sells), dividends received, holding period, ordered buy/sell history. Pure + unit-tested. Commit.

### Task 5.2 — Position detail sheet
**Files:** `web/src/components/holdings/PositionSheet.tsx` (exists — extend) to show the above + a per-ticker value sparkline (from `holdings_snapshot` via a small `/api/portfolio/history?ticker=` extension, or reuse existing history endpoint filtered client-side). Commit.

### Task 5.3 — Sort & filter holdings
**Files:** `web/src/components/holdings/HoldingsList.tsx` — add sort (value / P&L € / P&L % / name / weight) + filters (account / asset-type / sector). Pure sort/filter fn unit-tested. Commit.

---

## Milestone 6 — Realised/unrealised totals + real dividend income

### Task 6.1 — Realised vs unrealised
**Files:** `web/src/tiles/buildPortfolio.ts` (+ types) — add realised P&L (from ledger sells) alongside unrealised; surface in the hero / a tile. Unit tests. Commit.

### Task 6.2 — Real dividend income
**Files:** `web/src/tiles/Income.tsx` + `incomeMath.ts` — show **actual** trailing-12-month dividends from the ledger, with the estimated-yield as secondary. Unit tests. Commit.

### Task 6.3 — Glossary updates
**Files:** `web/src/routes/LearnPage.tsx` — add sections: realised vs unrealised P&L, dividends received, "what a sync does". Commit.

---

## Final verification & rollout
1. `pnpm --filter finance-tracker-server test` + `test:integration`; `pnpm --filter finance-tracker-web test`; both production builds.
2. On the Mac Mini: set `T212_KEY_ENC_SECRET` in `.env`; deploy; connect via Settings with the real key; confirm an initial sync populates holdings + ledger; "Sync now" is idempotent (no dupes); Activity + per-position detail render; daily cron scheduled.
3. Verify IDOR (a second user can't see the connection/ledger), and that the key never appears in any response or log.

## Risks
- T212 beta API drift → Spike 0 + provider isolation contain it.
- Rate limits → conservative spacing + backoff; daily cadence.
- Home WAN IP rotation → non-silent error banner + reconnect.
