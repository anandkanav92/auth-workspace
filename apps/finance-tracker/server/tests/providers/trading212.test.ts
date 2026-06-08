import { describe, it, expect, vi, afterEach } from 'vitest';
import { Trading212Provider, Trading212ApiError } from '../../src/providers/trading212';

// Fixtures are HAND-AUTHORED from the validated schemas in
// docs/spikes/2026-06-08-t212-api-results.md (no key committed; network mocked).
// A no-op sleep is injected so pagination/429 tests never actually wait.

const noopSleep = async () => {};

interface Route {
  ok?: boolean;
  status?: number;
  body?: unknown;
  headers?: Record<string, string>;
  /** When true, `res.json()` rejects — simulates a malformed/truncated 200 body. */
  jsonThrows?: boolean;
}

/** Mock globalThis.fetch, matching by URL substring (mirrors finnhub.test.ts).
 *  Each route may be a single response or an array of sequential responses
 *  (consumed in order across repeated calls to the same fragment). */
function mockFetch(routes: Record<string, Route | Route[]>) {
  const queues: Record<string, Route[]> = {};
  for (const [k, v] of Object.entries(routes)) queues[k] = Array.isArray(v) ? [...v] : [v];
  return vi.spyOn(globalThis, 'fetch').mockImplementation((async (url: string | URL) => {
    const href = url.toString();
    const fragment = Object.keys(queues).find((f) => href.includes(f));
    if (!fragment) throw new Error(`unexpected fetch: ${href}`);
    const queue = queues[fragment];
    const route = queue.length > 1 ? queue.shift()! : queue[0];
    const { ok = true, status = ok ? 200 : 500, body, headers = {}, jsonThrows = false } = route;
    return {
      ok,
      status,
      headers: { get: (h: string) => headers[h.toLowerCase()] ?? null },
      json: async () => {
        if (jsonThrows) throw new SyntaxError('Unexpected end of JSON input');
        return body;
      },
    } as unknown as Response;
  }) as never);
}

afterEach(() => vi.restoreAllMocks());

const CREDS = 'pubKey:privKey';
const EXPECTED_AUTH = `Basic ${Buffer.from(CREDS).toString('base64')}`;

describe('Trading212Provider.validateKey', () => {
  it('sends Basic base64(creds) and returns ok+accountId+currency on 200', async () => {
    const spy = mockFetch({
      '/equity/account/info': { body: { id: 12345, currencyCode: 'EUR' } },
    });
    const p = new Trading212Provider(noopSleep);
    const res = await p.validateKey(CREDS);

    expect(res).toEqual({ ok: true, accountId: '12345', currency: 'EUR' });
    // Assert the EXACT Authorization header.
    const init = spy.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe(EXPECTED_AUTH);
  });

  it('returns { ok: false } on 401', async () => {
    mockFetch({ '/equity/account/info': { ok: false, status: 401, body: {} } });
    const p = new Trading212Provider(noopSleep);
    expect(await p.validateKey(CREDS)).toEqual({ ok: false });
  });
});

describe('Trading212Provider.fetchPositions', () => {
  it('parses the portfolio fixture', async () => {
    mockFetch({
      '/equity/portfolio': {
        body: [
          {
            ticker: 'AAPL_US_EQ',
            quantity: 3.5,
            averagePrice: 180.25,
            currentPrice: 195.1,
            ppl: 51.99,
            fxPpl: -2.0,
            initialFillDate: '2025-01-10T09:30:00.000Z',
          },
        ],
      },
    });
    const p = new Trading212Provider(noopSleep);
    const positions = await p.fetchPositions(CREDS);

    expect(positions).toEqual([
      {
        t212Ticker: 'AAPL_US_EQ',
        quantity: 3.5,
        averagePrice: 180.25,
        currentPrice: 195.1,
        initialFillDate: '2025-01-10T09:30:00.000Z',
      },
    ]);
  });
});

