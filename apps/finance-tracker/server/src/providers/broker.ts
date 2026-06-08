// Broker provider abstraction (Task 1.5 + 2.1). The broker routes depend on this
// interface rather than a concrete client so the connect/status/disconnect
// handlers are unit-testable without hitting the real Trading 212 API.
//
// `validateKey` is the only method needed in Milestone 1 (connect flow). The
// fetch* methods used by the sync service land in Task 2.1, so the concrete
// Trading212Provider here is a placeholder whose validateKey throws until then.

export interface BrokerProvider {
  /**
   * Verify an API key against the broker. On success returns the broker's
   * account id + reporting currency so the connect handler can store them;
   * on a rejected key returns `{ ok: false }` (the handler then 400s and
   * stores nothing).
   */
  validateKey(
    apiKey: string,
  ): Promise<{ ok: boolean; accountId?: string; currency?: string }>;
}

/**
 * Real Trading 212 provider — implemented in Task 2.1. Until then `validateKey`
 * is a TODO placeholder that throws if ever reached in production, making the
 * "not yet wired" state loud rather than silently returning a bad result. In
 * tests the routes inject a mock BrokerProvider, so this stub is never called.
 */
export class Trading212Provider implements BrokerProvider {
  async validateKey(
    _apiKey: string,
  ): Promise<{ ok: boolean; accountId?: string; currency?: string }> {
    // TODO(Task 2.1): call the Trading 212 account endpoint and map the result.
    throw new Error('Trading212Provider.validateKey not implemented');
  }
}
