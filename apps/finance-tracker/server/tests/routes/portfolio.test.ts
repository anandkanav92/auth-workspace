import { describe, it, expect } from 'vitest';
import { groupSnapshotsByDate } from '../../src/routes/portfolio';
import type { HoldingsSnapshot } from '../../src/db/schemas';

function snap(date: string, eur_value: number): HoldingsSnapshot {
  return {
    id: Math.random().toString(36).slice(2),
    created: '',
    updated: '',
    user: 'u',
    account: 'a',
    ticker: 'T',
    quantity: 1,
    eur_value,
    date,
  } as HoldingsSnapshot;
}

describe('groupSnapshotsByDate', () => {
  it('sums per-holding rows into one total per day, sorted ascending', () => {
    const series = groupSnapshotsByDate([
      snap('2026-06-05 00:00:00.000Z', 100),
      snap('2026-06-05 00:00:00.000Z', 50),
      snap('2026-06-06 00:00:00.000Z', 200),
      snap('2026-06-04 00:00:00.000Z', 10),
    ]);
    expect(series).toEqual([
      { date: '2026-06-04', valueEur: 10 },
      { date: '2026-06-05', valueEur: 150 },
      { date: '2026-06-06', valueEur: 200 },
    ]);
  });

  it('ignores rows with no date and tolerates missing values', () => {
    const series = groupSnapshotsByDate([
      snap('', 999),
      { ...snap('2026-06-06 00:00:00.000Z', 0), eur_value: undefined as unknown as number },
      snap('2026-06-06 00:00:00.000Z', 5),
    ]);
    expect(series).toEqual([{ date: '2026-06-06', valueEur: 5 }]);
  });

  it('returns an empty series for no rows', () => {
    expect(groupSnapshotsByDate([])).toEqual([]);
  });
});
