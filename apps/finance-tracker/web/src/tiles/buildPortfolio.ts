/**
 * Pure portfolio join + aggregation (M11.1).
 *
 * Kept free of React / TanStack Query so the money math is unit-testable with
 * plain fixtures (the tests never hit a real BFF). `usePortfolioData` is a thin
 * wrapper that fetches the five inputs and feeds them here.
 *
 * KEY DECISIONS
 * - **Null cost basis (spike 2):** Revolut positions arrive with no cost. Because
 *   PocketBase coerces `null → 0` on read, `cost_basis === 0` is NOT a reliable
 *   "no cost" signal. The authoritative marker is an EMPTY `cost_currency`
 *   (see {@link hasCostBasis}). Portfolio return aggregates exclude these, and
 *   `costlessCount` reports how many were excluded (drives the Summary footnote).
 * - **FX:** `fx.rates[CCY]` is units-of-CCY per 1 EUR (ECB EUR-base). Converting a
 *   value FROM a currency TO EUR therefore divides by that rate; we precompute
 *   `1/rate` as `fxToEur`. EUR (and any unknown currency, defensively) is 1.
 */

import type {
  FxRates,
  Holding,
  Portfolio,
  PortfolioInputs,
  Position,
  PriceQuote,
  SymbolProfile,
} from "./types";

/**
 * The authoritative "has a usable cost basis" test. An empty/missing
 * `cost_currency` means the broker gave us no cost (Revolut), regardless of
 * what `cost_basis` reads as (PocketBase may report 0 for a true null).
 */
export function hasCostBasis(holding: Holding): boolean {
  return (
    typeof holding.cost_currency === "string" &&
    holding.cost_currency.trim().length > 0
  );
}

/** Multiplier converting one unit of `currency` into EUR. Defaults to 1. */
function fxToEur(currency: string, fx: FxRates): number {
  if (!currency || currency === "EUR") return 1;
  // Defensive pence handling: the server normalises GBp/GBX → GBP before it ever
  // reaches us, but if a pence-quoted price slips through, treat it as GBP ÷ 100
  // (1 pence = 0.01 GBP) so it isn't valued 100× too high under a rate-1 default.
  if (currency === "GBX" || currency === "GBp") {
    const gbp = fx.rates["GBP"];
    return gbp && gbp > 0 ? 1 / (100 * gbp) : 1;
  }
  const rate = fx.rates[currency];
  if (!rate || rate <= 0) return 1; // defensive: unknown currency → treat as EUR
  return 1 / rate;
}

/**
 * Join a single holding with its price + profile + FX into a {@link Position}.
 * Return fields are populated only when the holding has a real cost basis.
 */
function toPosition(
  holding: Holding,
  priceByTicker: Map<string, PriceQuote>,
  profileByTicker: Map<string, SymbolProfile>,
  fx: FxRates,
): Position {
  const quote = priceByTicker.get(holding.ticker);
  const profile = profileByTicker.get(holding.ticker);

  const price = quote?.price ?? 0;
  const priceCurrency = quote?.currency ?? holding.cost_currency ?? "EUR";
  const valueEur = holding.quantity * price * fxToEur(priceCurrency, fx);

  const withCost = hasCostBasis(holding);
  let costEur: number | null = null;
  let returnEur: number | null = null;
  let returnPct: number | null = null;
  if (withCost) {
    // cost_basis is a TOTAL (not per-share); convert from cost_currency to EUR.
    costEur = (holding.cost_basis ?? 0) * fxToEur(holding.cost_currency!, fx);
    returnEur = valueEur - costEur;
    returnPct = costEur > 0 ? returnEur / costEur : null;
  }

  return {
    id: holding.id,
    account: holding.account,
    ticker: holding.ticker,
    name: profile?.name ?? holding.ticker,
    assetType: profile?.asset_type ?? "other",
    quantity: holding.quantity,
    price,
    priceCurrency,
    valueEur,
    hasCost: withCost,
    costEur,
    returnEur,
    returnPct,
    sector: profile?.sector,
    country: profile?.country,
    sectorWeightings: profile?.sector_weightings ?? null,
    pe: profile?.pe_ratio,
    beta: profile?.beta,
    dividendYield: profile?.dividend_yield,
  };
}

/**
 * Build the joined, aggregated {@link Portfolio} from raw inputs.
 *
 * @param accountIds Scope filter: `'all'` or an explicit account-id list. The
 *   hook applies the same scope to its query key so cache entries don't collide.
 */
export function buildPortfolio(
  inputs: PortfolioInputs,
  accountIds: "all" | string[] = "all",
): Portfolio {
  const { holdings, prices, profiles, fx, accounts } = inputs;

  const priceByTicker = new Map(prices.map((p) => [p.ticker, p]));
  const profileByTicker = new Map(profiles.map((p) => [p.ticker, p]));

  const scoped =
    accountIds === "all"
      ? holdings
      : holdings.filter((h) => accountIds.includes(h.account));

  const positions = scoped.map((h) =>
    toPosition(h, priceByTicker, profileByTicker, fx),
  );

  let totalValueEur = 0;
  let totalCostEur = 0;
  let totalReturnEur = 0;
  let costlessCount = 0;
  let unpricedCount = 0;

  for (const p of positions) {
    totalValueEur += p.valueEur;
    // A position with no cached spot price (price ≤ 0) values to €0 and would
    // silently drag every total/allocation down. Count them so the dashboard can
    // tell the user prices are still loading rather than showing a wrong €0.
    if (!(p.price > 0)) unpricedCount += 1;
    if (p.hasCost && p.costEur !== null) {
      totalCostEur += p.costEur;
      totalReturnEur += p.returnEur ?? 0;
    } else {
      costlessCount += 1;
    }
  }

  const totalReturnPct = totalCostEur > 0 ? totalReturnEur / totalCostEur : null;

  return {
    positions,
    accounts:
      accountIds === "all"
        ? accounts
        : accounts.filter((a) => accountIds.includes(a.id)),
    totalValueEur,
    totalCostEur,
    totalReturnEur,
    totalReturnPct,
    costlessCount,
    unpricedCount,
  };
}
