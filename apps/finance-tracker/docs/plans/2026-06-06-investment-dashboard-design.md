# Investment Dashboard — v1 Design

**Date:** 2026-06-06
**Status:** Brainstormed, validated, ready for implementation planning
**Scope:** v1 = portfolio dashboard. Statement upload + manual CRUD + analytics on snapshot data.
**Location in repo:** `apps/finance-tracker/`

This doc supersedes the earlier cash-transaction tracker design (`2026-05-30-finance-tracker-design.md`), which is removed in the same commit. The app folder is reused; the scope is genuinely different.

---

## 1. Goals

A mobile-first, polish-first PWA where any user can:

- Sign in with Google (open registration).
- Upload Excel/CSV statements from Revolut Trading and Trading 212; their holdings appear immediately, fully valued in EUR.
- Add positions manually via ticker search + amount + cost + currency.
- Sell or adjust positions; transactions are logged.
- View their portfolio per-broker-account *and* as a global aggregate.
- See Phase 1 analytics: allocation breakdown (sector / geography / currency), top-N concentration, diversification score, expected income, weighted P/E and beta, and a treemap heatmap.
- Toggle between light and dark mode.

The app is **per-user private** — each user only sees their own portfolios. Anyone with a Google account can sign up. Social/follow features are deferred.

## 2. Non-goals (v1)

- Trade-history analytics: time-weighted return (TWR), money-weighted return (XIRR), Sharpe, Sortino, max drawdown. Deferred until 3–6 months of `holdings_snapshot` history exists, or proper trade history is added.
- Investment recommendations + company-level fundamentals deep-dive. Deferred to Phase 2.
- Following / sharing portfolios between users. Deferred.
- Real-time tick-level prices. Hourly refresh is the v1 target.
- Crypto, FX, commodities. Equities and ETFs only.
- Tax-lot tracking, ISA-vs-Invest tax treatment differentiation.

## 3. Architecture

Single Docker Compose stack in `apps/finance-tracker/`, joining the workspace's shared docker network. PocketBase is reused as the workspace-wide data layer.

```
┌──────────────── apps/finance-tracker/ ────────────────┐
│                                                       │
│  web/      Vite + React 19 + TS PWA, mobile-first     │
│            light + dark mode, installable             │
│            Firebase Google sign-in (open registration)│
│                                                       │
│  server/   Hono BFF (single Node container)           │
│            ├─ /api/auth/me      verifies Firebase JWT │
│            ├─ /api/portfolio/*  per-user CRUD         │
│            ├─ /api/import/*     parse Excel/CSV       │
│            ├─ /api/search       ticker autocomplete   │
│            ├─ /api/prices/*     read cached prices    │
│            └─ cron: hourly refresh, daily ECB,        │
│                     nightly holdings snapshot,        │
│                     weekly profile refresh            │
│                                                       │
└─────────────────────┬─────────────────────────────────┘
                      │ docker network (private)
            ┌─────────▼──────────┐
            │  PocketBase        │  (workspace-shared)
            │  per-user:         │
            │   accounts,        │
            │   holdings,        │
            │   transactions,    │
            │   imports,         │
            │   holdings_snapshot│
            │  shared (read-all, │
            │   write super):    │
            │   symbol_profiles, │
            │   price_cache,     │
            │   fx_rates         │
            └─────────┬──────────┘
                      │
        ┌─────────────┴──────────────┐
        │                            │
  yahoo-finance2 (primary)    Finnhub (fallback)
        │                            │
        └────── ECB FX (daily) ──────┘
```

Cloudflare Tunnel routes `invest.cya.run` → BFF only. PocketBase has no host port mapping.

## 4. Data model

### Per-user collections (PocketBase rule: `user = @request.auth.id`)

