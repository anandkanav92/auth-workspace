// node-cron scheduler wiring (M8.1). Registers all scheduled jobs on their
// schedules in Europe/Amsterdam, gated by CRON_ENABLED=true so tests and
// `pnpm dev` never auto-run real network jobs.
//
// All jobs are idempotent (keyed upserts / skip-existing), so a missed-then-
// caught-up tick or a process restart between ticks is safe. Each job already
// owns its per-item try/catch; here we additionally wrap the whole run so a job
// throwing can never crash the BFF process — it's logged and the next tick
// retries.
//
// startCron() is called from src/index.ts on boot (see the gate there). The JOB
// registry is exported so the scheduler-wiring test can drive node-cron with
// fake timers and assert the right job fires at the right time.

import cron, { type ScheduledTask } from 'node-cron';
import { runRefreshPrices } from './refreshPrices';
import { runRefreshFx } from './refreshFx';
import { runSnapshotHoldings } from './snapshotHoldings';
import { runRefreshProfiles } from './refreshProfiles';
import { runPruneSnapshots } from './pruneSnapshots';
import { runSyncBrokers } from './syncBrokers';

export const CRON_TIMEZONE = 'Europe/Amsterdam';

export interface CronJob {
  name: string;
  /** Standard 5-field cron expression, interpreted in CRON_TIMEZONE. */
  schedule: string;
  run: () => Promise<unknown>;
}

// The scheduled jobs. Schedules are Amsterdam-local (see CRON_TIMEZONE).
export const CRON_JOBS: CronJob[] = [
  {
    // Hourly on the hour, 07:00–22:00, Monday–Friday (market hours).
    name: 'refreshPrices',
    schedule: '0 7-22 * * 1-5',
    run: runRefreshPrices,
  },
  {
    // Daily at 16:30 — just after ECB publishes the day's reference rates.
    name: 'refreshFx',
    schedule: '30 16 * * *',
    run: runRefreshFx,
  },
  {
    // Nightly at 02:00.
    name: 'snapshotHoldings',
    schedule: '0 2 * * *',
    run: runSnapshotHoldings,
  },
  {
    // Weekly, Sunday 02:00.
    name: 'refreshProfiles',
    schedule: '0 2 * * 0',
    run: runRefreshProfiles,
  },
  {
    // Weekly, Sunday 03:00 — after the Sunday snapshot/profile jobs settle.
    name: 'pruneSnapshots',
    schedule: '0 3 * * 0',
    run: runPruneSnapshots,
  },
  {
    // Daily at 06:00 — fan out the Trading 212 sync to every connection.
    name: 'syncBrokers',
    schedule: '0 6 * * *',
    run: runSyncBrokers,
  },
];

/** Wrap a job so a throw is logged but never crashes the process. */
function safeRun(job: CronJob): () => Promise<void> {
  return async () => {
    const startedAt = Date.now();
    try {
      const result = await job.run();
      console.log(`[cron:${job.name}] done in ${Date.now() - startedAt}ms`, result);
    } catch (err) {
      console.error(`[cron:${job.name}] failed:`, err);
    }
  };
}

/**
 * Schedule every job with node-cron in the Amsterdam timezone and return the
 * created tasks (so callers/tests can stop them).
 *
 * @param jobs job registry (defaults to CRON_JOBS; overridable for tests).
 */
export function startCron(jobs: CronJob[] = CRON_JOBS): ScheduledTask[] {
  return jobs.map((job) =>
    cron.schedule(job.schedule, safeRun(job), {
      name: job.name,
      timezone: CRON_TIMEZONE,
    }),
  );
}
