# Validation Spikes 3 & 4 — Results

**Date:** 2026-06-06
**Run by:** automated (yahoo-finance2 v3.x against live API; ECB live feed)

---

## Spike 4 — ECB FX freshness: ✅ GREEN

- `GET https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml` → HTTP 200, 1547 bytes, 165 ms.
- Feed dated `2026-06-05` (previous business day; ECB publishes ~16:00 CET each working day).
- 29 currencies present, including every one we care about: USD (1.1640), GBP (0.86433), CHF (0.9175), SEK, NOK, DKK, JPY, CAD, AUD.
- XML structure: `gesmes:Envelope > Cube > Cube[time] > Cube[currency,rate]` — matches the `fast-xml-parser` traversal in plan Task 3.4 (`doc['gesmes:Envelope'].Cube.Cube.Cube`).

**Verdict:** No changes needed. The `EcbFxProvider` design is correct.

---

## Spike 3 — Yahoo ticker resolution: 🟡 YELLOW (two material findings)

### Finding A (BLOCKING for the plan): yahoo-finance2 v3 changed the API

v3.x requires instantiation; the v2 default-singleton style in the plan's `YahooPriceProvider` will throw `Call 'const yahooFinance = new YahooFinance()' first`.

```ts
// WRONG (v2, what the plan currently shows)
import yahooFinance from 'yahoo-finance2';
yahooFinance.quoteSummary(...)

// CORRECT (v3)
import YahooFinance from 'yahoo-finance2';
const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });
yahooFinance.quoteSummary(...)
```

**Action:** Plan Task 3.2 code must be updated to v3 instantiation. The `YahooPriceProvider` class should construct one instance in its constructor.

### Finding B (DESIGN CHANGE): ETFs return NULL for sector / country / marketCap via `assetProfile`

Field completeness across 19 representative tickers using `['price','summaryDetail','assetProfile','defaultKeyStatistics']`:

| Field | Coverage | Notes |
|---|---|---|
| name, currency, exchange, price | 19/19 (100%) | Perfect for everything |
| sector, industry, country, marketCap, beta | 12/19 (63%) | **100% for individual stocks, 0% for ETFs** |
| peRatio | 15/19 (79%) | |
| dividendYield | 10/19 (53%) | Nulls mostly legit (non-dividend payers) |

The 7 ETFs (VTI, VOO, QQQ, VWRL.L, IWDA.AS, EUNL.DE, CSPX.AS) returned `null` for sector/country/marketCap. Individual stocks (AAPL, MSFT, GOOGL, AMZN, NVDA, META, ASML.AS, SAP.DE, BAS.DE, NESN.SW, SHOP, PYPL) were 100% complete.

**Why this matters a lot:** the target user (Trading 212 / Revolut retail, NL-based) overwhelmingly holds broad ETFs — VWRL and IWDA are the two most popular EU-domiciled ETFs. With the naive `assetProfile` path, a typical mostly-ETF portfolio would dump ~all of its value into an "Uncategorised" sector/country bucket, making the **Allocation** and **Diversification** tiles useless for exactly the people most likely to use the app.

### Mitigation (confirmed working): ETF look-through via `topHoldings` module

`quoteSummary(ticker, { modules: ['topHoldings', 'quoteType'] })` returns, for ETFs:
- `quoteType.quoteType === 'ETF'` — lets us branch.
- `topHoldings.sectorWeightings` — full sector breakdown, e.g. VWRL.L: `{realestate: 0.019, consumer_cyclical: 0.094, basic_materials: 0.038, consumer_defensive: 0.050, ...}`.
- `topHoldings.holdings` — top-10 underlying positions, e.g. VWRL.L: `NVDA 4.7%, AAPL 3.9%, MSFT 3.0%`.

Verified live for VWRL.L, IWDA.AS, VTI, CSPX.AS — all returned usable sector weightings + top holdings.

**Gap:** `topHoldings` gives **sector** weightings but not a clean **country/region** breakdown. Geographic allocation for ETFs is only partially solvable from Yahoo. Options: (a) accept "geography unavailable for ETFs" in v1 and show sector look-through only; (b) infer region from the ETF name/known mapping (VWRL = World, CSPX = US); (c) defer geo-for-ETFs to Phase 2. Recommend (a) for v1 honesty.

---

## Required plan / design changes (from Spike 3)

1. **Plan Task 3.2** — rewrite `YahooPriceProvider` for the v3 `new YahooFinance()` API.
2. **`symbol_profiles` schema** (design §4) — add `asset_type: 'stock' | 'etf' | 'other'` and `sector_weightings: json?` (sector → weight, populated only for ETFs).
3. **`YahooPriceProvider.profile()`** — branch on `quoteType`: stocks use `assetProfile`; ETFs additionally fetch `topHoldings` and store `sector_weightings`.
4. **Allocation tile (plan Task 11.2)** — sector aggregation must handle two cases:
   - Stock: single sector at 100% of position value.
   - ETF: distribute position value across `sector_weightings`.
5. **Geographic allocation** — document that ETF geo look-through is out of scope for v1; ETFs contribute to a "Diversified/Multiple" geo bucket rather than "Uncategorised".
6. **New validation sub-spike for Phase 2** — if we later want true geo look-through, evaluate a dedicated holdings-composition source (e.g. the ETF issuer's published holdings CSV).

---

## Spikes still pending (need real account access — user action)

- **Spike 1** — Trading 212 CSV export: confirm column schema + ISIN presence.
- **Spike 2** — Revolut statement export: confirm it's XLSX (not PDF) + column layout.
- **Spike 5** — PocketBase realtime rule isolation (needs the workspace PB instance running).
