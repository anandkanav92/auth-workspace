// Trading 212 sync service (Task 2.3). Maintains the user's holdings (current
// positions + average cost) and an append-only, deduplicated transaction ledger
// from the read-only Trading 212 API.
//
// SHAPE (mirrors cron/refreshFx.ts): a deps-injected `runTrading212SyncWith` so
// the whole flow is unit-testable without PocketBase, the network or the real
// provider; plus a lazy prod binding `runTrading212Sync` that wires the real
// repos + provider + crypto on first call (so importing this module in a unit
// test never requires the PB admin env vars).
//
// DATA-SAFETY: a sync is NOT a statement import — there is no file/hash and no
// imports audit row. Holdings are snapshot-replaced for THIS account only via an
// atomic PocketBase batch (commitHoldingsReplace): if any write fails, the whole
// batch rolls back and the account's prior holdings survive. The ledger
// (transactions) is upserted by external_id and is never part of that batch, so
// the two never clobber each other.
//
// On ANY error (incl. a Trading212ApiError from a persistent 429/4xx) we stamp
// status=error + last_error on the connection and rethrow WITHOUT having wiped
// holdings or ledger (the positions fetch happens before the holdings replace,
// and history pagination throws before any partial-write).

import type { BrokerProvider } from '../providers/broker';
import type { LedgerEvent } from '../providers/trading212';
import { normalizePence, normalizeCurrencyCode } from '../providers/currency';
import type { BrokerConnectionsRepo } from '../db/brokerConnections';
import type { AccountsRepo } from '../db/accounts';
import type { HoldingsRepo } from '../db/holdings';
import type { TransactionsRepo } from '../db/transactions';
import type { HoldingCreate, TransactionCreate } from '../db/schemas';

const BROKER = 'trading212' as const;

/** Resolved instrument metadata for a T212 ticker, derived from the ledger. */
interface InstrumentInfo {
  isin: string;
  currency?: string;
  name?: string;
}

export interface Trading212SyncDeps {
  connections: Pick<BrokerConnectionsRepo, 'getForUser' | 'update'>;
  accounts: Pick<AccountsRepo, 'list'>;
  holdings: Pick<HoldingsRepo, 'listForUser'>;
  transactions: Pick<TransactionsRepo, 'upsertByExternalId'>;
  provider: Pick<
    BrokerProvider,
    'fetchPositions' | 'fetchOrders' | 'fetchDividends' | 'fetchInstruments'
  >;
  /** Atomic, account-scoped holdings snapshot-replace (no imports row). */
  replaceHoldings: (args: {
    existing: { id: string }[];
    holdings: HoldingCreate[];
  }) => Promise<void>;
  /** Resolve (isin, brokerSymbol, expectedCurrency) → our ticker. */
  resolveTicker: (
    isin: string,
    brokerSymbol: string,
    expectedCurrency?: string,
  ) => Promise<string>;
  /** Fetch + cache a live price for each ticker (so positions don't value to €0
   *  until the next refreshPrices cron). Best-effort; must not fail the sync. */
  enrichPrices: (tickers: string[]) => Promise<void>;
  /** Decrypt the stored api_key_enc → combined "<public>:<private>" creds. */
  decrypt: (apiKeyEnc: string) => string;
  /** Injectable clock for deterministic tests; defaults to now. */
  now?: () => Date;
}

export type Trading212SyncResult =
  | { skipped: true }
  | { positions: number; orders: number; dividends: number };

/** `AAPL_US_EQ` → `AAPL` (substring before the first '_'). */
export function brokerSymbolFromT212(t212Ticker: string): string {
  const idx = t212Ticker.indexOf('_');
  return idx === -1 ? t212Ticker : t212Ticker.slice(0, idx);
}

/**
 * Sync one user's Trading 212 holdings + ledger.
 *
 * 1. Load the connection (none → skip); decrypt creds.
 * 2. Find the trading212 account.
 * 3. Page orders then dividends to completion, building a t212Ticker→instrument
 *    map and upserting each event into transactions (dedup by external_id).
 * 4. Fetch positions, resolve each via the ledger map, and snapshot-replace this
 *    account's holdings atomically.
 * 5. Stamp the connection connected + last_synced_at on success; on error stamp
 *    status=error + last_error and rethrow (prior data preserved).
 */
