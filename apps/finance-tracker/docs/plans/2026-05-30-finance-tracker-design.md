# Finance Tracker — v1 Design

**Date:** 2026-05-30
**Status:** Design validated through brainstorming, ready for implementation planning
**Scope:** v1 = cash accounts only (Revolut, ABN AMRO). Investments deferred to v2.
**Location in repo:** `apps/finance-tracker/` (this monorepo)

This design supersedes an earlier standalone draft at `~/ai_projects/finance_tracker/docs/plans/2026-05-19-finance-tracker-design.md`. That repo is abandoned; the app lives here from now on.

---

## 1. Goals

A self-hosted, mobile-first dashboard that:

- Auto-refreshes transactions from Revolut and ABN AMRO via regulated PSD2 access (GoCardless Bank Account Data API).
- Categorises transactions with low manual effort using deterministic rules first, a small JS classifier trained on the user's own corrections second.
- Surfaces three core analytics: monthly category breakdown, spending trend over time, net worth + savings rate.
- Lives on the existing Mac Mini alongside the other workspace apps. Reuses the workspace conventions: Firebase Google Auth via `@myorg/auth-google`, Docker Compose, Cloudflare Tunnel, `<app>.cya.run`.
- Keeps the Firefly III data backend isolated on the docker network — never reachable from the public internet.

## 2. Non-goals (v1)

- Trading 212 / Revolut Securities transactions. Deferred to v2.
- Budget-vs-actual UI. Deferred to v2.
- Cash flow forecasting / recurrence detection. Deferred to v2.
- LLM-based categorisation. Removed entirely from v1; revisited only if the JS classifier proves inadequate after months of real use.
- Multi-user support. Firebase auth gates the app to a single email.

## 3. Architecture

Two separate Docker Compose stacks on the Mac Mini, on a shared docker network:

```
┌────────────────────────── Mac Mini ──────────────────────────┐
│                                                              │
│  ── stack: apps/finance-tracker/ ────────────────────────┐   │
│  │                                                       │   │
│  │  ┌─────────────────────────────────────────────────┐  │   │
│  │  │   finance-tracker (single Node/Hono container)  │  │   │
│  │  │                                                 │  │   │
│  │  │   - serves the built Vite/React PWA at /        │  │   │
│  │  │   - /api/* — verifies Firebase ID token,        │  │   │
│  │  │              proxies to Firefly REST            │  │   │
│  │  │   - /webhooks/firefly — receives txn events,    │  │   │
│  │  │              runs rules check, runs JS          │  │   │
│  │  │              classifier on uncategorised,       │  │   │
│  │  │              writes category back to Firefly    │  │   │
│  │  │   - /snapshots — manual brokerage balances      │  │   │
│  │  │              (stored in a small SQLite file)    │  │   │
│  │  └─────────────────────────────────────────────────┘  │   │
│  │           ▲                              │            │   │
│  │           │ public over Cloudflare       │ docker net │   │
│  │           │ Tunnel (finance.cya.run)     ▼            │   │
│  └───────────│────────────────────────── docker net ────┘    │
│              │                                ▲              │
│  ── stack: infra/firefly/ ─────────────────── │ ─────────┐    │
│  │                                            │          │   │
│  │  ┌──────────────┐  ┌──────────────────┐ ┌──┴──────┐   │   │
│  │  │   MariaDB    │◄─┤   Firefly III    │ │ Firefly │   │   │
│  │  │ (Firefly DB) │  │ (data spine, REST│ │ Data    │   │   │
│  │  └──────────────┘  │  + webhooks)     │ │ Importer│   │   │
│  │                    └──────────────────┘ │ (cron,  │   │   │
│  │                                         │ Go-     │   │   │
│  │                                         │ Cardless│   │   │
│  │                                         │ → FF3)  │   │   │
│  │                                         └─────────┘   │   │
│  │  No port mapping to host. Only reachable from        │   │
│  │  containers on the same docker network.              │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ── nightly cron on the host ────────────────────────────┐   │
│  │   mysqldump firefly → restic → Backblaze B2          │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
        ▲
        │ Cloudflare Tunnel (existing, on host)
        │
   📱 Phone (PWA, installable, biometric/PIN cold-start lock)
```

**Why two stacks, not one:** Firefly III is operationally distinct from the app — it has its own upgrade cadence, its own backup needs, and shouldn't be touched when redeploying the frontend. Keeping it in `infra/firefly/` makes it obvious that this is the data layer.

## 4. Stack choices

