// /api/holdings CRUD for manual accounts. Mounted behind authMiddleware +
// rateLimit. Every write also appends to the transactions audit log (buy / sell
// / adjustment) and keeps the holding's quantity + cost_basis consistent via the
// weighted-average math in db/costBasis.ts.
//
// SECURITY: `user` is always c.var.pbUserId; every by-id route enforces
// ownership with requireOwned (the admin repo bypasses PocketBase rules).
//
// CLOSED holdings: the schema has no closed_at field, so a fully-sold position is
// represented by quantity 0 and filtered out of GET /api/holdings (openOnly).

import { Hono } from 'hono';
import { z } from 'zod';
import { HTTPException } from 'hono/http-exception';
import { holdingsRepo } from '../db/holdings';
import { transactionsRepo } from '../db/transactions';
import { accountsRepo } from '../db/accounts';
import {
  applyAdjustment,
  applySell,
  mergeBuy,
} from '../db/costBasis';
import type { TransactionCreate } from '../db/schemas';
import { parseBody, readJson, requireOwned } from './_helpers';

type Vars = { Variables: { uid: string; email: string; pbUserId: string } };

// --- input schemas (client-controllable fields only) ------------------------

// Manual add. cost_basis is the TOTAL added cost; cost_currency pairs with it.
// price (per-share) is optional — derived from cost_basis/quantity when omitted.
const addSchema = z.object({
  account: z.string().min(1),
  ticker: z.string().min(1),
  isin: z.string().optional(),
  quantity: z.number().positive(),
  cost_basis: z.number().nonnegative().nullable().optional(),
  cost_currency: z.string().nullable().optional(),
  price: z.number().nonnegative().optional(),
  notes: z.string().optional(),
});

const sellSchema = z.object({
  quantity: z.number().positive(),
  price: z.number().nonnegative(),
  currency: z.string().min(1),
});

const adjustSchema = z
  .object({
    quantity: z.number().positive().optional(),
    cost_basis: z.number().nonnegative().nullable().optional(),
    cost_currency: z.string().nullable().optional(),
    notes: z.string().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: 'at least one field required',
  });

// Full sell needs a sale price/currency to record an honest transaction.
const fullSellSchema = z.object({
  price: z.number().nonnegative(),
  currency: z.string().min(1),
});

const nowIso = () => new Date().toISOString();

