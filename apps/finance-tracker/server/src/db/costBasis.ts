// Cost-basis math for manual holdings. Pure functions, no I/O — unit-tested in
// isolation (tests/db/costBasis.test.ts) so the route handlers can stay thin.
//
// METHODOLOGY: weighted-average cost (design §Conventions, plan M5). cost_basis
// is stored as a TOTAL (the whole position's cost), not a per-share figure.
//   - ADD:    new_total = old_total + added_cost;          qty summed.
//   - SELL:   cost removed is PROPORTIONAL to the sold fraction of quantity:
//             removed = old_total * (sold_qty / old_qty); new_total = old - removed.
//   - ADJUST: when only quantity changes, the per-share cost is preserved, so
//             cost_basis scales by new_qty/old_qty. An explicit cost_basis in the
//             patch overrides this.
//
// cost_basis / cost_currency are NULLABLE (Revolut PDF has no cost basis). When
// the existing or added cost is unknown we keep the result null rather than
// inventing a number — analytics already treat null cost as "unknown".

/** Result of folding a buy into an existing (or absent) holding. */
export interface MergedCost {
  quantity: number;
  cost_basis: number | null;
  cost_currency: string | null;
}

/**
 * Weighted-average add. `addedCost` is the TOTAL cost of the added quantity
 * (e.g. 10 shares for 1500 → addedCost 1500). When either side's cost is
 * unknown the merged cost_basis is null.
 */
export function mergeBuy(
  existing: { quantity: number; cost_basis?: number | null; cost_currency?: string | null } | null,
  add: { quantity: number; cost_basis?: number | null; cost_currency?: string | null },
): MergedCost {
  if (!existing) {
    return {
      quantity: add.quantity,
      cost_basis: add.cost_basis ?? null,
      cost_currency: add.cost_currency ?? null,
    };
  }
  const quantity = existing.quantity + add.quantity;

  // If either contribution lacks a known cost we cannot form a meaningful
  // weighted total, so the result is unknown (null).
  const existingCost = existing.cost_basis;
  const addedCost = add.cost_basis;
  if (existingCost == null || addedCost == null) {
    return {
      quantity,
      cost_basis: null,
      cost_currency: add.cost_currency ?? existing.cost_currency ?? null,
    };
  }
  return {
    quantity,
    cost_basis: existingCost + addedCost,
    cost_currency: existing.cost_currency ?? add.cost_currency ?? null,
  };
}

/**
 * Proportional sell. Returns the remaining quantity and cost_basis after
 * selling `soldQty` of `holding`. cost_basis is reduced by the sold fraction.
 * A sale of the entire position leaves quantity 0 (our "closed" marker).
 */
export function applySell(
  holding: { quantity: number; cost_basis?: number | null },
  soldQty: number,
): { quantity: number; cost_basis: number | null } {
  const remainingQty = holding.quantity - soldQty;
  if (holding.cost_basis == null || holding.quantity === 0) {
    return { quantity: remainingQty, cost_basis: holding.cost_basis ?? null };
  }
  const fractionKept = remainingQty / holding.quantity;
  // Guard against tiny negative noise when the whole position is sold.
  const newCost = remainingQty <= 0 ? 0 : holding.cost_basis * fractionKept;
  return { quantity: remainingQty, cost_basis: newCost };
}

/**
 * Adjustment. When only quantity changes, scale cost_basis to preserve the
 * per-share cost. An explicit `cost_basis` in the patch overrides scaling.
 */
export function applyAdjustment(
  holding: { quantity: number; cost_basis?: number | null },
  patch: { quantity?: number; cost_basis?: number | null },
): { quantity: number; cost_basis: number | null } {
  const newQty = patch.quantity ?? holding.quantity;

  // Explicit cost wins.
  if (patch.cost_basis !== undefined) {
    return { quantity: newQty, cost_basis: patch.cost_basis };
  }
  // Quantity unchanged, or cost unknown → leave cost as-is.
  if (
    patch.quantity === undefined ||
    holding.cost_basis == null ||
    holding.quantity === 0
  ) {
    return { quantity: newQty, cost_basis: holding.cost_basis ?? null };
  }
  // Scale cost to preserve per-share basis.
  const scaled = holding.cost_basis * (newQty / holding.quantity);
  return { quantity: newQty, cost_basis: scaled };
}