| Concern | Choice | Why |
|---|---|---|
| Source of truth | Firefly III | Mature OSS, EU-friendly, REST + webhooks, multi-currency, rules engine, regulated PSD2 integration via Data Importer. Re-implementing all that in PocketBase is months of work. |
| Database (Firefly) | MariaDB | Firefly's recommended default. |
| Bank ingest | GoCardless Bank Account Data API (formerly Nordigen), via Firefly III Data Importer | Regulated AISP, free tier covers ABN AMRO + Revolut. |
| Frontend | Vite + React 19 + **TypeScript** | Matches `dutch-app` TS precedent. Mobile-first PWA, single-user SPA — SSR/RSC would be wasted. TS earns its keep on money math + Firefly's complex API shapes. |
| Auth | `@myorg/auth-google` (Firebase Google sign-in) | Workspace convention; the only identity layer that gates the BFF. |
| BFF | Single Node container running **Hono** | Serves static SPA, proxies Firefly API, receives webhooks, runs JS classifier. No need to split — one process at this scale. |
| Categorisation | Firefly rules first; JS TF-IDF + logistic regression (character n-grams) for uncategorised | Deterministic, private, free, trains in <100 ms on user's own corrections. Multilingual descriptions (NL/DE/EN) handled by char n-grams natively. |
| Manual snapshots | Tiny SQLite file inside the BFF container | Net worth tile stays honest while investments are deferred. |
| Remote access | **Cloudflare Tunnel** (existing) | Already configured on the Mac Mini. Routes `finance.cya.run` to the BFF only — Firefly is not exposed. |
| PWA lock | WebAuthn (biometric) with 6-digit PIN fallback | Tailscale would have hidden this; with Cloudflare Tunnel the host is publicly addressable, so app-level lock is essential. |
| Backups | `restic` → Backblaze B2, nightly | Encrypted at rest, ~€1/mo, 30-min recovery target. |

## 5. Data flow

### Ingest (Firefly III Data Importer cron, twice daily)

1. Importer authenticates to GoCardless using stored requisition.
2. Pulls new transactions per connected account.
3. Writes them into Firefly's MariaDB.
4. Firefly's native rule engine runs deterministic rules (description regex → category) at write time.
5. Firefly fires a `STORE_TRANSACTION` webhook for every new transaction, regardless of whether a rule matched.

### Categorise (BFF webhook handler, synchronous per transaction)

```
POST /webhooks/firefly
  │
  ├─ verify webhook signature (Firefly HMAC)
  │
  ├─ if transaction already has category → no-op (rule matched at write time)
  │
  ├─ extract features:
  │     - description (lowercased, normalised)
  │     - amount sign + magnitude bucket
  │     - counterparty if present
  │
  ├─ classifier.predict(features) → {category, confidence}
  │
  ├─ if confidence ≥ 0.7
  │     └─ PATCH /api/v1/transactions/{id} via Firefly REST
  │        tag = "auto-classifier"
  │
  └─ else
        └─ leave uncategorised; surface in PWA "needs review" queue
```

### Train (nightly cron on the BFF, ~50 ms)

1. Pull all transactions with manually-assigned categories from Firefly.
2. Rebuild TF-IDF vectoriser (char n-grams 3–5).
3. Refit logistic regression (one-vs-rest, L2-regularised).
4. Persist model + vectoriser to `/data/classifier.json` in the BFF volume.

### Manual override → feedback loop

When the user changes a category in the PWA:

1. PATCH lands on `/api/transactions/{id}` in BFF.
2. BFF writes the new category to Firefly via the REST API.
3. BFF removes the `auto-classifier` tag, adds a `user-corrected` tag.
4. Optional "promote to rule" button writes a Firefly rule so future transactions match deterministically.
5. Next nightly retrain will include this correction in the training set automatically.

### View

- PWA fetches transactions, accounts, balances, and aggregates from BFF endpoints that wrap Firefly's API.
- TanStack Query for client-side caching, stale-while-revalidate.
- Service worker caches the last fetch for offline read.

## 6. Frontend design

### Layout

Matches `habit-tracker`'s mobile-first idiom (DM Sans font, inline styles, bottom tab bar, sheets, FAB). We'll use a small Tailwind-free style helper but stay consistent with the workspace's "no heavy CSS framework" pattern — except where `dutch-app` already uses Tailwind v4. **Recommendation: skip Tailwind here, match habit-tracker style.** Less to learn, single-user app, the patterns are already proven.

```
src/
  App.tsx                     auth gate (LoginPage if !user, else AuthenticatedApp)
  main.tsx                    Vite entrypoint, initAuth() once
  lib/
    api.ts                    typed BFF client (fetch wrapper + Firebase ID token header)
    money.ts                  formatters, FX conversion helpers
    types.ts                  Transaction, Account, Category, Snapshot
  hooks/
    useTransactions.ts        TanStack Query wrappers around BFF endpoints
    useAccounts.ts
    useAnalytics.ts           pure derivations from transactions
    useLock.ts                biometric/PIN unlock state
  components/
    LoginPage.tsx
    LockScreen.tsx            WebAuthn / PIN gate on cold start + after 5 min idle
    BottomTabBar.tsx
    TransactionList.tsx
    TransactionDetail.tsx     sheet, swipe-down to dismiss
    CategoryPicker.tsx
    ConsentExpiryStrip.tsx    countdown per connected bank
    NeedsReviewBadge.tsx
    analytics/
      CategoryBreakdown.tsx
      SpendingTrend.tsx
      NetWorth.tsx
      tiles.ts                typed array — adding a tile = one new file + one line
```

