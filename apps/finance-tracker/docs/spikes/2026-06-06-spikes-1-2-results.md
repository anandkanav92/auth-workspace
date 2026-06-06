# Validation Spikes 1 & 2 — Results (real statements)

**Date:** 2026-06-06
**Inputs:** real Trading 212 Activity Statement + Revolut Account Statement (both supplied by the user, both PDF).

---

## Headline

Both brokers were exported as **PDF**, not CSV/XLSX. PDF parsing is therefore **required in v1** (was previously deferred to v1.5). PDFs are digitally generated (clean text, consistent column layout) — extraction is reliable table-parsing, not OCR.

| Spike | Status | Verdict |
|---|---|---|
| 1 — Trading 212 | 🟢 GREEN | Open-positions table has everything incl. cost basis. |
| 2 — Revolut | 🟡 YELLOW | Holdings table has ISIN + qty + current value, but **no cost basis**. |

---

## Spike 1 — Trading 212 Activity Statement

**Structure (12 pages):**
- p1 — Overview: Invest + CFD account summaries (account value, deposits, returns, fees).
- p2 — "Invest account – executed trades" (recent trades only).
- **p3–4 — "Invest account – open positions summary" ← the import target.**
- p5 — cash breakdown (EUR/USD cash + EUR values).
- p6 — transactions and dividends.

**Open-positions table columns (the snapshot source):**
```
INSTRUMENT · ISIN · INSTRUMENT CURRENCY · QUANTITY · AVERAGE PRICE ·
PRICE · RETURN · VALUE · FX RATE · RETURN (EUR) · VALUE (EUR)
```

- **ISIN populated on every row** (e.g. AAPL = US0378331005, AGGU = IE00BZ043R46).
- **Cost basis present** as `AVERAGE PRICE` (per share). `QUANTITY × AVERAGE PRICE` = cost in instrument currency.
- Pre-computed `VALUE (EUR)` and `FX RATE` inline — we can cross-check our own FX conversion.
- ~45 positions, mixed currency (USD/GBP/EUR) and many ETFs (AGGU, EIMI, IWDE, SGLN, VUAA, VUSA, EUNL, EUNK, NQSE, XAD2).
- Account value at statement time: €83,539.13.

**Verdict: GREEN.** Single table, fully sufficient for snapshot import including cost basis. Parse pages 3–4 for the open-positions section.

---

## Spike 2 — Revolut Account Statement

**Structure (12 pages):**
- **p1 — USD Account summary + "USD Portfolio breakdown" ← the import target.**
- p1→p12 — "USD Transactions" (full history 2021→2026).

**Portfolio breakdown columns (the snapshot source):**
```
Symbol · Company · ISIN · Quantity · Price · Value · % of Portfolio
```

- **ISIN populated** (e.g. META = US30303M1027, NVDA = US67066G1040).
- **No cost-basis column** — only current `Price` and `Value`. This is the key gap.
- Single-currency account (USD). Entity = Revolut Securities Europe UAB.
- ~20 positions (META, NVDA, AMZN, ALKT, MSFT, COUR, ACN, NKE, PINS, HMC, MRVL, NFLX, CLNE, ADBE, UBER, NIO, HYZN, TTD, HOOD).
- Positions value US$20,640.41 / total US$21,745.91.

**Transaction history complications (relevant only if we ever reconstruct cost basis):**
- **Stock splits**: NVDA (2024-06-10), GOOG (2022-07-18), HYZN **reverse split** (2024-09-11, negative quantity −55.46). Splits change share counts — naive cost averaging would be wrong.
- **Entity transfer**: 2023-08-06 "Transfer from Revolut Trading Ltd to Revolut Securities Europe UAB" — every position re-booked at $0. Another correctness landmine for reconstruction.
- **Dividend tax corrections**, custody fees, cash top-ups all interleaved.

**Verdict: YELLOW.** Holdings + current value + allocation all work. Cost basis is not directly available and reconstructing it from transactions is error-prone (splits + transfers).

---

## Decisions (made with user, 2026-06-06)

1. **PDF parsing for both brokers, in v1.** Matches the real export workflow. Use a position-aware PDF library (pdf.js text-with-coordinates, or `pdfreader`) to extract the one relevant table from each statement by header detection.
2. **Revolut = current value only; cost basis left blank.** T212 carries full cost basis. The "return vs cost basis" tile shows "—" for Revolut positions. Allocation / sector / diversification / top-N / income tiles all run off current value and work for both brokers. Cost-basis reconstruction (handling splits + transfers) is explicitly **out of v1 scope**.

---

## Design / plan changes required

1. **`holdings.cost_basis` and `cost_currency` become nullable.** Revolut positions store `quantity` + a current value but no cost.
2. **Milestone 6 importers rewritten for PDF**, replacing `Trading212CsvImporter` / `RevolutXlsxImporter`:
   - `Trading212PdfImporter` — locate "open positions summary" table (pages 3–4 by header), parse 11 columns, emit positions with cost basis.
   - `RevolutPdfImporter` — locate "USD Portfolio breakdown" table, parse 7 columns, emit positions with `cost_basis = null`.
   - Shared `extractTables(pdfBuffer)` helper using position-aware extraction.
3. **`safe-xlsx` harness (Task 6.0) generalises to `safe-pdf`** — size cap, page cap, text-only extraction (no JS execution; pdf.js disables scripting by default), timeout.
4. **Importer interface gains `cost_basis?: number` (optional)** in `ParsedStatement.positions`.
5. **"Return vs cost basis" tile (Summary + any P&L display)** must handle null cost basis gracefully — show "—" and exclude those positions from portfolio-level return aggregation, with a footnote ("excludes N positions without cost data").
6. **Validation fixtures**: commit redacted 1-page versions of both PDFs (holdings table only, account numbers/name removed) as parser test fixtures.

## Privacy note

The supplied PDFs contain the user's name, address, and account numbers. **Do not commit the raw PDFs.** Fixtures must be redacted down to the holdings table with PII stripped.
