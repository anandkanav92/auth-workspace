// Real Trading 212 provider (Task 2.1). Contract validated live — see
// docs/spikes/2026-06-08-t212-api-results.md (auth, rate limits, schemas,
// field→model mappings). This is plain `fetch` (no SDK), mirroring the
// finnhub/yahoo providers.
//
// Auth: HTTP Basic over the COMBINED credentials string. The provider receives
// `creds` already in "<public>:<private>" form (decrypted from
// broker_connections.api_key_enc), so we just base64 it — we do NOT re-join.
//
// Rate limits are STRICT and per-endpoint (see the spike doc). History endpoints
// allow 6/60s, so between paged calls we sleep ~10s. On HTTP 429 we read
// x-ratelimit-reset / retry-after and wait, then retry once. `sleep` is
// injectable so unit tests pass a no-op and never actually wait.

import type { BrokerProvider } from './broker';
import { normalizePence, normalizeCurrencyCode } from './currency';

const BASE_URL = 'https://live.trading212.com';

/** ~10s between paged history calls keeps us under the 6/60s history limit. */
const HISTORY_PAGE_DELAY_MS = 10_000;

/** Page size for the orders/dividends history endpoints (`limit=` query param). */
const HISTORY_PAGE_SIZE = 50;

/**
 * Thrown when a Trading 212 request stays non-ok after the single 429-aware
 * retry. History fetches throw this (instead of returning an empty page) so a
 * multi-page backfill fails loudly rather than silently truncating the ledger.
 */
export class Trading212ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'Trading212ApiError';
  }
}

/** A single open portfolio position. ISIN/currency are NOT in this endpoint —
 *  the sync resolves them from the order-derived ticker map. */
export interface T212Position {
  t212Ticker: string;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  initialFillDate: string;
}

/** A normalised ledger row from the orders/dividends history endpoints. */
export interface LedgerEvent {
  externalId: string;
  type: 'buy' | 'sell' | 'dividend';
  t212Ticker: string;
  isin?: string;
  name?: string;
  /** Normalised currency for the ledger row (GBX/GBp → GBP, prices already ÷100). */
  currency?: string;
  /** RAW instrument currency as reported by T212 (e.g. GBX). The sync uses this
   *  to pence-normalise the portfolio position's cost basis, whose averagePrice
   *  comes from the (un-normalised) /portfolio endpoint. */
  rawCurrency?: string;
  quantity?: number;
  price?: number;
  fee?: number;
  amount?: number;
  amountEur?: number;
  fxRate?: number;
  occurredAt: string;
}

/** Page of ledger events plus an opaque cursor (the API's `nextPagePath`). */
export interface LedgerPage {
  items: LedgerEvent[];
  nextCursor?: string;
}

// --- raw API response shapes (only the fields we consume) -------------------

interface AccountInfo {
  id: number;
  currencyCode: string;
}

interface RawPosition {
  ticker: string;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  initialFillDate: string;
}

interface RawInstrument {
  ticker: string;
  name: string;
  isin: string;
  currency: string;
}

interface RawTax {
  name: string;
  quantity: number;
  currency: string;
  chargedAt: string;
}

interface RawFill {
  quantity: number;
  price: number;
  filledAt: string;
  walletImpact?: {
    fxRate?: number;
    taxes?: RawTax[];
  };
}

interface RawOrderItem {
  order: {
    id: number;
    side: string; // BUY / SELL
    ticker: string;
    instrument: RawInstrument;
  };
  // Non-executed orders (cancelled/rejected/expired) have an `order` but no
  // `fill` (or `fill: null`), so this is optional/nullable.
  fill?: RawFill | null;
}

interface RawOrdersPage {
  items: RawOrderItem[];
  nextPagePath?: string | null;
}

interface RawDividendItem {
  ticker: string;
  instrument: RawInstrument;
  reference: string;
  amount: number;
  amountInEuro: number;
  paidOn: string;
}