### Three v1 tiles

1. **CategoryBreakdown** — donut chart for the current month, tap a slice to drill into the transaction list filtered by category. Merchant-level grouping inside each category.
2. **SpendingTrend** — last 12 months, stacked bar by top categories.
3. **NetWorth** — line chart of (sum of cash account balances + latest manual brokerage snapshot). Savings rate overlay = `(income − expenses) / income` per month.

### Tile contract (the "modular but minimal" pattern)

```ts
// src/components/analytics/tiles.ts
import type { ReactNode } from 'react';
import { CategoryBreakdown } from './CategoryBreakdown';
import { SpendingTrend } from './SpendingTrend';
import { NetWorth } from './NetWorth';

export type TileProps = {
  dateRange: { from: Date; to: Date };
  accountIds: string[];
};

export type Tile = {
  id: string;
  title: string;
  component: (props: TileProps) => ReactNode;
};

export const tiles: Tile[] = [
  { id: 'category', title: 'By category', component: CategoryBreakdown },
  { id: 'trend',    title: 'Spending trend', component: SpendingTrend },
  { id: 'networth', title: 'Net worth',     component: NetWorth },
];
```

Adding a tile in v2 = drop in a new component, add one line. No plugin registry, no dynamic loading.

### Mobile patterns (lifted from habit-tracker)

- Swipe between pages (today / analytics / review queue).
- Bottom tab bar with safe-area-inset padding.
- Sheets slide up from bottom for transaction detail and category picker.
- FAB for "add manual transaction" (cash purchases).
- Pull-to-refresh on transaction list — triggers a manual GoCardless poll.

### Manual brokerage snapshots

A dedicated `/snapshots` page in the PWA. One row per month per brokerage (Trading 212, Revolut Securities). Each row is `{ month, broker, balance, currency }`. Stored in SQLite inside the BFF (`/data/snapshots.db`). Net worth tile sums cash balances from Firefly + latest snapshots. Takes ~30 seconds per month to maintain — honest, simple, no fragile scraping.

## 7. Security model