```ts
// users — mirrored from Firebase via PocketBase auth collection
// (id = firebase uid, email = google email)

// accounts — one row per broker/wallet
{
  user:     Relation<users>,
  source:   "revolut" | "trading212" | "manual",
  label:    string,         // "Revolut Trading EUR", "T212 ISA"
  currency: string?,        // null = inherit user default (EUR)
}

// holdings — current positions (materialised view of transactions for manual accounts;
// authoritative for statement-sourced accounts)
{
  user:           Relation<users>,
  account:        Relation<accounts>,
  ticker:         string,
  isin:           string?,
  quantity:       number,
  cost_basis:     number?,   // nullable — Revolut PDF has no cost basis (spike 2)
  cost_currency:  string?,   // nullable — present only when cost_basis is
  source:         "revolut" | "trading212" | "manual",
  notes:          string?,
}

// transactions — append-only audit log
{
  user:        Relation<users>,
  account:     Relation<accounts>,
  holding:     Relation<holdings>?,  // null for orphan dividends/fees
  type:        "buy" | "sell" | "dividend" | "fee" | "adjustment" | "import",
  ticker:      string,
  quantity:    number,
  price:       number,    // per share
  currency:    string,
  fee:         number,
  occurred_at: datetime,
  source:      "revolut" | "trading212" | "manual",
  notes:       string?,
}

// imports — idempotency + audit of statement uploads
{
  user:       Relation<users>,
  account:    Relation<accounts>,
  source:     "revolut" | "trading212",
  filename:   string,
  file_hash:  string,  // sha256, blocks re-imports
  row_count:  number,
  status:     "success" | "partial" | "failed",
  error_log:  string?,
}

// holdings_snapshot — nightly point-in-time copy of every holding
// powers Phase 2 time-series analytics; preserves history through
// snapshot-replace uploads
{
  user:        Relation<users>,
  account:     Relation<accounts>,
  ticker:      string,
  quantity:    number,
  cost_basis:  number,
  eur_value:   number,
  date:        date,  // YYYY-MM-DD, indexed
}
```

### Shared collections (read: any authed user; write: BFF service account only)

```ts
// symbol_profiles — sector, country, market cap, ratios; refreshed weekly
{
  ticker:            string,  // unique index
  isin:              string?, // indexed (join from imports)
  name:              string,
  exchange:          string,
  asset_type:        "stock" | "etf" | "other",  // spike 3: drives allocation look-through
  listing_currency:  string,
  sector:            string?,  // null for ETFs (expected)
  industry:          string?,
  country:           string?,  // null for ETFs (expected)
  market_cap:        number?,
  pe_ratio:          number?,
  beta:              number?,
  dividend_yield:    number?,
  sector_weightings: json?,    // ETFs only: { "technology": 0.24, ... } for look-through
  data_source:       "yahoo" | "finnhub",
  last_refreshed_at:  datetime,
}

// price_cache — current spot price per ticker; refreshed hourly during market hours
{
  ticker:          string,  // unique index
  price:           number,
  currency:        string,
  as_of:           datetime,  // from provider
  last_fetched_at: datetime,  // from us
  data_source:     "yahoo" | "finnhub",
}

// fx_rates — daily ECB reference rates; EUR base
{
  date:    date,    // YYYY-MM-DD, unique index
  rates:   json,    // { "USD": 1.08, "GBP": 0.85, ... }
}
```

## 5. External data providers (Strategy pattern)

```ts
// server/src/providers/types.ts
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

| Concern | Impl | Why |
|---|---|---|
| Primary prices + profile | `YahooPriceProvider` (`yahoo-finance2`) | Single `quoteSummary` call returns price + sector + country + mcap + PE + beta + yield. Free. Used by Ghostfolio + Portfolio Performance. |
| Fallback prices | `FinnhubPriceProvider` | Invoked only when Yahoo returns `null` / stale. Free tier (60 req/min) is plenty. |
| FX | `EcbFxProvider` | Official daily reference rates from `https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml`. No key, no rate limit. |

### Refresh schedule

```
Reactive:  on-import or on-add a new ticker → fetch immediately
Hourly:    Mon–Fri 07:00–22:00 Europe/Amsterdam, all known tickers
Daily:     16:30 — ECB FX rates (after publish)
Nightly:   02:00 — snapshot every account's holdings into holdings_snapshot
Weekly:    Sunday 02:00 — symbol_profiles refresh for stale tickers (>7d)
```

### Known limitation (acknowledged)

Yahoo's unofficial endpoint and Finnhub's free tier both have "personal use" wording. Fine for friends-and-family scale. If the app grows, upgrade path is Twelve Data ($29/mo) — drop-in `TwelveDataPriceProvider`, no other code changes.

## 6. Statement import flow

```ts
export interface StatementImporter {
  source: 'revolut' | 'trading212';
  detect(file: Buffer, filename: string): boolean;
  parse(file: Buffer): Promise<ParsedStatement>;
}

