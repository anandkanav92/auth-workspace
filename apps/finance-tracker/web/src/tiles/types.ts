/**
 * Shared types for the Phase 1 analytics tiles (M11).
 *
 * The frontend reads four data sources from the BFF — per-user `holdings` +
 * `accounts`, plus shared `price_cache`, `symbol_profiles`, and `fx_rates` —
 * and joins them into a single typed {@link Portfolio} object. The tiles render
 * purely off that object, so all currency conversion, ETF look-through, and
 * null-cost handling lives in the join (see `usePortfolioData.ts`), not in each
 * tile.
 *
 * Money convention: everything the tiles consume is already converted to EUR.
 * Raw provider prices arrive in their listing currency; the join multiplies by
 * the EUR-base FX rate (`fxToEur`) so tiles never touch FX again.
 */

/** A broker/wallet account, as returned by `GET /api/accounts`. */
export interface Account {
  id: string;
  source: "revolut" | "trading212" | "manual";
  label: string;
  currency?: string;
}

/** A current position, as returned by `GET /api/holdings`. */
export interface Holding {
  id: string;
  account: string;
  ticker: string;
  isin?: string;
  quantity: number;
  /**
   * Total cost (NOT per-share) in `cost_currency`. Nullable — Revolut PDFs
   * carry no cost basis (spike 2).
   *
   * CRITICAL: PocketBase coerces null → 0 on read, so `cost_basis === 0` does
   * NOT reliably mean "no cost". The authoritative "no cost" marker is an empty
   * `cost_currency`. See {@link hasCost}.
   */
  cost_basis?: number | null;
  cost_currency?: string | null;
  source: "revolut" | "trading212" | "manual";
}

/** A cached spot price, as returned by the BFF's shared `price_cache` read. */
export interface PriceQuote {
  ticker: string;
  price: number;
  currency: string;
}

/** A symbol profile (sector/country/ratios + ETF look-through weightings). */
export interface SymbolProfile {
  ticker: string;
  name?: string;
  asset_type: "stock" | "etf" | "other";
  sector?: string;
  country?: string;
  market_cap?: number;
  pe_ratio?: number;
  beta?: number;
  dividend_yield?: number;
  /** ETFs only: sector → weight (0..1). Drives Allocation look-through. */
  sector_weightings?: Record<string, number> | null;
}

/**
 * EUR-base FX rates: `rates[CCY]` is how many units of CCY equal 1 EUR
 * (so EUR→value conversion divides, value→EUR multiplies by 1/rate). EUR is 1.
 */
export interface FxRates {
  rates: Record<string, number>;
}

/** The raw, un-joined inputs the portfolio builder consumes. */
export interface PortfolioInputs {
  accounts: Account[];
  holdings: Holding[];
  prices: PriceQuote[];
  profiles: SymbolProfile[];
  fx: FxRates;
}

/**
 * A holding joined with its price, profile, and FX — the unit every tile reads.
 * All monetary fields are EUR. `costEur`/`returnPct` are present ONLY when the
 * position has a real cost basis (see {@link Position.hasCost}).
 */
export interface Position {
  id: string;
  account: string;
  ticker: string;
  name: string;
  assetType: "stock" | "etf" | "other";
  quantity: number;
  /** Listing-currency spot price (0 if no cached price). */
  price: number;
  priceCurrency: string;
  /** Current market value in EUR (qty × price × fxToEur). */
  valueEur: number;
  /** True when this position has a usable cost basis (non-empty cost_currency). */
  hasCost: boolean;
  /** Total cost in EUR — only when `hasCost`; otherwise null. */
  costEur: number | null;
  /** Unrealised P&L in EUR (valueEur − costEur) — only when `hasCost`. */
  returnEur: number | null;
  /** Unrealised return as a fraction (returnEur / costEur) — only when `hasCost`. */
  returnPct: number | null;
  sector?: string;
  country?: string;
  sectorWeightings?: Record<string, number> | null;
  pe?: number;
  beta?: number;
  dividendYield?: number;
}

/**
 * The fully-joined portfolio every tile renders from. Return aggregates
 * (`totalCostEur`, `totalReturnEur`, `totalReturnPct`) cover ONLY the
 * cost-bearing subset; `costlessCount` is the number of positions excluded.
 */
export interface Portfolio {
  positions: Position[];
  accounts: Account[];
  /** Total market value across all positions, EUR. */
  totalValueEur: number;
  /** Total cost across the cost-bearing subset only, EUR. */
  totalCostEur: number;
  /** Total unrealised P&L across the cost-bearing subset only, EUR. */
  totalReturnEur: number;
  /** Return over the cost-bearing subset (totalReturnEur / totalCostEur), or null. */
  totalReturnPct: number | null;
  /** Count of positions excluded from return because they lack a cost basis. */
  costlessCount: number;
  /** Count of positions with no cached spot price (valued at €0 until priced). */
  unpricedCount: number;
}

/**
 * The single prop contract every tile implements. `accountIds` scopes the
 * portfolio: `'all'` (global dashboard) or an explicit account-id list
 * (per-account dashboard at `/account/:id`).
 */
export interface TileProps {
  accountIds: "all" | string[];
}
