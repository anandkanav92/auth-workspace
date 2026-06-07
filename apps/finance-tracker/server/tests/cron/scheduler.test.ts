import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { startCron, CRON_JOBS, CRON_TIMEZONE, type CronJob } from '../../src/cron/index';
import type { ScheduledTask } from 'node-cron';

describe('CRON_JOBS registry', () => {
  it('registers all five jobs with valid cron expressions', () => {
    const names = CRON_JOBS.map((j) => j.name).sort();
    expect(names).toEqual([
      'pruneSnapshots',
      'refreshFx',
      'refreshPrices',
      'refreshProfiles',
      'snapshotHoldings',
    ]);
  });

  it('schedules each job in Europe/Amsterdam', () => {
    expect(CRON_TIMEZONE).toBe('Europe/Amsterdam');
  });

  it('uses the documented schedules', () => {
    const byName = Object.fromEntries(CRON_JOBS.map((j) => [j.name, j.schedule]));
    expect(byName.refreshPrices).toBe('0 7-22 * * 1-5'); // hourly Mon–Fri 07:00–22:00
    expect(byName.refreshFx).toBe('30 16 * * *'); // daily 16:30
    expect(byName.snapshotHoldings).toBe('0 2 * * *'); // nightly 02:00
    expect(byName.refreshProfiles).toBe('0 2 * * 0'); // weekly Sun 02:00
    expect(byName.pruneSnapshots).toBe('0 3 * * 0'); // weekly Sun 03:00
  });
});

describe('startCron scheduler wiring (fake timers)', () => {
  let tasks: ScheduledTask[] = [];

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    for (const t of tasks) t.stop();
    tasks = [];
    vi.useRealTimers();
  });

  it('invokes refreshPrices at 09:00 on a Monday (Amsterdam)', async () => {
    // 2026-06-08 is a Monday. 09:00 Amsterdam (CEST, UTC+2) = 07:00 UTC.
    // Start just before the top of the hour so the next match is 09:00 local.
    vi.setSystemTime(new Date('2026-06-08T06:59:30Z'));

    const run = vi.fn(async () => undefined);
    const job: CronJob = { name: 'refreshPrices', schedule: '0 7-22 * * 1-5', run };
    tasks = startCron([job]);

    expect(run).not.toHaveBeenCalled(); // not yet — it's 08:59 local

    // Advance across 09:00 Amsterdam. node-cron's heartbeat fires, matches the
    // 0-th minute of hour 9, and runs the wrapped job (async → flush microtasks).
    await vi.advanceTimersByTimeAsync(60_000);

    expect(run).toHaveBeenCalledTimes(1);
  });

  it('does NOT invoke refreshPrices on a Sunday (Mon–Fri only)', async () => {
    // 2026-06-07 is a Sunday. Crossing 09:00 must NOT fire the weekday job.
    vi.setSystemTime(new Date('2026-06-07T06:59:30Z'));

    const run = vi.fn(async () => undefined);
    const job: CronJob = { name: 'refreshPrices', schedule: '0 7-22 * * 1-5', run };
    tasks = startCron([job]);

    await vi.advanceTimersByTimeAsync(60_000);

    expect(run).not.toHaveBeenCalled();
  });

  it('a job that throws is caught and never crashes the scheduler', async () => {
    vi.setSystemTime(new Date('2026-06-08T06:59:30Z'));

    const run = vi.fn(async () => {
      throw new Error('job boom');
    });
    const job: CronJob = { name: 'refreshPrices', schedule: '0 7-22 * * 1-5', run };
    tasks = startCron([job]);

    // Must not reject — safeRun swallows the error. If it didn't, the rejected
    // job promise would surface here and fail the test.
    await vi.advanceTimersByTimeAsync(60_000);
    expect(run).toHaveBeenCalledTimes(1);
  });
});
