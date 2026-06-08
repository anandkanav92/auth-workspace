// Broker provider abstraction (Task 1.5 + 2.1). The broker routes depend on this
// interface rather than a concrete client so the connect/status/disconnect
// handlers are unit-testable without hitting the real Trading 212 API.
//
// `validateKey` powers the connect flow; the `fetch*` methods power the sync
// service (Task 2.1). All methods take the COMBINED credentials string
// ("<public>:<private>") — see trading212.ts for the concrete implementation.

import type { LedgerEvent, LedgerPage, T212Position } from './trading212';

export interface BrokerProvider {
  /**
   * Verify an API key against the broker. On success returns the broker's
   * account id + reporting currency so the connect handler can store them;
   * on a rejected key returns `{ ok: false }` (the handler then 400s and
   * stores nothing).
   */
  validateKey(
    creds: string,
  ): Promise<{ ok: boolean; accountId?: string; currency?: string }>;

  /** Open portfolio positions. ISIN/currency are resolved by the sync from the
   *  order-derived ticker map (not present on this endpoint). */
  fetchPositions(creds: string): Promise<T212Position[]>;

  /** A page of buy/sell ledger events. `cursor` is the prior page's nextCursor. */
  fetchOrders(creds: string, cursor?: string): Promise<LedgerPage>;

  /** A page of dividend ledger events. `cursor` is the prior page's nextCursor. */
  fetchDividends(creds: string, cursor?: string): Promise<LedgerPage>;
}

// The real provider lives in trading212.ts; re-export it here so existing
// imports (`../providers/broker` in routes/broker.ts) bind to the real impl.
export { Trading212Provider } from './trading212';
export type { LedgerEvent, LedgerPage, T212Position } from './trading212';
