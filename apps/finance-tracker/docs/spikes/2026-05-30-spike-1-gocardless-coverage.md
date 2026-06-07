# Spike 1 — GoCardless Bank Account Data viability

**Date:** 2026-05-30
**Question:** Is GoCardless Bank Account Data viable for pulling Revolut + ABN AMRO transactions for a Netherlands-based single user, with description data rich enough to feed a categorisation classifier?
**Time spent:** ~1 hour (desk research only; live-API portion blocked on credentials — see below)
**Companion script:** [`check-gocardless-coverage.sh`](./check-gocardless-coverage.sh)

---

## Verdict — YELLOW (with a hidden RED)

Technically workable for an **existing** GoCardless user. Two findings change the design assumptions in the v1 design doc:

1. **GoCardless Bank Account Data closed new signups on 2025-07-XX.** If we do not already hold credentials, this entire ingest layer is dead — we cannot register a new account at any tier. There is no public re-opening date. The fallback is **Enable Banking** (see §9).
2. **Revolut multi-currency wallets share one IBAN.** Naive dedup by IBAN or `internalTransactionId` will silently drop transactions. The data is usable but the importer must key on `(account_id, currency)`.

If we have credentials and accept these constraints, go ahead. If we don't have credentials, **stop the design and pivot to Enable Banking before scaffolding any code.**

---

## 1. Revolut Bank UAB in GoCardless for NL

- **Institution ID:** not publicly listed by name in docs. The only ID confirmed in published examples is `REVOLUT_REVOGB21` (Revolut Ltd, UK).
- **The Lithuanian/EEA entity** (Revolut Bank UAB, BIC `REVOLT21`, NL branch BIC `REVONL22`) is reached under `country=LT` and typically appears in other EEA passporting lists (NL, DE, IE, etc.) — but the exact slug must be confirmed by hitting `/institutions/?country=NL` with a live token.
- DNB register confirms Revolut Bank UAB is registered in NL (passport: WFTKF / R183723).
- **Listed for country=NL:** almost certainly yes, **but unverifiable without an API call.** The script answers this.