export const holdingRoutes = new Hono<Vars>()
  // GET /api/holdings?accountId=... — open positions, optionally per account.
  .get('/', async (c) => {
    const account = c.req.query('accountId') || undefined;
    const holdings = await holdingsRepo.listForUser(c.var.pbUserId, {
      account,
      openOnly: true,
    });
    return c.json(holdings);
  })

  // POST /api/holdings — manual add: write a buy tx + upsert the holding by
  // (user, account, ticker) using weighted-average cost.
  .post('/', async (c) => {
    const body = parseBody(addSchema, await readJson(c));
    const pbUserId = c.var.pbUserId;

    // The account must exist AND belong to this user (else IDOR via account id).
    await requireOwned(accountsRepo, body.account, pbUserId);

    const existing = await holdingsRepo.findByTicker(
      pbUserId,
      body.account,
      body.ticker,
    );

    // Per-share price for the buy transaction: explicit, else derived from the
    // added total cost, else 0 (cost unknown — e.g. importing without a basis).
    const perSharePrice =
      body.price ??
      (body.cost_basis != null ? body.cost_basis / body.quantity : 0);
    const txCurrency = body.cost_currency ?? 'EUR';

    const merged = mergeBuy(existing, {
      quantity: body.quantity,
      cost_basis: body.cost_basis ?? null,
      cost_currency: body.cost_currency ?? null,
    });

    const holding = existing
      ? await holdingsRepo.update(existing.id, {
          quantity: merged.quantity,
          cost_basis: merged.cost_basis,
          cost_currency: merged.cost_currency,
        })
      : await holdingsRepo.create({
          user: pbUserId,
          account: body.account,
          ticker: body.ticker,
          isin: body.isin,
          quantity: merged.quantity,
          cost_basis: merged.cost_basis,
          cost_currency: merged.cost_currency,
          source: 'manual',
          notes: body.notes,
        });

    await writeTx(pbUserId, {
      account: body.account,
      holding: holding.id,
      type: 'buy',
      ticker: body.ticker,
      quantity: body.quantity,
      price: perSharePrice,
      currency: txCurrency,
    });

    return c.json(holding, 201);
  })

  // PATCH /api/holdings/:id — adjust qty/cost: write an adjustment tx + recompute.
  .patch('/:id', async (c) => {
    const id = c.req.param('id');
    const pbUserId = c.var.pbUserId;
    const holding = await requireOwned(holdingsRepo, id, pbUserId);
    const patch = parseBody(adjustSchema, await readJson(c));

    // Capture pre-update values for the audit tx before update() returns a new
    // record (the original `holding` reference must not be relied on afterward).
    const { account, ticker, cost_currency, quantity: prevQty } = holding;

    const next = applyAdjustment(holding, {
      quantity: patch.quantity,
      cost_basis: patch.cost_basis,
    });

    const updated = await holdingsRepo.update(id, {
      quantity: next.quantity,
      cost_basis: next.cost_basis,
      ...(patch.cost_currency !== undefined
        ? { cost_currency: patch.cost_currency }
        : {}),
      ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
    });

    // The adjustment tx records the quantity delta (signed) so the audit log
    // reconstructs the position. No price — an adjustment is not a market trade
    // (transactions.price is optional; see migration 1717000004).
    const qtyDelta = next.quantity - prevQty;
    await writeTx(pbUserId, {
      account,
      holding: id,
      type: 'adjustment',
      ticker,
      quantity: qtyDelta,
      currency: cost_currency ?? 'EUR',
    });

    return c.json(updated);
  })

  // POST /api/holdings/:id/sell — partial sell: write a sell tx + decrement.
  .post('/:id/sell', async (c) => {
    const id = c.req.param('id');
    const pbUserId = c.var.pbUserId;
    const holding = await requireOwned(holdingsRepo, id, pbUserId);
    const body = parseBody(sellSchema, await readJson(c));

    if (body.quantity > holding.quantity) {
      throw new HTTPException(400, { message: 'sell quantity exceeds holding' });
    }

    const { account, ticker } = holding;
    const next = applySell(holding, body.quantity);
    const updated = await holdingsRepo.update(id, {
      quantity: next.quantity, // 0 marks a closed position
      cost_basis: next.cost_basis,
    });

    await writeTx(pbUserId, {
      account,
      holding: id,
      type: 'sell',
      ticker,
      quantity: body.quantity,
      price: body.price,
      currency: body.currency,
    });

    return c.json(updated);
  })

  // DELETE /api/holdings/:id — full sell: write a sell tx for the whole position
  // and zero the quantity (closed marker). Body carries the sale price/currency.
  .delete('/:id', async (c) => {
    const id = c.req.param('id');
    const pbUserId = c.var.pbUserId;
    const holding = await requireOwned(holdingsRepo, id, pbUserId);
    const body = parseBody(fullSellSchema, await readJson(c));

    const { account, ticker, quantity: fullQty } = holding;
    const next = applySell(holding, fullQty);
    const updated = await holdingsRepo.update(id, {
      quantity: next.quantity, // 0
      cost_basis: next.cost_basis, // 0
    });

    await writeTx(pbUserId, {
      account,
      holding: id,
      type: 'sell',
      ticker,
      quantity: fullQty,
      price: body.price,
      currency: body.currency,
    });

    return c.json(updated);
  });

/** Append a transaction owned by `pbUserId`, stamping user + occurred_at + source. */
async function writeTx(
  pbUserId: string,
  tx: Omit<TransactionCreate, 'user' | 'occurred_at' | 'source'> &
    Partial<Pick<TransactionCreate, 'occurred_at' | 'source'>>,
): Promise<void> {
  await transactionsRepo.create({
    source: 'manual',
    occurred_at: nowIso(),
    ...tx,
    user: pbUserId,
  });
}