export async function runTrading212SyncWith(
  deps: Trading212SyncDeps,
  userId: string,
): Promise<Trading212SyncResult> {
  const conn = await deps.connections.getForUser(userId, BROKER);
  if (!conn) return { skipped: true };

  try {
    // Mark the connection as actively syncing (clearing any prior error) BEFORE
    // any network work. This is the server-authoritative "in progress" signal:
    // the UI shows a disabled "Syncing…" button off it (survives reloads) and the
    // sync route rejects a concurrent sync while it's set. The finally clauses
    // below always flip it to connected|error, so it never sticks on a happy path.
    await deps.connections.update(conn.id, {
      status: 'syncing',
      last_error: '',
    });

    const creds = deps.decrypt(conn.api_key_enc);

    const accounts = await deps.accounts.list(userId);
    const account = accounts.find((a) => a.source === BROKER);
    if (!account) {
      throw new Error('no trading212 account for user');
    }
    const accountId = account.id;

    // --- ledger: orders then dividends, paged to completion -----------------
    const tickerMap = new Map<string, InstrumentInfo>();
    const orders = await paginate((cursor) =>
      deps.provider.fetchOrders(creds, cursor),
    );
    const dividends = await paginate((cursor) =>
      deps.provider.fetchDividends(creds, cursor),
    );

    for (const event of [...orders, ...dividends]) {
      rememberInstrument(tickerMap, event);
    }

    for (const event of orders) {
      await upsertLedgerRow(deps, userId, accountId, event);
    }
    for (const event of dividends) {
      await upsertLedgerRow(deps, userId, accountId, event);
    }

    // --- holdings: positions → atomic snapshot-replace ----------------------
    const positions = await deps.provider.fetchPositions(creds);

    // The order ledger only covers tickers we have a BUY for in the synced
    // window — transferred-in shares and pre-history buys are missing, which
    // would drop their ISIN/currency (→ no cost basis, wrong ticker resolution).
    // If any held position is uncovered, fill the gaps from the authoritative
    // instruments metadata. Best-effort: on a metadata error we degrade to the
    // order-derived map rather than fail the whole sync.
    const uncovered = positions.filter((p) => !tickerMap.has(p.t212Ticker));
    if (uncovered.length > 0) {
      try {
        const instruments = await deps.provider.fetchInstruments(creds);
        for (const inst of instruments) {
          if (tickerMap.has(inst.t212Ticker)) continue;
          tickerMap.set(inst.t212Ticker, {
            isin: inst.isin,
            currency: inst.currency, // RAW (e.g. GBX) → pence-normalised at use
            name: inst.name,
          });
        }
      } catch {
        // keep the order-derived map; the uncovered positions stay best-effort.
      }
    }

    const newHoldings: HoldingCreate[] = [];
    for (const position of positions) {
      const brokerSymbol = brokerSymbolFromT212(position.t212Ticker);
      const info = tickerMap.get(position.t212Ticker);
      const isin = info?.isin ?? '';
      // Cost basis = qty × avg price, GBX-normalised to GBP major units.
      const { amount: costBasis, currency: costCurrency } = normalizePence(
        position.quantity * position.averagePrice,
        info?.currency,
      );
      const ourTicker = await deps.resolveTicker(isin, brokerSymbol, costCurrency);
      newHoldings.push({
        user: userId,
        account: accountId,
        ticker: ourTicker,
        isin: isin || undefined,
        quantity: position.quantity,
        cost_basis: costBasis,
        cost_currency: costCurrency,
        source: BROKER,
      });
    }

    const existing = await deps.holdings.listForUser(userId, {
      account: accountId,
    });
    await deps.replaceHoldings({
      existing: existing.map((h) => ({ id: h.id })),
      holdings: newHoldings,
    });

    // Fetch a live price for every resolved ticker so the dashboard values the
    // positions immediately (the fix for "synced value is €0 / half until the
    // overnight cron"). Strictly best-effort: holdings + ledger are already
    // committed, so a price-enrichment failure (incl. lazy dep wiring) must NOT
    // flip an otherwise-successful sync to status=error — the cron is the backstop.
    await deps.enrichPrices(newHoldings.map((h) => h.ticker)).catch(() => undefined);

    // --- success bookkeeping ------------------------------------------------
    const now = (deps.now?.() ?? new Date()).toISOString();
    await deps.connections.update(conn.id, {
      last_synced_at: now,
      status: 'connected',
      last_error: '',
    });

    return {
      positions: positions.length,
      orders: orders.length,
      dividends: dividends.length,
    };
  } catch (err) {
    // Preserve existing holdings/ledger; surface the failure on the connection.
    const message = err instanceof Error ? err.message : String(err);
    await deps.connections
      .update(conn.id, { status: 'error', last_error: message })
      .catch(() => undefined);
    throw err;
  }
}

/** Follow `nextCursor` to completion, accumulating every page's items. */
async function paginate(
  fetchPage: (
    cursor?: string,
  ) => Promise<{ items: LedgerEvent[]; nextCursor?: string }>,
): Promise<LedgerEvent[]> {
  const all: LedgerEvent[] = [];
  let cursor: string | undefined;
  do {
    const page = await fetchPage(cursor);
    all.push(...page.items);
    cursor = page.nextCursor;
  } while (cursor);
  return all;
}

/** Record the first ISIN/currency/name we see for a T212 ticker.
 *  The currency is stored RAW (e.g. GBX) so the position cost-basis can be
 *  pence-normalised at point of use; it's normalised separately for ticker
 *  resolution. */
