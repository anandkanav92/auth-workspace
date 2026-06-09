// Daily broker auto-sync cron (M3). Makes the Trading 212 sync automatic rather
// than only the manual "Sync now" button: it lists every broker connection
// across all users and runs the per-user sync for each.
//
// RESILIENCE: each user's sync runs in its own try/catch so one user's failure
// (a persistent 429, an expired key, a missing account) can never abort the
// batch — the remaining users still sync. The sync itself records status +
// last_error on the connection (see trading212Sync.ts), so we don't re-stamp
// here; the cron just tallies ok/failed for the run log.
//
// Deps are injected for unit testing; runSyncBrokers() binds the real repo +
// the real per-user sync on first call (lazy, mirroring cron/refreshFx.ts) so
// importing this module in a unit test never requires the PB admin env vars.

import type { BrokerConnectionsRepo } from '../db/brokerConnections';

export interface SyncBrokersDeps {
  connections: Pick<BrokerConnectionsRepo, 'listAllForSync'>;
  /** Sync one user's broker holdings + ledger (records its own status). */
  syncUser: (userId: string) => Promise<unknown>;
}

export interface SyncBrokersResult {
  /** Connections found (one sync attempt each). */
  users: number;
  /** Syncs that completed without throwing. */
  ok: number;
  /** Syncs that threw (logged, not fatal — the sync stamped last_error). */
  failed: number;
}

/**
 * List every broker connection and sync each user. A per-user throw is caught
 * and counted (never rethrown) so one failure doesn't abort the batch.
 *
 * TODO(scale): syncs run sequentially with no jitter/cap; when there are many
 * users (or a second broker is added), fan out per (user, broker) with batching
 * + jitter so a 06:00 stampede doesn't hammer the upstream rate limits.
 */
export async function runSyncBrokersWith(
  deps: SyncBrokersDeps,
): Promise<SyncBrokersResult> {
  const connections = await deps.connections.listAllForSync();

  let ok = 0;
  let failed = 0;

  for (const connection of connections) {
    try {
      await deps.syncUser(connection.user);
      ok++;
    } catch (err) {
      failed++;
      console.error(
        `[cron:syncBrokers] user ${connection.user} (conn ${connection.id}) failed:`,
        err,
      );
    }
  }

  return { users: connections.length, ok, failed };
}

// --- Production binding -------------------------------------------------------
let prodDeps: SyncBrokersDeps | undefined;
async function getProdDeps(): Promise<SyncBrokersDeps> {
  if (!prodDeps) {
    const { brokerConnectionsRepo } = await import('../db/brokerConnections');
    const { runTrading212Sync } = await import('../sync/trading212Sync');
    prodDeps = {
      connections: brokerConnectionsRepo,
      syncUser: runTrading212Sync,
    };
  }
  return prodDeps;
}

export async function runSyncBrokers(): Promise<SyncBrokersResult> {
  return runSyncBrokersWith(await getProdDeps());
}