export type ParsedStatement = {
  account_label: string;     // inferred from filename / header
  positions: Array<{
    ticker: string;          // resolved from ISIN when present
    isin?: string;
    quantity: number;
    cost_basis?: number;     // nullable — Revolut has none (spike 2)
    cost_currency?: string;
  }>;
};
```

**Both brokers export PDF** (confirmed by real statements — spike 2 results). Importers parse PDF, using a position-aware extractor (pdf.js text-with-coordinates, or `pdfreader`) that locates the one relevant table by header detection:

- **`Trading212PdfImporter`** — locates the **"Invest account – open positions summary"** table (11 columns: `INSTRUMENT, ISIN, INSTRUMENT CURRENCY, QUANTITY, AVERAGE PRICE, PRICE, RETURN, VALUE, FX RATE, RETURN (EUR), VALUE (EUR)`). ISIN is the primary join key; `AVERAGE PRICE × QUANTITY` gives cost basis.
- **`RevolutPdfImporter`** — locates the **"USD Portfolio breakdown"** table (7 columns: `Symbol, Company, ISIN, Quantity, Price, Value, % of Portfolio`). ISIN is the join key. **No cost basis** in this table → positions imported with `cost_basis = null`. Reconstructing cost from the transaction history (which involves stock splits + an entity transfer) is out of v1 scope.

A shared `safe-pdf` harness enforces size/page caps and text-only extraction (pdf.js disables scripting by default). See spike results: `docs/spikes/2026-06-06-spikes-1-2-results.md`.

### Update strategy: snapshot-replace

Per user decision: a Revolut / T212 account is **statement-sourced** — each upload completely replaces its holdings. The most recent successful upload is truth for that account. A "manual" account is **log-sourced** — adds and sells write transactions; holdings are derived.

```
1. User uploads file → POST /api/import/upload
2. BFF computes sha256(file). If a successful import has this hash → 409.
3. importer.detect() → pick adapter; importer.parse() → positions[]
4. PREVIEW (no DB writes):
   - "12 positions, 3 new tickers (data will be fetched), replacing previous 11"
   - Show diff visually for trust ("AAPL 10→15, MSFT 8→0, NVDA new")
5. On confirm:
   - delete all holdings for that account
   - insert new holdings from upload
   - write imports row
   - synchronously fetch symbol_profiles + price_cache for any new tickers
   - return summary
```

**Manual account flow:**
- Add → writes `transactions{type:'buy'}` + upserts holding.
- Sell → writes `transactions{type:'sell'}` + decrements/zeros holding.
- Edit → writes `transactions{type:'adjustment'}` + recomputes.

**Mitigation for snapshot-replace's audit loss:** the `holdings_snapshot` nightly cron preserves point-in-time positions for every day, reconstructing the past for Phase 2 analytics without needing per-transaction history from statements.

## 7. Analytics catalogue (Phase 1)

Computed from the snapshot model. Honest about what's possible without trade history.

| # | Tile | Computation |
|---|---|---|
| 0 | **Summary strip** | `total_value_eur`, `total_cost_eur`, `unrealised_pl`, `positions_count`, 30-day sparkline (from `holdings_snapshot` once available, else flat) |
| 1 | **Allocation** | `by_sector`, `by_country`, `by_currency` — donut + ranked list, tabbed in one tile |
| 2 | **Top 5 concentration** | top 5 by `position_value / total`. "Your top 5 are 62% of the portfolio." |
| 3 | **Diversification score** | `sector_HHI`, `geo_HHI`, `top5_share` → composite `100 × (1 - cbrt(sector_HHI × geo_HHI × top5_share))`. Headline number + three sub-scores. "Effective positions = 1/HHI" tooltip. |
| 4 | **Income** | `weighted_div_yield = Σ(weight × dividend_yield)`, `expected_annual_eur = yield × total_value` |
| 5 | **Quality** | `weighted_pe = 1 / Σ(weight × (1/pe))` (harmonic), `weighted_beta = Σ(weight × beta)` |
| 6 | **Treemap** | ECharts treemap — boxes sized by `position_value`, coloured by `unrealised_pl_pct`. Spot winners/losers at a glance. |

### Phase 2 (deferred until data available)

TWR, XIRR, Sharpe, Sortino, max drawdown. All require either dated cash flows or ≥3–6 months of `holdings_snapshot` history. Snapshot cron starts collecting from day one — no rework when we add these.

### Honest UI framing

- **"Return vs cost basis"**, not "true return". Tooltip explains we'll switch to TWR once enough history exists.
- **"Snapshot diversification"** — based on today's holdings, not a smoothed average.

### ETF allocation look-through (spike 3 finding)

Yahoo's `assetProfile` returns no sector/country for ETFs — and ETFs (VWRL, IWDA, etc.) are the dominant holding for the target user. Mitigation, verified live: branch on `quoteType`; for ETFs pull `topHoldings.sectorWeightings` and distribute the position's value across those sectors in the Allocation/Diversification tiles. Geographic look-through for ETFs is **not** cleanly available from Yahoo — ETFs contribute to a "Multiple/Diversified" geo bucket in v1; true geo look-through is deferred to Phase 2. See `docs/spikes/2026-06-06-spikes-3-4-results.md`.

### Modular tile registry

```ts
// src/tiles/registry.ts
export const PHASE_1_TILES: Tile[] = [
  { id: 'allocation',      title: 'Allocation',      component: Allocation },
  { id: 'concentration',   title: 'Top 5',           component: Concentration },
  { id: 'diversification', title: 'Diversification', component: DiversificationScore },
  { id: 'income',          title: 'Income',          component: Income },
  { id: 'quality',         title: 'Quality',         component: Quality },
  { id: 'treemap',         title: 'Heatmap',         component: Treemap },
];
```

Each tile takes `{ accountIds: 'all' | string[]; dateRange?: ... }`. Adding a tile = one file + one line.

## 8. Frontend

### Stack

- **Vite + React 19 + TypeScript** (workspace precedent: `dutch-app`).
- **Tailwind CSS v4** (matches `dutch-app`).
- **shadcn/ui** — Radix-based, accessible, themable, code is owned not imported. Dialogs, sheets, command palette, dropdowns, toasts.
- **ECharts** (via `echarts-for-react`) — industry-standard finance viz. Lazy-loaded per-tile (~200 KB gzipped is fine when split).
- **Framer Motion** — sheet transitions, number count-ups on price refresh, list reorder, FAB.
- **TanStack Query** — server cache, stale-while-revalidate, optimistic mutations.
- **TanStack Router** — typed routes (`/portfolio`, `/account/:id`, `/account/:id/holdings`, `/settings`).
- **`@myorg/auth-google`** workspace package for Firebase Google sign-in.

### Theming

```
src/styles/tokens.css
  :root { --bg, --surface, --fg, --muted, --accent, --success, --danger, ... }
  [data-theme="dark"] { /* overrides */ }