function rememberInstrument(
  map: Map<string, InstrumentInfo>,
  event: LedgerEvent,
): void {
  if (map.has(event.t212Ticker)) return;
  if (!event.isin) return;
  map.set(event.t212Ticker, {
    isin: event.isin,
    // RAW currency (e.g. GBX) so the position cost basis pence-normalises; the
    // provider's `currency` is already normalised and would not trigger ÷100.
    currency: event.rawCurrency ?? event.currency,
    name: event.name,
  });
}

/**
 * Map a ledger event to a transactions row and upsert it (dedup by external_id).
 *
 * DIVIDEND CASH MAPPING (schema decision): the transactions schema has no
 * dedicated cash-amount column — it carries `quantity`, `price` and `fee`. For a
 * dividend we set `quantity` = the dividend's share count and put the per-row
 * CASH AMOUNT in `price` (the gross dividend amount in the event's currency), so
 * `quantity × price` is NOT a meaningful product for dividends — `price` here is
 * the cash paid, mirroring how buys/sells use `price` as the per-share value.
 * This keeps every ledger row in one schema without a nullable amount column.
 */
async function upsertLedgerRow(
  deps: Trading212SyncDeps,
  userId: string,
  accountId: string,
  event: LedgerEvent,
): Promise<void> {
  const brokerSymbol = brokerSymbolFromT212(event.t212Ticker);
  const currency = normalizeCurrencyCode(event.currency) ?? 'EUR';
  const ticker = await deps.resolveTicker(
    event.isin ?? '',
    brokerSymbol,
    currency,
  );

  // NOTE: the transactions schema has no `isin` column — instrument identity
  // lives on `ticker` (resolved) + the holdings/symbol_profiles join, so we do
  // not persist the event's ISIN here.
  const row: TransactionCreate = {
    user: userId,
    account: accountId,
    type: event.type,
    ticker,
    quantity: event.quantity ?? 0,
    // dividends: `price` carries the cash amount (see fn doc); buys/sells: per-share price.
    price: event.type === 'dividend' ? event.amount : event.price,
    currency,
    fee: event.fee,
    // T212 gives ISO timestamps for orders (filledAt) but dividend paidOn may be
    // date-only — normalise both to an ISO string PocketBase's DateField accepts.
    // A single bad timestamp must not abort the whole sync, so fall back to now.
    occurred_at: normalizeOccurredAt(event.occurredAt, deps.now),
    source: BROKER,
    external_id: event.externalId,
  };

  try {
    await deps.transactions.upsertByExternalId(row);
  } catch (err) {
    // Surface the PocketBase field detail so the connection's last_error is
    // self-diagnostic (e.g. `{ quantity: ... }`) instead of "Failed to create record."
    const detail =
      (err as { response?: { data?: unknown } })?.response?.data ??
      (err as { message?: string })?.message;
    throw new Error('transaction upsert failed: ' + JSON.stringify(detail));
  }
}

/** Normalise a ledger timestamp (ISO or date-only) to an ISO string the
 *  DateField accepts; fall back to now on an unparseable value. */
function normalizeOccurredAt(occurredAt: string, now?: () => Date): string {
  const d = new Date(occurredAt);
  if (Number.isNaN(d.getTime())) {
    return (now?.() ?? new Date()).toISOString();
  }
  return d.toISOString();
}

// --- production binding -------------------------------------------------------
let prodDeps: Trading212SyncDeps | undefined;
async function getProdDeps(): Promise<Trading212SyncDeps> {
  if (!prodDeps) {
    const { brokerConnectionsRepo } = await import('../db/brokerConnections');
    const { accountsRepo } = await import('../db/accounts');
    const { holdingsRepo } = await import('../db/holdings');
    const { transactionsRepo } = await import('../db/transactions');
    const { Trading212Provider } = await import('../providers/broker');
    const { commitHoldingsReplace } = await import('../db/importCommit');
    const { resolveTicker } = await import('../importers/resolveTicker');
    const { enrichPrices } = await import('../market/enrichPrices');
    const { decryptSecret } = await import('../lib/crypto');

    prodDeps = {
      connections: brokerConnectionsRepo,
      accounts: accountsRepo,
      holdings: holdingsRepo,
      transactions: transactionsRepo,
      provider: new Trading212Provider(),
      replaceHoldings: commitHoldingsReplace,
      resolveTicker,
      enrichPrices,
      decrypt: (apiKeyEnc: string) => {
        const secret = process.env.T212_KEY_ENC_SECRET;
        if (!secret) {
          throw new Error('T212_KEY_ENC_SECRET is not set');
        }
        return decryptSecret(apiKeyEnc, secret);
      },
    };
  }
  return prodDeps;
}

export async function runTrading212Sync(
  userId: string,
): Promise<Trading212SyncResult> {
  return runTrading212SyncWith(await getProdDeps(), userId);
}