interface RawDividendsPage {
  items: RawDividendItem[];
  nextPagePath?: string | null;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export class Trading212Provider implements BrokerProvider {
  constructor(private readonly sleep: (ms: number) => Promise<void> = defaultSleep) {}

  private authHeader(creds: string): string {
    // `creds` is already "<public>:<private>"; base64 the whole string.
    return `Basic ${Buffer.from(creds).toString('base64')}`;
  }

  /** Resolve a `nextPagePath` (relative path or full URL) to an absolute URL. */
  private resolveCursor(cursor: string): string {
    return cursor.startsWith('http') ? cursor : `${BASE_URL}${cursor}`;
  }

  /**
   * Fetch with one 429-aware retry. On 429 we honor `x-ratelimit-reset`
   * (epoch seconds) or `retry-after` (seconds) and wait before the single retry.
   */
  private async fetchJson(url: string, creds: string): Promise<{ ok: boolean; status: number; body: unknown }> {
    let res = await fetch(url, { headers: { Authorization: this.authHeader(creds) } });
    if (res.status === 429) {
      await this.sleep(this.retryDelayMs(res));
      res = await fetch(url, { headers: { Authorization: this.authHeader(creds) } });
    }
    if (!res.ok) return { ok: false, status: res.status, body: undefined };
    // A 200 with a malformed/truncated body must NOT throw an uncaught error.
    // Treat a parse failure as a non-ok response so callers handle it uniformly.
    try {
      const body = await res.json();
      return { ok: true, status: res.status, body };
    } catch {
      return { ok: false, status: res.status, body: undefined };
    }
  }

  /** Milliseconds to wait after a 429, from rate-limit headers (fallback 60s). */
  private retryDelayMs(res: Response): number {
    const reset = res.headers.get('x-ratelimit-reset');
    if (reset) {
      // ASSUMPTION: `x-ratelimit-reset` is epoch SECONDS (absolute time), so we
      // subtract `Date.now()` to get the wait. We have not yet observed a live
      // 429 to confirm this — if it turns out to be a seconds-delta like
      // `retry-after`, this needs revisiting. Clamp to a non-negative wait.
      const waitMs = Number(reset) * 1000 - Date.now();
      return Math.max(0, waitMs);
    }
    const retryAfter = res.headers.get('retry-after');
    if (retryAfter) return Math.max(0, Number(retryAfter) * 1000);
    return 60_000;
  }

  async validateKey(
    creds: string,
  ): Promise<{ ok: boolean; accountId?: string; currency?: string }> {
    const { ok, status, body } = await this.fetchJson(
      `${BASE_URL}/api/v0/equity/account/info`,
      creds,
    );
    if (status === 401 || status === 403) return { ok: false };
    if (!ok) return { ok: false };
    const info = body as AccountInfo;
    return { ok: true, accountId: String(info.id), currency: info.currencyCode };
  }

  async fetchPositions(creds: string): Promise<T212Position[]> {
    const { ok, status, body } = await this.fetchJson(`${BASE_URL}/api/v0/equity/portfolio`, creds);
    // Single call (no truncation risk), but a thrown error beats silently
    // returning [] — the sync can then set status=error and preserve data.
    if (!ok) throw new Trading212ApiError(`portfolio fetch failed (status ${status})`, status);
    const positions = body as RawPosition[];
    return positions.map((p) => ({
      t212Ticker: p.ticker,
      quantity: p.quantity,
      averagePrice: p.averagePrice,
      currentPrice: p.currentPrice,
      initialFillDate: p.initialFillDate,
    }));
  }

  async fetchOrders(creds: string, cursor?: string): Promise<LedgerPage> {
    const url = cursor
      ? this.resolveCursor(cursor)
      : `${BASE_URL}/api/v0/equity/history/orders?limit=${HISTORY_PAGE_SIZE}`;
    const { ok, status, body } = await this.fetchJson(url, creds);
    // Throw (don't return an empty page) so a persistent 429/error stops the
    // backfill loop. An empty page must ONLY come from a genuine `items: []`.
    if (!ok) throw new Trading212ApiError(`orders fetch failed (status ${status})`, status);
    const page = body as RawOrdersPage;
    // Only EXECUTED orders (those with a `fill`) are ledger rows. Real history
    // also returns non-executed orders (cancelled/rejected/expired) that have an
    // `order` but no `fill` — skip them rather than crash on `fill.walletImpact`.
    const items = page.items
      .filter((it): it is RawOrderItem & { fill: RawFill } => it.fill != null)
      .map((it) => this.mapOrder(it));
    return { items, nextCursor: page.nextPagePath ?? undefined };
  }

  private mapOrder(it: RawOrderItem & { fill: RawFill }): LedgerEvent {
    const { order, fill } = it;
    const ccy = order.instrument.currency;
    const fee = (fill?.walletImpact?.taxes ?? []).reduce((sum, t) => sum + t.quantity, 0);
    return {
      externalId: String(order.id),
      type: order.side.toLowerCase() as 'buy' | 'sell',
      t212Ticker: order.ticker,
      isin: order.instrument.isin,
      name: order.instrument.name,
      currency: normalizeCurrencyCode(ccy),
      rawCurrency: ccy,
      quantity: fill.quantity,
      // GBX/GBp prices are quoted in pence — normalise to GBP major units.
      price: normalizePence(fill.price, ccy).amount,
      fee,
      fxRate: fill?.walletImpact?.fxRate,
      occurredAt: fill.filledAt,
    };
  }

  async fetchDividends(creds: string, cursor?: string): Promise<LedgerPage> {
    const url = cursor
      ? this.resolveCursor(cursor)
      : `${BASE_URL}/api/v0/history/dividends?limit=${HISTORY_PAGE_SIZE}`;
    const { ok, status, body } = await this.fetchJson(url, creds);
    // Throw (don't return an empty page) so a persistent 429/error stops the
    // backfill loop. An empty page must ONLY come from a genuine `items: []`.
    if (!ok) throw new Trading212ApiError(`dividends fetch failed (status ${status})`, status);
    const page = body as RawDividendsPage;
    const items = page.items.map((d) => {
      const ccy = d.instrument.currency;
      return {
        externalId: d.reference,
        type: 'dividend' as const,
        t212Ticker: d.ticker,
        isin: d.instrument.isin,
        name: d.instrument.name,
        currency: normalizeCurrencyCode(ccy),
        rawCurrency: ccy,
        // GBX/GBp dividends are paid in pence — normalise the cash amount to GBP
        // major units, mirroring how mapOrder normalises fill.price. amountEur
        // (amountInEuro) is already a major-unit EUR figure, so leave it as-is.
        amount: normalizePence(d.amount, ccy).amount,
        amountEur: d.amountInEuro,
        occurredAt: d.paidOn,
      };
    });
    return { items, nextCursor: page.nextPagePath ?? undefined };
  }

  /** Sleep between paged history calls (≤6/min). Exposed for the sync loop. */
  async throttleHistory(): Promise<void> {
    await this.sleep(HISTORY_PAGE_DELAY_MS);
  }
}
