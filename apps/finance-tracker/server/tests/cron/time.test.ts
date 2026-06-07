import { describe, it, expect } from 'vitest';
import {
  amsterdamDate,
  amsterdamDateDaysAgo,
  isoDaysAgo,
  isSunday,
} from '../../src/cron/time';

describe('amsterdamDate', () => {
  it('formats as YYYY-MM-DD in Europe/Amsterdam', () => {
    // 12:00 UTC, summer (CEST = UTC+2) → same calendar day.
    expect(amsterdamDate(new Date('2026-06-01T12:00:00Z'))).toBe('2026-06-01');
  });

  it('rolls a late-UTC instant into the next Amsterdam day', () => {
    // 23:30 UTC = 01:30 next day in Amsterdam.
    expect(amsterdamDate(new Date('2026-06-01T23:30:00Z'))).toBe('2026-06-02');
  });

  it('handles winter offset (CET = UTC+1)', () => {
    expect(amsterdamDate(new Date('2026-01-15T12:00:00Z'))).toBe('2026-01-15');
  });
});

describe('amsterdamDateDaysAgo', () => {
  it('subtracts whole days', () => {
    expect(amsterdamDateDaysAgo(90, new Date('2026-06-08T01:00:00Z'))).toBe('2026-03-10');
  });
});

describe('isoDaysAgo', () => {
  it('returns an ISO datetime N days earlier', () => {
    expect(isoDaysAgo(7, new Date('2026-06-08T00:00:00Z'))).toBe(
      new Date('2026-06-01T00:00:00Z').toISOString(),
    );
  });
});

describe('isSunday', () => {
  it('is true for a Sunday date string', () => {
    expect(isSunday('2026-03-01')).toBe(true); // Sunday
  });

  it('is false for a weekday date string', () => {
    expect(isSunday('2026-03-02')).toBe(false); // Monday
  });

  it('ignores a trailing time component', () => {
    expect(isSunday('2026-03-01 14:30:00')).toBe(true);
  });
});