describe('Trading212Provider.fetchOrders', () => {
  it('maps BUY + SELL, normalises a GBp price ÷100 → GBP, sums taxes into fee', async () => {
    mockFetch({
      '/equity/history/orders': {
        body: {
          items: [
            {
              order: {
                id: 1001,
                side: 'BUY',
                ticker: 'AAPL_US_EQ',
                instrument: { ticker: 'AAPL_US_EQ', name: 'Apple Inc', isin: 'US0378331005', currency: 'USD' },
              },
              fill: {
                quantity: 2,
                price: 180.25,
                filledAt: '2025-01-10T09:30:00.000Z',
                walletImpact: {
                  currency: 'EUR',
                  fxRate: 0.92,
                  taxes: [
                    { name: 'STAMP_DUTY', quantity: 0.5, currency: 'EUR', chargedAt: '2025-01-10T09:30:00.000Z' },
                    { name: 'FINRA_FEE', quantity: 0.25, currency: 'EUR', chargedAt: '2025-01-10T09:30:00.000Z' },
                  ],
                },
              },
            },
            {
              order: {
                id: 1002,
                side: 'SELL',
                // LSE listing quoted in pence (GBp) — price must be ÷100, currency → GBP.
                ticker: 'VODl_EQ',
                instrument: { ticker: 'VODl_EQ', name: 'Vodafone Group', isin: 'GB00BH4HKS39', currency: 'GBp' },
              },
              fill: {
                quantity: 100,
                price: 7250, // 7250 pence => 72.50 GBP
                filledAt: '2025-02-01T14:00:00.000Z',
                walletImpact: { currency: 'EUR', fxRate: 1.17 }, // no taxes => fee 0
              },
            },
          ],
          nextPagePath: null,
        },
      },
    });
    const p = new Trading212Provider(noopSleep);
    const { items, nextCursor } = await p.fetchOrders(CREDS);

    expect(nextCursor).toBeUndefined();
    expect(items[0]).toEqual({
      externalId: '1001',
      type: 'buy',
      t212Ticker: 'AAPL_US_EQ',
      isin: 'US0378331005',
      name: 'Apple Inc',
      currency: 'USD',
      rawCurrency: 'USD',
      quantity: 2,
      price: 180.25,
      fee: 0.75,
      fxRate: 0.92,
      occurredAt: '2025-01-10T09:30:00.000Z',
    });
    expect(items[1]).toEqual({
      externalId: '1002',
      type: 'sell',
      t212Ticker: 'VODl_EQ',
      isin: 'GB00BH4HKS39',
      name: 'Vodafone Group',
      currency: 'GBP', // GBp normalised
      rawCurrency: 'GBp', // raw instrument currency preserved
      quantity: 100,
      price: 72.5, // 7250 / 100
      fee: 0,
      fxRate: 1.17,
      occurredAt: '2025-02-01T14:00:00.000Z',
    });
  });

  it('follows nextPagePath across two pages then stops', async () => {
    const page1 = {
      items: [
        {
          order: { id: 1, side: 'BUY', ticker: 'AAPL_US_EQ', instrument: { ticker: 'AAPL_US_EQ', name: 'Apple', isin: 'US0378331005', currency: 'USD' } },
          fill: { quantity: 1, price: 100, filledAt: '2025-01-01T00:00:00.000Z', walletImpact: { fxRate: 1 } },
        },
      ],
      nextPagePath: '/api/v0/equity/history/orders?limit=50&cursor=abc',
    };
    const page2 = {
      items: [
        {
          order: { id: 2, side: 'SELL', ticker: 'AAPL_US_EQ', instrument: { ticker: 'AAPL_US_EQ', name: 'Apple', isin: 'US0378331005', currency: 'USD' } },
          fill: { quantity: 1, price: 110, filledAt: '2025-02-01T00:00:00.000Z', walletImpact: { fxRate: 1 } },
        },
      ],
      nextPagePath: null,
    };
    mockFetch({ '/equity/history/orders': [{ body: page1 }, { body: page2 }] });

    const p = new Trading212Provider(noopSleep);
    const first = await p.fetchOrders(CREDS);
    expect(first.nextCursor).toBe('/api/v0/equity/history/orders?limit=50&cursor=abc');
    expect(first.items[0].externalId).toBe('1');

    const second = await p.fetchOrders(CREDS, first.nextCursor);
    expect(second.nextCursor).toBeUndefined();
    expect(second.items[0].externalId).toBe('2');
  });
});

describe('Trading212Provider.fetchDividends', () => {
  it('maps amount/amountEur/paidOn', async () => {
    mockFetch({
      '/history/dividends': {
        body: {
          items: [
            {
              ticker: 'AAPL_US_EQ',
              instrument: { ticker: 'AAPL_US_EQ', name: 'Apple Inc', isin: 'US0378331005', currency: 'USD' },
              reference: 'DIV-7788',
              quantity: 3,
              amount: 0.72,
              currency: 'USD',
              grossAmountPerShare: 0.24,
              amountInEuro: 0.66,
              paidOn: '2025-03-15T00:00:00.000Z',
              type: 'DIVIDEND',
            },
          ],
          nextPagePath: null,
        },
      },
    });
    const p = new Trading212Provider(noopSleep);
    const { items, nextCursor } = await p.fetchDividends(CREDS);

    expect(nextCursor).toBeUndefined();
    expect(items[0]).toEqual({
      externalId: 'DIV-7788',
      type: 'dividend',
      t212Ticker: 'AAPL_US_EQ',
      isin: 'US0378331005',
      name: 'Apple Inc',
      currency: 'USD',
      rawCurrency: 'USD',
      amount: 0.72,
      amountEur: 0.66,
      occurredAt: '2025-03-15T00:00:00.000Z',
    });
  });
});