Sources:
- [GoCardless bank selection UI docs](https://developer.gocardless.com/bank-account-data/bank-selection-ui/)
- [DNB public register](https://www.dnb.nl/en/public-register/information-detail/?registerCode=WFTKF&relationNumber=R183723)

## 2. Transaction history window on first connect

| Bank | First-connect window | Notes |
|---|---|---|
| Revolut Bank UAB | ~90 days | Hard cap at the bank's PSD2 endpoint. Cannot be extended via `max_historical_days` based on community reports. |
| ABN AMRO | up to 540 days | Commercial entity `ABNAGB2LXXX` exposes 540. Default GoCardless agreement is 90 unless `max_historical_days` is raised at agreement creation. |

**Implication for design:** the v1 design assumes 12 months of trend data. For Revolut, the first ~9 months of trend will be empty until we accumulate it ourselves. Mention this in the analytics tile copy ("Limited history for Revolut — will fill in over time").

Sources:
- [Fintable ABN AMRO coverage](https://fintable.io/coverage/banks/Netherlands/8927_abn-amro-bank)
- [GoCardless quick-start guide](https://developer.gocardless.com/bank-account-data/quick-start-guide/)

## 3. Refresh frequency cap (free tier)

- **Hard cap: 4 calls per endpoint per account per 24h.** Imposed by banks, not GoCardless. `details`, `balances`, `transactions` each have their own bucket.
- No monthly call cap on the free tier.
- 429 responses return `HTTP_X_RATELIMIT_ACCOUNT_SUCCESS_RESET` indicating wait time.
- **Implication:** the v1 design's "twice daily" ingest cron is fine. Four times daily would be the theoretical max but offers no real benefit at our latency tolerance.

Sources:
- [Firefly III #9138 (GoCardless rate-limit discussion)](https://github.com/orgs/firefly-iii/discussions/9138)
- [Actual Budget GoCardless bank-sync docs](https://actualbudget.org/docs/advanced/bank-sync/gocardless/)

## 4. Revolut transaction field quality

| Field | Reality |
|---|---|
| `creditorName` | Inconsistent fill. Multiple Firefly issues show it missing or wrong on card transactions (#9688, #10546). **Treat as low/medium signal.** |
| `remittanceInformationUnstructured` | Sparse for card purchases on Revolut. Reliable for SEPA transfers. |
| `merchantCategoryCode` | Not surfaced by Firefly importer. `proprietaryBankTransactionCode` exists in payload but is dropped during Firefly mapping. MCC itself rarely populated by Revolut in the PSD2 feed. |
| FX / currency exchange | All Revolut sub-accounts share **one IBAN** — distinguishable only by `currency` + Nordigen account ID (#7977). `currencyExchange` object returned by GoCardless but historically dropped by Firefly importer (#8296, claimed fixed in importer v1.7.6). |
| Date precision | Some Revolut entries return only a date, no datetime — breaks strict chronological sort (#9965, #9961). |
| `internalTransactionId` uniqueness | Only unique **within an account**, not across a requisition's accounts. Naive global dedup drops legitimate transactions (#10914). |

**Design impact:** the JS classifier in the BFF must extract features from whatever fields _are_ populated and fall back gracefully. Char-n-gram TF-IDF over `concat(creditorName, remittanceInformationUnstructured, proprietaryBankTransactionCode)` with sensible empty handling. We must dedup by `(account_id, internalTransactionId)` not by `internalTransactionId` alone.

Sources:
- [#7977 Revolut shared IBAN](https://github.com/firefly-iii/firefly-iii/issues/7977)
- [#8296 currencyExchange dropped](https://github.com/firefly-iii/firefly-iii/issues/8296)
- [#9688 creditorName issue](https://github.com/firefly-iii/firefly-iii/issues/9688)
- [#10546 creditorName follow-up](https://github.com/firefly-iii/firefly-iii/issues/10546)
- [#10914 internalTransactionId uniqueness](https://github.com/firefly-iii/firefly-iii/issues/10914)
- [#9961 proprietaryBankTransactionCode handling](https://github.com/firefly-iii/firefly-iii/issues/9961)

## 5. ABN AMRO transaction field quality

| Field | Reality |
|---|---|
| `creditorName` / `debtorName` | Well populated on SEPA. Weaker on card — card transactions usually arrive on a separate "credit card" PSD2 product, not the current account. |
| `remittanceInformationUnstructured` | Generally well populated for SEPA; this is the field ABN AMRO consumers rely on for the human-readable description. |
| `merchantCategoryCode` | Not reliably surfaced via PSD2 AIS. |
| `bookingDate` vs `valueDate` | Both provided. Use `bookingDate`. |
| History window | Up to 540 days possible (commercial entity). Access valid 90 days, then SCA reauth (730-day reconfirm window). |

**Design impact:** ABN AMRO is the "well-behaved" half of the dataset. The classifier should train heavily on this and treat Revolut as the noisy half.

Sources:
- [Fintable ABN AMRO coverage](https://fintable.io/coverage/banks/Netherlands/8927_abn-amro-bank)
- [ABN AMRO PSD2 AIS reference](https://developer.abnamro.com/api-products/account-information-psd2/reference-documentation)

## 6. 90-day SCA reauth — programmable countdown?

- The **requisition** object does **not** directly expose a `valid_until` field in the documented response. Fields are: `id, created, redirect, status, institution_id, agreement, reference, accounts, user_language, link, ssn, account_selection, redirect_immediate`.
- To compute the expiry: fetch the linked **end-user agreement** object — it returns `created`, `access_valid_for_days`, and `accepted`. Countdown = `accepted + access_valid_for_days` (max 90 for most NL banks, up to 180 for some).
- When expired, the requisition transitions to status `EXPIRED` (status code `EX`). The PWA's connection-health tile can poll for this and the agreement endpoint.

**Design impact:** the v1.5 "connection health dashboard" can compute the countdown from the agreement object. Add a daily background poll to the BFF that fetches each active agreement and stores `expires_at` in SQLite for fast PWA reads.

Sources:
- [GoCardless quick-start guide](https://developer.gocardless.com/bank-account-data/quick-start-guide/)
- [GoCardless statuses reference](https://developer.gocardless.com/bank-account-data/statuses/)

## 7. Revolut-specific gotchas (consolidated checklist)

For the BFF's ingest path (or for the Firefly Data Importer config, whichever ends up doing dedup):

- [ ] Key dedup by `(account_id, internalTransactionId)` not `internalTransactionId` alone.
- [ ] Key per-account model by `(account_id, currency)` since one IBAN covers multiple wallets.
- [ ] Test FX transactions — verify the `currencyExchange` object survives the Firefly import chain (Firefly importer ≥1.7.6 claims this is fixed).
- [ ] Sort transactions by `bookingDateTime` if present, falling back to `bookingDate` — but expect some Revolut entries to be date-only.
- [ ] Do not depend on `merchantCategoryCode` being populated. Use description text features instead.
- [ ] Accept `creditorName` as missing/empty frequently for card txns. The classifier should not weight it heavily on Revolut data.

## 8. Signup closure (the unwelcome surprise)

- **Status:** new GoCardless Bank Account Data signups remain **closed** as of 2026-05.
- Landing page `https://bankaccountdata.gocardless.com/new-signups-disabled` still active. No public re-opening date.
- Existing accounts continue working normally.
- **This is a blocking question for the design.** If we don't already have credentials, no further work on this spike or the categorisation/PWA layers should happen until we pick an alternative.

Sources:
- [GoCardless new-signups-disabled page](https://bankaccountdata.gocardless.com/new-signups-disabled)
- [Firefly III #10753 (Enable Banking tracking)](https://github.com/firefly-iii/firefly-iii/issues/10753)
- [Actual Budget #5505 (Enable Banking adoption)](https://github.com/actualbudget/actual/issues/5505)

## 9. Alternative if no GoCardless account — Enable Banking

| Concern | GoCardless BAD | **Enable Banking** | Tink / Plaid EU |
|---|---|---|---|
| New signups open? | Closed since Jul 2025 | **Yes** | Yes |
| Free for personal use? | Yes (legacy only) | **Yes** | No (enterprise pricing) |
| Session validity | 90 days | **180 days** | Varies |
| Hosted bank-select UI | Yes (`link` redirect) | **No — app builds its own** | Yes |
| Revolut Bank UAB coverage | Yes | **Yes** | Yes |
| ABN AMRO coverage | Yes | **Yes** | Yes |
| Adoption in FOSS | Firefly III Data Importer (existing) | Firefly III adapter PR in flight (#10753), Actual Budget exploring (#5505) | None |

**Verdict on the alternative:** if we don't have GoCardless credentials, **Enable Banking** is the only realistic free-for-personal option. The trade-off is meaningful: we'd have to build a small bank-selection UI in the BFF (Enable Banking provides only the auth redirect, not the bank picker), and the Firefly III adapter is not yet GA — so we might end up calling Enable Banking directly from the BFF instead of through Firefly's Data Importer. That's a real change to the v1 design.

## Known unknowns (the script answers most of these)

Only resolvable by hitting the live API with real credentials. Captured here for the next step.

1. Exact NL-listed institution ID slug(s) for Revolut Bank UAB. Does NL list include the UAB Lithuanian entity, the NL branch, or both?
2. Per-institution `transaction_total_days` and `max_access_valid_for_days` for the specific Revolut and ABN AMRO IDs.
3. Actual fill rates of `creditorName`, `remittanceInformationUnstructured`, and `proprietaryBankTransactionCode` on a real Revolut NL + ABN AMRO sample (`N ≥ 100`).
4. Whether `currencyExchange` is returned at the GoCardless API layer for Revolut FX transactions (the Firefly bug confirms the importer drops it, but doesn't prove API absence).
5. Whether the current requisition object exposes any derived expiry field beyond what's documented.
6. Whether a GoCardless account opened just before the July 2025 closure (if one exists) still gets full API access today.

## Next action

If the user has GoCardless credentials:

```bash
cd auth-workspace/apps/finance-tracker/docs/spikes
SECRET_ID=...  SECRET_KEY=...  ./check-gocardless-coverage.sh > coverage-output-$(date +%F).txt
```

That resolves unknowns 1 and 2 immediately. To resolve unknowns 3–5 we'd then build a real requisition (browser consent flow) and pull a sample week of transactions. That's spike 1b — separate work.

If the user does **not** have credentials: do not run the script. Pivot the design to Enable Banking (or accept the cost of a paid provider). Revisit §9 before going further.
