# Trading 212 API Sync + Change-Tracking & Per-Position Analytics — Design

**Date:** 2026-06-08
**Status:** Validated (brainstorm complete, all sections approved)
**Scope:** Trading 212 only (Revolut deferred). Replaces the destructive "snapshot-replace on PDF upload" with automated API sync, a transaction ledger, change-tracking, and rich per-position analytics.

---

## 1. Goals

1. **Track changes across updates** — show what was *sold / held / increased / opened* since the last sync, instead of silently replacing all holdings.
2. **Rich per-position detail** — buy prices over time, current price (live), unrealised P&L, realised P&L, dividends received, holding period; sortable/filterable holdings.
3. **Effortless recurring updates** — automated sync via the Trading 212 API rather than manual PDF uploads.

## 2. Why the Trading 212 API (research)

- T212 has an official **Public API** (beta) for **General Invest + Stocks ISA** accounts (user has Invest):
  - `GET /api/v0/equity/portfolio` → open positions with **quantity, averagePrice, ppl (live P&L)**.
  - `GET /api/v0/equity/history/orders` (paginated) → executed orders (date, direction, qty, price, FX).
  - `GET /api/v0/history/dividends` (paginated) → dividend payments.
  - `GET /api/v0/equity/account/cash` + transactions → cash/interest.
  - `POST /api/v0/history/exports` → async CSV (bulk backfill fallback).
  - Auth: **API key** in the `Authorization` header; **read-only scopes** chosen at creation; IP allowlist supported.
- **Revolut has no retail stocks API** (Business / Merchant / Open-Banking / Revolut-X-crypto only) → deferred; CSV import is the only future path.

> ⚠️ The exact paths/fields/rate-limits above must be confirmed in **Spike 0** against the live API — the API is beta.

## 3. Core model — Hybrid (decided)

- **`GET /portfolio` is the source of truth for current holdings + average cost** (broker-computed, already handles splits/transfers). We never reconstruct holdings from trades (sidesteps split/reverse-split/entity-transfer cost-basis bugs).
- **Order history is the ledger** — source of truth for trade history (buy-prices-over-time), realised P&L, and change-tracking.
- **Dividends** are real income.

## 4. Connection & security (decided)

- User creates a **read-only** key in T212 (Settings → API (Beta); scopes: account/metadata, portfolio, history orders/dividends/transactions; **no order placement**), IP-restricted to the server's egress **`77.173.30.177`** (verified container egress; Docker IPv6 disabled so IPv4 only).
- Key entered in-app: **Settings → Connect Trading 212**.
- Stored in a new **`broker_connections`** collection (per-user, IDOR-scoped):
  `{ user, broker:'trading212', api_key_enc, t212_account_id, currency, status: connected|error, last_synced_at, last_error }`.
- `api_key_enc` = **AES-256-GCM** ciphertext using `T212_KEY_ENC_SECRET` (Mac Mini `.env`); decrypted only in memory during a sync; never logged.

## 5. Data model

- **NEW `broker_connections`** — see §4.
- **`holdings`** (reuse) — current open positions, refreshed every sync from `/portfolio`: quantity, `averagePrice → cost_basis`, ticker/isin, account, source. GBX normalised (existing `normalizePence`).
- **`transactions`** (reuse) — the ledger, from order/dividend history. **Add `external_id`** + unique `(user, source, external_id)` index → idempotent re-sync. Row: type (buy/sell/dividend/fee/interest), ticker, isin, quantity, price, currency, fee, occurred_at, source='trading212', external_id.
- **`holdings_snapshot`** (reuse) — unchanged; value-over-time.

## 6. Sync service

- **`Trading212Provider`** (strategy interface: `validateKey()`, `fetchPositions()`, `fetchOrders(cursor)`, `fetchDividends(cursor)`) — isolates T212 specifics; future brokers slot in.
- Per sync: decrypt key → refresh `holdings` from `/portfolio` (replace only that account's holdings; ledger untouched) → paginate orders → upsert `transactions` (dedup by `external_id`) → paginate dividends → upsert → stamp `last_synced_at`/status.
- **Triggers:** "Sync now" button (`POST /api/broker/trading212/sync`) + **daily cron** (~06:00 Amsterdam). Live prices still come intraday from the existing Yahoo path.
- **Robustness:** respect rate limits (conservative spacing, `429` backoff), pagination cursors; idempotent (unique `external_id` + full position refresh) so re-runs never duplicate/wipe; initial sync backfills all history, later syncs incremental but safe to over-fetch; bad/expired key or **IP-blocked** → `status:error` surfaced in Settings ("Reconnect" / "update allowlist"), existing data preserved.

## 7. Analytics & UX

- **Change-tracking** (ledger-driven): real **Activity feed** (repurpose the bottom-nav Activity slot, currently → `/import`) — chronological buys/sells/dividends; plus a **"Since last sync"** summary (opened/added/trimmed/closed + dividends).
- **Per-position detail** (tap a holding): quantity, avg cost, live price, market value, **unrealised P&L (€/%)**; **buy/sell history over time**; **realised P&L** (average-cost) + **dividends received**; holding period, sector/country, yield, per-ticker value sparkline.
- **Holdings list:** sort by value / unrealised P&L €|% / name / weight; filter by account / asset-type / sector.
- **Portfolio analytics:** realised vs unrealised P&L totals; **actual dividend income** (upgrades the estimated-yield Income tile); existing tiles keep working off refreshed holdings.

## 8. Migration

First API sync supersedes the PDF-imported T212 holdings (positions replace holdings for that account). PDF upload + Revolut holdings stay untouched as legacy.

## 9. Testing

- Unit: `Trading212Provider` (mocked API), sync upsert/dedup (`external_id` idempotency), GBX normalisation, ledger→activity/realised-P&L math, AES round-trip.
- Integration: against the T212 **demo** environment if viable.
- **Spike 0 (first):** validate the live API contract with the real read-only key **on the Mac Mini** (the IP-restricted key only works from `77.173.30.177`): exact endpoints, auth header, response fields, pagination, rate limits, GBX, dividends shape.

## 10. Milestones

- **M0 — Spike:** validate live T212 API contract (on the Mini, with the key).
- **M1:** `broker_connections` + AES helper + `T212_KEY_ENC_SECRET` + Settings "Connect Trading 212" UI + `validateKey`.
- **M2:** `Trading212Provider` + sync service (positions→holdings, orders/dividends→ledger, dedup) + "Sync now".
- **M3:** daily sync cron + error/reconnect UX (incl. IP-changed status).
- **M4:** Activity feed + "since last sync" summary.
- **M5:** per-position detail (buy history, realised P&L, dividends) + sortable/filterable holdings.
- **M6:** realised/unrealised totals + real dividend income; glossary updates.

## 11. Open questions / risks

- T212 API is **beta** — endpoints/limits may shift (Spike 0 de-risks).
- Home WAN IP rotation breaks the IP allowlist → mitigated by clear Settings status (non-silent).
- Realised-P&L method: average-cost in v1 (FIFO later if needed).