src/lib/theme.ts
  - reads localStorage('theme'); falls back to prefers-color-scheme
  - <ThemeToggle /> in Settings
  - never auto-flips mid-session; respects user choice
```

Tokens are semantic (`--success`, not `--green-500`). Both themes designed intentionally (dark is not "inverted light"). ECharts gets a custom theme object per mode.

### Layout

```
hero strip:  total value EUR + YTD % + 30-day sparkline
tabs:        All · Revolut · T212 ISA · T212 Invest · +
tile grid:   1 col mobile, 2-3 col desktop (Allocation, Diversification, Top 5,
             Income, Quality, then Treemap full-width)
bottom tab:  Portfolio · Search · Activity · Settings
FAB:         + (Upload statement / Add position)
```

Per-account dashboard at `/account/:id`; global at `/portfolio`. Same tile components, different filter scope.

### Polish targets

- Skeleton screens (never spinners).
- Number count-ups on price refresh.
- Empty states with illustrations + single clear CTA.
- Toast on every mutation, undo for sells.
- Pull-to-refresh triggers a manual price refresh.
- Haptic feedback on confirm actions (iOS `navigator.vibrate`).

### Search UX

- **Cmd-K** on desktop, top search bar on mobile.
- Debounced 300 ms → `GET /api/search?q=...` → BFF searches `symbol_profiles` first, then `YahooProvider.search()` for unknown, caching new hits into `symbol_profiles`.
- Enter → "Add to which account?" sheet → qty + cost + currency + date.

## 9. Auth & security

- **Auth:** Firebase Google sign-in via `@myorg/auth-google`. PWA holds the ID token, sends it as `Authorization: Bearer ...` on every `/api/*` call.
- **BFF verification:** every `/api/*` request runs through middleware that calls `firebase-admin.auth().verifyIdToken(token)`. The decoded UID becomes the PocketBase user ID.
- **PocketBase user creation:** on first `/api/auth/me` call, BFF upserts a PocketBase user record keyed by Firebase UID (using a service-account token).
- **PocketBase row scoping:** all per-user collections have rules `@request.auth.id != "" && user = @request.auth.id` for list/view/create/update/delete.
- **Shared collections:** `symbol_profiles`, `price_cache`, `fx_rates` have `listRule = viewRule = "@request.auth.id != ''"` and locked write rules — only the BFF service account can write.
- **Secrets:** Firebase service-account JSON, Finnhub key, PocketBase admin token — all in `.env` (gitignored). Vite build only sees public `VITE_FIREBASE_*` vars.
- **CORS:** BFF allows only `https://invest.cya.run` origin in production, `http://localhost:5173` in dev.
- **Rate limiting:** per-Firebase-UID, 60 req/min on `/api/*`. Stops a single user from accidentally / maliciously exhausting Yahoo's tolerance.
- **Backups:** PocketBase already backed up by the workspace's existing nightly cron — our schema joins that backup. No new backup work needed.

## 10. Deployment

`apps/finance-tracker/docker-compose.yml`:
```yaml
services:
  finance-tracker:
    build:
      context: ../..
      dockerfile: apps/finance-tracker/Dockerfile
    ports:
      - "3110:80"
    environment:
      - PB_URL=...
      - PB_ADMIN_TOKEN=...
      - FINNHUB_API_KEY=...
      - FIREBASE_SERVICE_ACCOUNT=...
    restart: unless-stopped
    networks:
      - mac-mini-net
networks:
  mac-mini-net:
    external: true
```

Cloudflare Tunnel config addition:
```yaml
- hostname: invest.cya.run
  service: http://localhost:3110
```

Firebase Console: add `invest.cya.run` to Authentication → Settings → Authorized domains.

## 11. Validation spikes (run before / during implementation)

1. **Sample Trading 212 export.** Pull a real CSV; confirm column schema matches the documented spec; verify ISIN is always populated.
2. **Sample Revolut export.** Generate a current statement; verify it's XLSX (not PDF); confirm column layout.
3. **Yahoo ticker resolution.** For ~20 of our likely tickers (US large-caps, EU large-caps, EU ETFs like VWRL.L), confirm `yahoo-finance2`'s `quoteSummary` returns sector + country + market cap.
4. **ECB FX freshness.** Cron the daily endpoint at 16:30 Amsterdam; verify same-day data is available consistently.
5. **PocketBase rule under realtime.** Subscribe as user A; create a row for user B; confirm A doesn't see it (per the research notes on subscription gotchas).

## 12. v2 roadmap

- TWR / XIRR / Sharpe / max drawdown (once `holdings_snapshot` has ≥3 months).
- Phase 2 fundamentals: financial statements, earnings, news per ticker.
- Recommendation engine (rules-based first: "you're 60% US tech — diversify").
- PDF-format Revolut statement support.
- Follow / share portfolios (with permission).
- Tax-lot tracking.
- Multi-currency display (user preference besides EUR).
- Twelve Data / paid provider migration if user base grows.

## 13. Open implementation decisions

Deferred to the implementation plan / first slices:

- **PocketBase user collection vs external mapping.** Whether to make Firebase the only auth and store users as a normal collection keyed by `firebase_uid`, or use PocketBase's auth collection with `id = firebase_uid`. Probably the latter for simpler relations.
- **ECharts theme objects.** Hand-rolled vs adapt one of the community themes. Decide during the theming spike.
- **Cmd-K library.** `cmdk` (the de-facto choice) vs roll our own with shadcn `Command`. Probably `cmdk`.
- **Treemap interactivity.** Click drilling? Hover preview? Decide during the treemap tile build.

---

## Decision log

Validated through brainstorming on 2026-06-06:

1. **Investment portfolio dashboard**, not bank-transactions tracker (pivot from earlier scope).
2. **Repurpose `apps/finance-tracker/`** — same folder, fresh scope.
3. **Open Google sign-in**, multi-tenant private-per-user. No following / sharing in v1.
4. **PocketBase + Hono BFF + Vite/React PWA.** Workspace-native stack. No Firefly III, no Tailscale, no Cloudflare-Access-Auth.
5. **Cost-basis stored in native currency**, converted to EUR at display time using cached ECB rates.
6. **Snapshot-replace** on statement uploads — simpler than diff-and-confirm, mitigated by nightly `holdings_snapshot` cron preserving history.
7. **Yahoo (primary) + Finnhub (fallback) + ECB (FX)** with Strategy pattern for swappability.
8. **Hourly price refresh** + immediate refresh on add/import.
9. **Tailwind v4 + shadcn/ui + ECharts + Framer Motion** — polish over uniformity with `habit-tracker`'s inline styles.
10. **Light + dark mode** with semantic tokens; dark is intentionally designed, not inverted.
11. **Diversification = composite (sector × geo × top5)** with three sub-scores shown alongside.
12. **Phase 1 returns labeled "vs cost basis"** — honest, not pretending to be TWR.
13. **Per-account dashboards + global aggregate** view, same tile components.
14. **Snapshot diff in preview UI** — for user confidence only, not used to synthesise transactions.
