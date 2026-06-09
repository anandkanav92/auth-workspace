// Per-user repo for the `broker_connections` collection. See perUserRepo.ts
// for the shared CRUD + user-scoping logic.
import { PerUserRepo } from './perUserRepo';
import { pbAdmin } from '../lib/pb';
import type {
  BrokerConnection,
  BrokerConnectionCreate,
  BrokerConnectionUpdate,
} from './schemas';

export class BrokerConnectionsRepo extends PerUserRepo<
  BrokerConnection,
  BrokerConnectionCreate,
  BrokerConnectionUpdate
> {
  constructor() {
    super('broker_connections');
  }

  /**
   * Fetch this user's connection for a given broker, or null if none. The
   * (user, broker) unique index guarantees at most one row. Scoped by user so
   * the admin token never reaches another user's connection.
   */
  async getForUser(
    pbUserId: string,
    broker: BrokerConnection['broker'],
  ): Promise<BrokerConnection | null> {
    const matches = await this.listWhere(pbUserId, {
      fragment: 'broker = {:broker}',
      params: { broker },
    });
    return matches[0] ?? null;
  }

  /**
   * ADMIN-SCOPED, ALL-USERS read of every broker connection row — INCLUDING
   * `error`/`syncing` rows ON PURPOSE: the daily cron retries errored
   * connections (a transient 429 self-heals) and a stale `syncing` (crashed run)
   * recovers. Backs the daily auto-sync cron's fan-out. Mirrors
   * holdingsSnapshot.listAllByDateRange / symbolProfiles.listStale: uses
   * pbAdmin() and is NOT request-scoped — cron only.
   */
  async listAllForSync(): Promise<BrokerConnection[]> {
    const pb = await pbAdmin();
    return pb
      .collection('broker_connections')
      .getFullList<BrokerConnection>();
  }
}

export const brokerConnectionsRepo = new BrokerConnectionsRepo();
