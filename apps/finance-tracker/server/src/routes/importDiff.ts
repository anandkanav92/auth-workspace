// Statement-vs-holdings diff (Task 6.4). Import semantics are SNAPSHOT-REPLACE:
// the committed statement becomes the account's complete set of holdings. The
// diff is therefore computed per ticker as a full reconciliation:
//   - new:       in the statement, not currently held
//   - changed:   held + in the statement, quantity or cost differs
//   - unchanged: held + in the statement, identical quantity + cost
//   - removed:   currently held, absent from the statement (will be dropped)
//
// `isNewTicker` flags tickers with no symbol_profiles row yet — those need a
// synchronous profile+price fetch in the upload route so the preview can show
// names/prices.

import type { ParsedPosition } from '../importers/types';
import type { Holding } from '../db/schemas';
import type { DiffEntry } from './importPreview';

// Float quantities/costs from PDFs never compare exactly; treat sub-cent /
// sub-micro-share differences as equal.
const QTY_EPS = 1e-6;
const COST_EPS = 1e-2;

function nearlyEqual(a: number, b: number, eps: number): boolean {
  return Math.abs(a - b) <= eps;
}

/**
 * Reconcile parsed statement positions against the account's current holdings.
 *
 * @param positions    parsed statement positions (the desired end state).
 * @param current      the account's current holdings.
 * @param knownTickers set of tickers that already have a symbol_profiles row.
 */
export function computeDiff(
  positions: ParsedPosition[],
  current: Holding[],
  knownTickers: Set<string>,
): DiffEntry[] {
  const currentByTicker = new Map(current.map((h) => [h.ticker, h]));
  const entries: DiffEntry[] = [];
  const seen = new Set<string>();

  for (const pos of positions) {
    seen.add(pos.ticker);
    const held = currentByTicker.get(pos.ticker);
    const newCost = pos.cost_basis;
    const curQty = held?.quantity ?? 0;
    const curCost = held?.cost_basis ?? undefined;

    let status: DiffEntry['status'];
    if (!held) {
      status = 'new';
    } else if (
      nearlyEqual(curQty, pos.quantity, QTY_EPS) &&
      bothUndefinedOrEqual(curCost ?? undefined, newCost, COST_EPS)
    ) {
      status = 'unchanged';
    } else {
      status = 'changed';
    }

    entries.push({
      ticker: pos.ticker,
      isin: pos.isin,
      status,
      currentQuantity: curQty,
      newQuantity: pos.quantity,
      costBasis: newCost,
      costCurrency: pos.cost_currency,
      isNewTicker: !knownTickers.has(pos.ticker),
    });
  }

  // Holdings the statement dropped → removed (snapshot-replace deletes them).
  for (const held of current) {
    if (seen.has(held.ticker)) continue;
    entries.push({
      ticker: held.ticker,
      isin: held.isin ?? '',
      status: 'removed',
      currentQuantity: held.quantity,
      newQuantity: 0,
      costBasis: held.cost_basis ?? undefined,
      costCurrency: held.cost_currency ?? undefined,
      isNewTicker: !knownTickers.has(held.ticker),
    });
  }

  return entries;
}

/** Equal when both undefined, or both defined and within eps. */
function bothUndefinedOrEqual(
  a: number | undefined,
  b: number | undefined,
  eps: number,
): boolean {
  if (a === undefined && b === undefined) return true;
  if (a === undefined || b === undefined) return false;
  return nearlyEqual(a, b, eps);
}

/** Summary counts for the preview response. */
export function summariseDiff(diff: DiffEntry[]): {
  total: number;
  new: number;
  changed: number;
  unchanged: number;
  removed: number;
  newTickers: number;
} {
  const summary = {
    total: diff.length,
    new: 0,
    changed: 0,
    unchanged: 0,
    removed: 0,
    newTickers: 0,
  };
  for (const e of diff) {
    summary[e.status] += 1;
    if (e.isNewTicker) summary.newTickers += 1;
  }
  return summary;
}