describe('Trading212Provider 429 handling', () => {
  const ordersPage = {
    items: [
      {
        order: { id: 1, side: 'BUY', ticker: 'AAPL_US_EQ', instrument: { ticker: 'AAPL_US_EQ', name: 'Apple', isin: 'US0378331005', currency: 'USD' } },
        fill: { quantity: 1, price: 100, filledAt: '2025-01-01T00:00:00.000Z', walletImpact: { fxRate: 1 } },
      },
    ],
    nextPagePath: null,
  };

  it('retries once after a 429 then returns parsed data on the 200', async () => {
    const spy = mockFetch({
      '/equity/history/orders': [
        { ok: false, status: 429, headers: { 'retry-after': '5' } },
        { body: ordersPage },
      ],
    });
    const p = new Trading212Provider(noopSleep);
    const { items } = await p.fetchOrders(CREDS);

    // The retry actually happened: two fetches to the same endpoint.
    expect(spy).toHaveBeenCalledTimes(2);
    expect(items[0].externalId).toBe('1');
  });

  it('throws Trading212ApiError when a history fetch stays 429 after the retry', async () => {
    mockFetch({
      '/equity/history/orders': [
        { ok: false, status: 429, headers: { 'retry-after': '5' } },
        { ok: false, status: 429, headers: { 'retry-after': '5' } },
      ],
    });
    const p = new Trading212Provider(noopSleep);
    // Must throw — NOT silently return an empty page (which would truncate the ledger).
    await expect(p.fetchOrders(CREDS)).rejects.toBeInstanceOf(Trading212ApiError);
    await expect(p.fetchOrders(CREDS)).rejects.toMatchObject({ status: 429 });
  });

  it('follows an ABSOLUTE-URL nextPagePath cursor', async () => {
    const page1 = {
      items: [
        {
          order: { id: 1, side: 'BUY', ticker: 'AAPL_US_EQ', instrument: { ticker: 'AAPL_US_EQ', name: 'Apple', isin: 'US0378331005', currency: 'USD' } },
          fill: { quantity: 1, price: 100, filledAt: '2025-01-01T00:00:00.000Z', walletImpact: { fxRate: 1 } },
        },
      ],
      nextPagePath: 'https://live.trading212.com/api/v0/equity/history/orders?limit=50&cursor=xyz',
    };
    const page2 = {
      items: [
        {
          order: { id: 2, side: 'SELL', ticker: 'AAPL_US_EQ', instrument: { ticker: 'AAPL_US_EQ', name: 'Apple', isin: 'US0378331005', currency: 'USD' } },
          fill: { quantity: 1, price: 110, filledAt: '2025-02-01T00:00:00.000Z', walletImpact: { fxRate: 1 } },
        },
      ],
      nextPagePath: null,
    };
    const spy = mockFetch({ '/equity/history/orders': [{ body: page1 }, { body: page2 }] });

    const p = new Trading212Provider(noopSleep);
    const first = await p.fetchOrders(CREDS);
    const absoluteCursor = first.nextCursor!;
    expect(absoluteCursor.startsWith('http')).toBe(true);

    const second = await p.fetchOrders(CREDS, absoluteCursor);
    expect(second.items[0].externalId).toBe('2');
    expect(second.nextCursor).toBeUndefined();
    // The absolute cursor was fetched verbatim (no BASE_URL re-prefixing).
    expect(spy.mock.calls[1][0]).toBe(absoluteCursor);
  });
});

describe('Trading212Provider malformed body handling', () => {
  it('fetchPositions surfaces a malformed 200 body as Trading212ApiError, not a raw SyntaxError', async () => {
    mockFetch({ '/equity/portfolio': { ok: true, status: 200, jsonThrows: true } });
    const p = new Trading212Provider(noopSleep);
    // A malformed 200 is treated as non-ok by fetchJson → fetchPositions throws
    // Trading212ApiError rather than letting the raw JSON SyntaxError escape.
    await expect(p.fetchPositions(CREDS)).rejects.toBeInstanceOf(Trading212ApiError);
  });
});
