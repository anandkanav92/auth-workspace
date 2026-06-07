# Manual Validation Spikes (1, 2, 5) — Instructions

**Date:** 2026-06-06
**Status:** Pending — these need real account access / a running PocketBase, so they're yours to run.

Each is < 15 minutes. Record the result inline under each spike and commit. If any comes back ugly, we revise the design before writing implementation code.

---

## Spike 1 — Trading 212 CSV export schema

**Goal:** Confirm the real export column schema and that ISIN is always populated (it's our canonical join key).

**Steps:**
1. Open Trading 212 (web or app) → **History** → **Export**.
2. Select: account = Invest (and/or ISA), date range = all, type = **Orders** (and **Holdings** if offered).
3. Download the CSV.
4. Open the CSV. Record the **header row verbatim** below.
5. Check: is the `ISIN` column present and populated on **every** row? Any rows with blank ISIN (e.g. FX conversions, fractional dividends)?

**Expected (from research):**
```
Action,Time,ISIN,Ticker,Name,No. of shares,Price / share,Currency (Price / share),Exchange rate,Result,...
```

**Record result here:**
- Header row: `____`
- ISIN always populated? `____`
- Surprises: `____`
- **Verdict (GREEN/YELLOW/RED):** `____`

---

## Spike 2 — Revolut statement export format

**Goal:** Confirm Revolut Trading gives an **XLSX** (not just PDF), and capture its column layout.

**Steps:**
1. Revolut app → **Stocks** → profile/menu → **Statements** (or **Documents**).
2. Look for a **Trading account statement**. Note the offered formats — Excel/XLSX? CSV? PDF only?
3. If XLSX/CSV available: download it, open it, record the header row and which sheet/section holds current positions.
4. If **PDF only**: note that — it means v1 supports T212 first, and Revolut import waits for the v1.5 PDF path.

**Record result here:**
- Formats offered: `____`
- If XLSX/CSV — header row: `____`
- Positions section/sheet name: `____`
- **Verdict (GREEN/YELLOW/RED):** `____`
  - GREEN = XLSX with clear positions table
  - YELLOW = CSV-only or messy layout
  - RED = PDF-only (defer Revolut import to v1.5)

---

## Spike 5 — PocketBase realtime rule isolation

**Goal:** Verify a user cannot see another user's records, including via realtime subscriptions (the research flagged subscription auth gotchas).

**Prereq:** the workspace PocketBase running locally (same instance `habit-tracker` uses), with two test users created.

**Steps:**
1. Create the `accounts` collection (per plan Task 1.1) with rule `@request.auth.id != "" && user = @request.auth.id` on all five operations.
2. In a scratch Node script (or two browser tabs), authenticate as user A and user B.
3. As B, create an `accounts` row.
4. As A, both `getFullList()` **and** `subscribe('*', ...)` then have B create another row.
5. Confirm A sees **neither** B's existing rows (list) nor B's new row (realtime event).

**Minimal script:**
```js
import PocketBase from 'pocketbase';
const A = new PocketBase('http://localhost:8090');
const B = new PocketBase('http://localhost:8090');
await A.collection('users').authWithPassword('a@test.com', 'password123');
await B.collection('users').authWithPassword('b@test.com', 'password123');

A.collection('accounts').subscribe('*', (e) => {
  console.log('A received realtime event — SHOULD ONLY be A\'s own:', e.record.user, e.record.label);
});

await B.collection('accounts').create({ user: B.authStore.model.id, source: 'manual', label: 'B-secret' });
await new Promise(r => setTimeout(r, 1500));

const aSees = await A.collection('accounts').getFullList();
console.log('A list count (should exclude B-secret):', aSees.map(r => r.label));
process.exit(0);
```

**Record result here:**
- A's list excluded B's rows? `____`
- A received NO realtime event for B's row? `____`
- **Verdict (GREEN/YELLOW/RED):** `____`

---

## After running all three

If all GREEN → proceed to execution (subagent-driven or parallel session).
If Spike 2 is RED (PDF-only Revolut) → that's fine, plan already supports T212-first; just note Revolut import moves to v1.5.
If Spike 5 is anything but GREEN → **stop**, the per-user isolation is the core privacy guarantee; fix the rules before any code.
