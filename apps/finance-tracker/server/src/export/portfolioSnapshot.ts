// Portfolio snapshot exporter (Investment Research Lab contract, schemaVersion 1).
//
// PRODUCER side of a read-only, versioned JSON contract: the sibling
// `investment_research_lab` project consumes the file this produces and never
// touches this app's DB. See that repo's
// docs/plans/2026-06-10-investment-research-lab-design.md (§ data contract).
//
// This module is PURE: `buildSnapshot` takes already-fetched holdings + market
// data and returns the contract object. The CLI/route do the fetching (reusing
// the existing repos), so there is no duplicate price/FX *fetching* here.
//
// FX: ECB rates are EUR-base (rates['USD'] = 1.085 means 1 EUR = 1.085 USD), so a
// value V in currency C converts to EUR by V / rates[C]. This mirrors
// cron/snapshotHoldings.ts `toEur` (the established server precedent) rather than
// re-deriving it. GBX/GBp are pence (1/100 GBP); prices are normalised to GBP at
// ingest (providers/yahoo.ts), but we handle pence defensively. An UNKNOWN
// currency yields 0 (we cannot value it) — matching snapshotHoldings, not the web
// join's permissive default — so a snapshot never reports a fabricated value.

import type { Holding, PriceCache, SymbolProfile } from '../db/schemas';
import { normalizeCurrencyCode } from '../providers/currency';

// --- contract types (schemaVersion 1) ---------------------------------------

export type ContractAssetType = 'stock' | 'etf' | 'bond' | 'cash' | 'other';

export interface SnapshotHolding {
  ticker: string;
  name: string;
  assetType: ContractAssetType;
  quantity: number;
  valueEur: number;
  costEur: number | null;
  weight: number;
  currency: string;
  sector: string;
  country: string;
}

export interface PortfolioSnapshot {
  schemaVersion: 1;
  asOf: string;
  baseCurrency: 'EUR';
  totals: {
    valueEur: number;
    costEur: number;
    unrealisedEur: number;
    unrealisedPct: number;
    positionsWithCost: number;
    positionsWithoutCost: number;
  };
  concentration: {
    topPositionPct: number;
    top5Pct: number;
    bySector: Record<string, number>;
    byCountry: Record<string, number>;
    byCurrency: Record<string, number>;
    byAssetType: Record<string, number>;
  };
  holdings: SnapshotHolding[];
}

export interface SnapshotInputs {
  holdings: Holding[];
  prices: PriceCache[];
  profiles: SymbolProfile[];
  /** EUR-base FX rates (e.g. { EUR: 1, USD: 1.085 }). */
  fxRates: Record<string, number>;
  /** Injectable clock for deterministic tests; defaults to now. */
  now?: Date;
}

// Contract conventions for ETFs (no per-holding look-through in v1 — the contract
// has no per-holding weighting map; revisit as v2).
const ETF_SECTOR = 'Uncategorised';
const ETF_COUNTRY = 'Multiple/Diversified';
const UNCATEGORISED = 'Uncategorised';

const round = (n: number, dp: number): number => {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
};

/** True when `currency` can be converted to EUR with the given rates. */
function isConvertible(currency: string, rates: Record<string, number>): boolean {
  if (!currency || currency === 'EUR') return true;
  if (currency === 'GBX' || currency === 'GBp') return typeof rates['GBP'] === 'number';
  return typeof rates[currency] === 'number';
}

/**
 * Currencies used by these holdings (price + cost) that have NO usable rate.
 * `priceCurrency` falls back to cost_currency then EUR — mirroring the join — so
 * an unpriced non-EUR holding still requires its rate (its value is 0 either way,
 * but its presence signals an FX-data gap worth failing on).
 */
function missingFxCurrencies(
  open: Holding[],
  priceByTicker: Map<string, PriceCache>,
  rates: Record<string, number>,
): string[] {
  const needed = new Set<string>();
  for (const h of open) {
    needed.add(priceByTicker.get(h.ticker)?.currency ?? h.cost_currency ?? 'EUR');
    if (hasCostBasis(h)) needed.add(h.cost_currency as string);
  }
  return [...needed].filter((c) => !isConvertible(c, rates)).sort();
}

/** EUR multiplier for one unit of `currency`, EUR-base rates. 0 if unconvertible. */
function fxToEur(currency: string, rates: Record<string, number>): number {
  if (!currency || currency === 'EUR') return 1;
  if (currency === 'GBX' || currency === 'GBp') {
    const gbp = rates['GBP'];
    return gbp ? 1 / (100 * gbp) : 0;
  }
  const rate = rates[currency];
  return rate ? 1 / rate : 0;
}

/** Map this app's profile asset_type onto the contract enum. */
function toContractAssetType(raw: string | undefined): ContractAssetType {
  if (raw === 'stock' || raw === 'etf') return raw;
  return 'other';
}

/** True only when a usable cost basis exists (PB coerces null→0, so the currency
 *  flag is the authoritative test — mirrors web hasCostBasis). */
function hasCostBasis(h: Holding): boolean {
  return typeof h.cost_currency === 'string' && h.cost_currency.trim().length > 0;
}

interface Joined {
  holding: SnapshotHolding;
  hasCost: boolean;
  /** EUR value of cost-bearing positions only, for unrealised math. */
  costBearingValueEur: number;
}

/**
 * Assemble the portfolio snapshot. Pure; throws on inputs that can't yield a
 * valid contract object (no open holdings, or zero total value) so the caller
 * fails loudly rather than writing a snapshot the consumer would reject.
 */
