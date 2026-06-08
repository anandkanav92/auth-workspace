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
  currency?: string;
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

interface RawOrderItem {
  order: {
    id: number;
    side: string; // BUY / SELL
    ticker: string;
    instrument: RawInstrument;
  };
  fill: {
    quantity: number;
    price: number;
    filledAt: string;
    walletImpact: {
      fxRate: number;
      taxes?: RawTax[];
    };
  };
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
    const body = res.ok ? await res.json() : undefined;
    return { ok: res.ok, status: res.status, body };
  }

  /** Milliseconds to wait after a 429, from rate-limit headers (fallback 60s). */
  private retryDelayMs(res: Response): number {
    const reset = res.headers.get('x-ratelimit-reset');
    if (reset) {
      // `x-ratelimit-reset` is epoch seconds; clamp to a non-negative wait.
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
    const { ok, body } = await this.fetchJson(`${BASE_URL}/api/v0/equity/portfolio`, creds);
    if (!ok) return [];
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
      : `${BASE_URL}/api/v0/equity/history/orders?limit=50`;
    const { ok, body } = await this.fetchJson(url, creds);
    if (!ok) return { items: [] };
    const page = body as RawOrdersPage;
    const items = page.items.map((it) => this.mapOrder(it));
    return { items, nextCursor: page.nextPagePath ?? undefined };
  }

  private mapOrder(it: RawOrderItem): LedgerEvent {
    const { order, fill } = it;
    const ccy = order.instrument.currency;
    const fee = (fill.walletImpact.taxes ?? []).reduce((sum, t) => sum + t.quantity, 0);
    return {
      externalId: String(order.id),
      type: order.side.toLowerCase() as 'buy' | 'sell',
      t212Ticker: order.ticker,
      isin: order.instrument.isin,
      name: order.instrument.name,
      currency: normalizeCurrencyCode(ccy),
      quantity: fill.quantity,
      // GBX/GBp prices are quoted in pence — normalise to GBP major units.
      price: normalizePence(fill.price, ccy).amount,
      fee,
      fxRate: fill.walletImpact.fxRate,
      occurredAt: fill.filledAt,
    };
  }

  async fetchDividends(creds: string, cursor?: string): Promise<LedgerPage> {
    const url = cursor
      ? this.resolveCursor(cursor)
      : `${BASE_URL}/api/v0/history/dividends?limit=50`;
    const { ok, body } = await this.fetchJson(url, creds);
    if (!ok) return { items: [] };
    const page = body as RawDividendsPage;
    const items = page.items.map((d) => ({
      externalId: d.reference,
      type: 'dividend' as const,
      t212Ticker: d.ticker,
      isin: d.instrument.isin,
      name: d.instrument.name,
      currency: normalizeCurrencyCode(d.instrument.currency),
      amount: d.amount,
      amountEur: d.amountInEuro,
      occurredAt: d.paidOn,
    }));
    return { items, nextCursor: page.nextPagePath ?? undefined };
  }

  /** Sleep between paged history calls (≤6/min). Exposed for the sync loop. */
  async throttleHistory(): Promise<void> {
    await this.sleep(HISTORY_PAGE_DELAY_MS);
  }
}
