import { describe, it, expect } from 'vitest';
import { computeDiff, summariseDiff } from '../src/routes/importDiff';
import type { ParsedPosition } from '../src/importers/types';
import type { Holding } from '../src/db/schemas';

function holding(over: Partial<Holding> & { ticker: string }): Holding {
  return {
    id: `h-${over.ticker}`,
    created: '',
    updated: '',
    user: 'u1',
    account: 'a1',
    quantity: 1,
    source: 'trading212',
    ...over,
  } as Holding;
}

function pos(over: Partial<ParsedPosition> & { ticker: string; isin: string }): ParsedPosition {
  return { quantity: 1, ...over };
}

describe('computeDiff', () => {
  it('classifies new, changed, unchanged and removed holdings', () => {
    const positions: ParsedPosition[] = [
      pos({ ticker: 'NEW', isin: 'US0000000001', quantity: 5, cost_basis: 500, cost_currency: 'USD' }),
      pos({ ticker: 'CHG', isin: 'US0000000002', quantity: 10, cost_basis: 1100 }),
      pos({ ticker: 'SAME', isin: 'US0000000003', quantity: 3, cost_basis: 300 }),
    ];
    const current: Holding[] = [
      holding({ ticker: 'CHG', quantity: 8, cost_basis: 900 }), // qty differs → changed
      holding({ ticker: 'SAME', quantity: 3, cost_basis: 300 }), // identical → unchanged
      holding({ ticker: 'GONE', quantity: 2, cost_basis: 200 }), // not in stmt → removed
    ];
    const known = new Set(['CHG', 'SAME', 'GONE']); // NEW has no profile yet

    const diff = computeDiff(positions, current, known);
    const byTicker = Object.fromEntries(diff.map((d) => [d.ticker, d]));

    expect(byTicker.NEW.status).toBe('new');
    expect(byTicker.NEW.isNewTicker).toBe(true);
    expect(byTicker.NEW.currentQuantity).toBe(0);
    expect(byTicker.NEW.newQuantity).toBe(5);

    expect(byTicker.CHG.status).toBe('changed');
    expect(byTicker.SAME.status).toBe('unchanged');
    expect(byTicker.GONE.status).toBe('removed');
    expect(byTicker.GONE.newQuantity).toBe(0);
  });

  it('treats a Revolut position (no cost basis) vs same-qty held as unchanged', () => {
    const positions = [pos({ ticker: 'META', isin: 'US30303M1027', quantity: 2.5 })];
    const current = [holding({ ticker: 'META', quantity: 2.5, cost_basis: null })];
    const diff = computeDiff(positions, current, new Set(['META']));
    expect(diff[0].status).toBe('unchanged');
    expect(diff[0].costBasis).toBeUndefined();
  });

  it('tolerates sub-micro-share float noise as unchanged', () => {
    const positions = [pos({ ticker: 'X', isin: 'US0000000009', quantity: 1.000000001, cost_basis: 100 })];
    const current = [holding({ ticker: 'X', quantity: 1, cost_basis: 100 })];
    const diff = computeDiff(positions, current, new Set(['X']));
    expect(diff[0].status).toBe('unchanged');
  });

  it('summarises diff counts', () => {
    const diff = computeDiff(
      [
        pos({ ticker: 'A', isin: 'US0000000001', quantity: 1 }),
        pos({ ticker: 'B', isin: 'US0000000002', quantity: 2, cost_basis: 200 }),
      ],
      [holding({ ticker: 'B', quantity: 1, cost_basis: 100 }), holding({ ticker: 'C', quantity: 1 })],
      new Set(['B', 'C']),
    );
    const s = summariseDiff(diff);
    expect(s.total).toBe(3); // A(new) + B(changed) + C(removed)
    expect(s.new).toBe(1);
    expect(s.changed).toBe(1);
    expect(s.removed).toBe(1);
    expect(s.newTickers).toBe(1); // only A
  });
});