export function buildSnapshot(inputs: SnapshotInputs): PortfolioSnapshot {
  const { holdings, prices, profiles, fxRates } = inputs;
  const asOf = (inputs.now ?? new Date()).toISOString();

  const priceByTicker = new Map(prices.map((p) => [p.ticker, p]));
  const profileByTicker = new Map(profiles.map((p) => [p.ticker, p]));

  // Closed positions (quantity 0) are excluded entirely.
  const open = holdings.filter((h) => h.quantity !== 0);
  if (open.length === 0) {
    throw new Error('snapshot: user has no open holdings (quantity > 0)');
  }

  // FX-coverage guard. Refuse to emit if any currency a holding ACTUALLY USES
  // lacks a rate: otherwise that position would silently convert at a 0
  // multiplier (see fxToEur), producing a schema-valid but materially understated
  // snapshot — exactly the "bad evidence" the consumer must never ingest. This is
  // stronger than checking "FX row exists": it also catches a present-but-
  // incomplete row (e.g. rates lacks USD). An all-EUR portfolio needs no rates and
  // passes with an empty map.
  const missing = missingFxCurrencies(open, priceByTicker, fxRates);
  if (missing.length > 0) {
    throw new Error(
      `snapshot: missing FX rate(s) for ${missing.join(', ')} — refusing to emit a distorted snapshot`,
    );
  }

  const joined: Joined[] = open.map((h) => {
    const quote = priceByTicker.get(h.ticker);
    const profile = profileByTicker.get(h.ticker);

    const price = quote?.price ?? 0;
    const priceCurrency = quote?.currency ?? h.cost_currency ?? 'EUR';
    const valueEur = round(h.quantity * price * fxToEur(priceCurrency, fxRates), 2);

    const hasCost = hasCostBasis(h);
    const costEur = hasCost
      ? round((h.cost_basis ?? 0) * fxToEur(h.cost_currency as string, fxRates), 2)
      : null;

    const assetType = toContractAssetType(profile?.asset_type);
    const sector =
      assetType === 'etf' ? ETF_SECTOR : profile?.sector?.trim() || UNCATEGORISED;
    const country =
      assetType === 'etf'
        ? ETF_COUNTRY
        : profile?.country?.trim() || UNCATEGORISED;

    return {
      hasCost,
      costBearingValueEur: hasCost ? valueEur : 0,
      holding: {
        ticker: h.ticker,
        name: profile?.name?.trim() || h.ticker,
        assetType,
        quantity: h.quantity,
        valueEur,
        costEur,
        weight: 0, // filled once the total is known
        // Native trading currency (GBp/GBX normalised to GBP) — drives byCurrency.
        // priceCurrency is always a string (EUR fallback), so the ?? is just to
        // satisfy normalizeCurrencyCode's `string | undefined` return type.
        currency: normalizeCurrencyCode(priceCurrency) ?? priceCurrency,
        sector,
        country,
      },
    };
  });

  const totalValueEur = round(
    joined.reduce((s, j) => s + j.holding.valueEur, 0),
    2,
  );
  if (totalValueEur <= 0) {
    throw new Error(
      'snapshot: total portfolio value is 0 (no priced holdings) — refusing to emit',
    );
  }

  // Weights = each (2dp) valueEur / total, rounded to 6dp so the consumer's
  // "weights sum ~= 1 (+/-0.001)" invariant holds comfortably.
  for (const j of joined) {
    j.holding.weight = round(j.holding.valueEur / totalValueEur, 6);
  }

  // Totals: cost + unrealised cover COST-BEARING positions only (null-cost
  // positions contribute value but no cost — same rule as the dashboard).
  const costBearing = joined.filter((j) => j.hasCost);
  const costEur = round(
    costBearing.reduce((s, j) => s + (j.holding.costEur ?? 0), 0),
    2,
  );
  const unrealisedEur = round(
    costBearing.reduce((s, j) => s + (j.holding.valueEur - (j.holding.costEur ?? 0)), 0),
    2,
  );
  const unrealisedPct = costEur > 0 ? round(unrealisedEur / costEur, 6) : 0;

  const holdingsOut = joined.map((j) => j.holding);

  return {
    schemaVersion: 1,
    asOf,
    baseCurrency: 'EUR',
    totals: {
      valueEur: totalValueEur,
      costEur,
      unrealisedEur,
      unrealisedPct,
      positionsWithCost: costBearing.length,
      positionsWithoutCost: joined.length - costBearing.length,
    },
    concentration: {
      topPositionPct: topPositionPct(holdingsOut),
      top5Pct: topNPct(holdingsOut, 5),
      bySector: weightByKey(holdingsOut, (h) => h.sector),
      byCountry: weightByKey(holdingsOut, (h) => h.country),
      byCurrency: weightByKey(holdingsOut, (h) => h.currency),
      byAssetType: weightByKey(holdingsOut, (h) => h.assetType),
    },
    holdings: holdingsOut,
  };
}

/** Largest single-position weight (0 when empty). */
function topPositionPct(holdings: SnapshotHolding[]): number {
  return round(Math.max(0, ...holdings.map((h) => h.weight)), 6);
}

/** Sum of the N largest position weights. */
function topNPct(holdings: SnapshotHolding[], n: number): number {
  const sum = [...holdings]
    .sort((a, b) => b.weight - a.weight)
    .slice(0, n)
    .reduce((s, h) => s + h.weight, 0);
  return round(sum, 6);
}

/** Sum of holding weights grouped by a key (sector/country/currency/assetType). */
function weightByKey(
  holdings: SnapshotHolding[],
  keyFn: (h: SnapshotHolding) => string,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const h of holdings) {
    const k = keyFn(h);
    out[k] = (out[k] ?? 0) + h.weight;
  }
  for (const k of Object.keys(out)) out[k] = round(out[k], 6);
  return out;
}
