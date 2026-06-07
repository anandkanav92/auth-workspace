// Daily FX-refresh cron (M8.3). Pulls the latest ECB reference rates and upserts
// fx_rates keyed by today's date (YYYY-MM-DD).
//
// Idempotency: fx_rates is keyed on `date` (SharedRepo.upsert), so re-running on
// the same day overwrites today's row rather than inserting a duplicate. The
// date is computed in the Amsterdam timezone so the "FX day" matches the cron's
// 16:30 Europe/Amsterdam trigger (ECB publishes ~16:00 CET).
//
// Deps are injected for unit testing; runRefreshFx() binds the real ECB provider
// + fx_rates repo.

import type { FxRatesRepo } from '../db/fxRates';
import type { FxProvider } from '../providers/types';
import { amsterdamDate } from './time';

export interface RefreshFxDeps {
  fx: Pick<FxProvider, 'latest'>;
  fxRates: Pick<FxRatesRepo, 'upsert'>;
  /** Injectable clock for deterministic tests; defaults to now. */
  now?: () => Date;
}

export interface RefreshFxResult {
  date: string;
  /** Number of currencies persisted (includes the EUR=1 base). */
  currencies: number;
}

/**
 * Fetch today's ECB rates and upsert the fx_rates row for today's Amsterdam
 * date. Throws if the ECB fetch fails (the scheduler logs + the next tick
 * retries) — a failed fetch must not write a partial row.
 */
export async function runRefreshFxWith(
  deps: RefreshFxDeps,
): Promise<RefreshFxResult> {
  const date = amsterdamDate(deps.now?.() ?? new Date());
  const rates = await deps.fx.latest();
  await deps.fxRates.upsert({ date, rates });
  return { date, currencies: Object.keys(rates).length };
}

// --- Production binding -------------------------------------------------------
let prodDeps: RefreshFxDeps | undefined;
async function getProdDeps(): Promise<RefreshFxDeps> {
  if (!prodDeps) {
    const { fxRatesRepo } = await import('../db/fxRates');
    const { EcbFxProvider } = await import('../providers/ecb');
    prodDeps = { fx: new EcbFxProvider(), fxRates: fxRatesRepo };
  }
  return prodDeps;
}

export async function runRefreshFx(): Promise<RefreshFxResult> {
  return runRefreshFxWith(await getProdDeps());
}