- **Network:** Cloudflare Tunnel exposes only the BFF (port 3101 internal). Firefly III is on the docker network with no host port mapping.
- **Auth on /api/* and /webhooks/firefly:**
  - `/api/*` requires a valid Firebase ID token in the `Authorization` header, verified server-side with Firebase Admin SDK. The token's email is checked against an allow-list (one entry — yours).
  - `/webhooks/firefly` verifies Firefly's HMAC signature header. No Firebase needed (Firefly→BFF call is server-to-server inside the docker network).
- **Device:** PWA requires biometric/PIN unlock on cold start; auto-locks after 5 min in background.
- **Secrets:** Firefly PAT, GoCardless credentials, and Firebase service account live as Docker secrets / `.env` files on the Mac Mini, never in git. The Vite build only sees `VITE_FIREBASE_*` (public anyway).
- **Backups:** restic-encrypted with a passphrase stored offline (1Password / paper). B2 bucket holds ciphertext only.

## 8. Backup & DR

Nightly cron on the Mac Mini host (`/etc/periodic/daily/` or a launchd job):

```bash
#!/usr/bin/env bash
set -euo pipefail
docker exec firefly-mariadb mysqldump --single-transaction firefly \
  | gzip > /tmp/firefly.sql.gz
restic backup /tmp/firefly.sql.gz \
  /var/lib/docker/volumes/finance-tracker-data/_data/classifier.json \
  /var/lib/docker/volumes/finance-tracker-data/_data/snapshots.db
restic forget --keep-daily 7 --keep-weekly 4 --keep-monthly 12 --prune
rm /tmp/firefly.sql.gz
```

Failures email/ntfy to the user. Monthly drill: actually restore on a scratch machine.

**Recovery target:** rebuild the stack on a fresh Mac Mini in under 30 minutes from B2 + this repo.

## 9. Deployment

### Two compose files

`apps/finance-tracker/docker-compose.yml` — finance-tracker BFF container (Vite build embedded), port 3101. Joins the shared `mac-mini-net` external docker network.

`infra/firefly/docker-compose.yml` — Firefly III + MariaDB + Firefly Data Importer, no host port mappings. Joins `mac-mini-net`.

### Cloudflare Tunnel config addition

```yaml
- hostname: finance.cya.run
  service: http://localhost:3101
```

Then in Firebase console: add `finance.cya.run` to Authentication → Settings → Authorized domains.

### Updating

```bash
ssh mac-mini
cd ~/auth-workspace
git pull
cd apps/finance-tracker
docker compose up -d --build
```

Firefly updates separately:
```bash
cd ~/auth-workspace/infra/firefly
docker compose pull && docker compose up -d
```

## 10. Known risks & validation spikes

These spikes run **before** any production code is written. Each is <1 hour.

1. **Revolut PSD2 coverage in GoCardless.** Hit `GET /institutions/?country=NL` (and `?country=GB` if applicable) and confirm the user's Revolut entity (Revolut Bank UAB vs Revolut Ltd) is listed with `transactions_available=true` and full description fields. If transaction descriptions are truncated for Revolut, the classifier quality degrades for half the data.
2. **ABN AMRO transaction richness.** Pull a sample week via the Data Importer and verify counterparty names and SEPA references are present (not just IBANs).
3. **Firefly webhook delivery.** Confirm `STORE_TRANSACTION` webhooks fire reliably on Data Importer-created transactions, not just on manual entry. (Some Firefly versions had bugs.)
4. **GoCardless 90-day consent flow.** Walk through one bank end-to-end, time the reauth, and confirm the consent expiry timestamp is exposed via API so the PWA can show countdowns.
5. **Classifier baseline.** Hand-label 100 real transactions, run the JS classifier with 80/20 split, target ≥85% accuracy. Adjust feature extraction (char n-gram size, amount bucketing) before going live.

## 11. v1.5 candidates (committed to roadmap, not v1 scope)

Surfaced during the brainstorming research pass. Listed here so they're not lost. Each is independently shippable.

1. **Connection health dashboard.** Last successful GoCardless poll per account, consent-expiry countdown, last successful backup. Tiny effort (~1 day). Prevents the silent-failure mode that kills self-hosted setups.
2. **Subscription detector.** Group transactions by `(counterparty, amount-band, monthly cadence)`, surface candidates that aren't yet bills. ~3–4 days. The headline feature of commercial finance apps; no FOSS ships it.
3. **iCal feed of upcoming bills.** Emit an `.ics` file from a BFF endpoint that lists known recurring bills + pay days. Subscribed by any calendar app. ~0.5 day. (Preferred over Google Calendar OAuth integration.)

## 12. v2 roadmap

In rough priority order:

- Trading 212 import (CSV → Firefly, manual monthly).
- Revolut Securities import (CSV).
- Replace manual brokerage snapshots with actual investment transactions.
- Budget vs actual tile (uses Firefly's native budgets).
- Cash flow forecast based on detected recurring transactions.
- Merchant-level dashboards.
- Multi-currency normalisation (FX rates from ECB).
- Optional: local Ollama small-model fallback for transactions the JS classifier returns with confidence <0.5.

## 13. Open implementation decisions

Deferred to the implementation plan, not blocking the design:

- **Firefly webhook signature scheme.** Firefly supports HMAC; we'll use that. Secret rotated quarterly.
- **TanStack Query vs SWR.** Either works; TanStack picked for richer cache invalidation.
- **Charts library.** Recharts vs Victory vs hand-rolled SVG. Probably Recharts to match what `habit-tracker/components/analytics/` uses; verify when scaffolding.
- **Snapshot storage.** SQLite inside the BFF container vs a Firefly "asset account" with manually-updated balance. Decided in spike — Firefly route is cleaner if the API supports manual asset accounts well.

---

## Decision log

Validated through brainstorming sessions on 2026-05-19 and 2026-05-30:

1. **Hybrid (OSS backend + custom frontend)** over from-scratch or pure adoption.
2. **Cash only in v1**, brokerages deferred.
3. **Mac Mini hosting** (existing), Cloudflare Tunnel (existing) — not a new NAS or Tailscale.
4. **Firefly III as data spine**, separate compose stack in `infra/firefly/`, never exposed to the public internet.
5. **App in `apps/finance-tracker/`** as a monorepo citizen — Firebase Google Auth via `@myorg/auth-google`, mobile-first PWA matching the `habit-tracker` idiom.
6. **TypeScript** over plain JSX — money math and Firefly API shapes justify it.
7. **Single Hono container** for the BFF — serves SPA, proxies Firefly, handles webhooks, runs classifier inline.
8. **Rules first, JS classifier second, no LLM in v1** — rejecting the earlier Claude-based plan as overkill and dependency-heavy. Character n-gram TF-IDF + logistic regression on the user's own corrections.
9. **Manual brokerage snapshots** to keep the net worth tile honest while investments are deferred.
10. **Modular tile components in a typed array**, not a plugin registry.
11. **Biometric/PIN PWA lock** — Cloudflare Tunnel means the host is publicly addressable, so device-level auth alone is not enough.
12. **`restic` → Backblaze B2** nightly, non-negotiable.
