// Per-user repo for the `broker_connections` collection. See perUserRepo.ts
// for the shared CRUD + user-scoping logic.
import { PerUserRepo } from './perUserRepo';
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
}

export const brokerConnectionsRepo = new BrokerConnectionsRepo();
