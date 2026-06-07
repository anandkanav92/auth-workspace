// /api/accounts CRUD. Mounted behind authMiddleware + rateLimit, so c.var is
// always populated. `user` is ALWAYS taken from c.var.pbUserId — never the
// request body — and every by-id route enforces ownership via requireOwned
// (the admin repo bypasses PB rules; see _helpers.ts).

import { Hono } from 'hono';
import { z } from 'zod';
import { accountsRepo } from '../db/accounts';
import { parseBody, readJson, requireOwned } from './_helpers';

type Vars = { Variables: { uid: string; email: string; pbUserId: string } };

// Client-supplied fields only — `user` is injected server-side from pbUserId.
const sourceEnum = z.enum(['revolut', 'trading212', 'manual']);
const accountInputSchema = z.object({
  source: sourceEnum,
  label: z.string().min(1),
  currency: z.string().optional(),
});
const accountPatchSchema = accountInputSchema.partial();

export const accountRoutes = new Hono<Vars>()
  // POST /api/accounts — create
  .post('/', async (c) => {
    const body = parseBody(accountInputSchema, await readJson(c));
    const created = await accountsRepo.create({ ...body, user: c.var.pbUserId });
    return c.json(created, 201);
  })

  // GET /api/accounts — list (this user only)
  .get('/', async (c) => {
    const accounts = await accountsRepo.list(c.var.pbUserId);
    return c.json(accounts);
  })

  // PATCH /api/accounts/:id — update (owner only)
  .patch('/:id', async (c) => {
    const id = c.req.param('id');
    await requireOwned(accountsRepo, id, c.var.pbUserId);
    const patch = parseBody(accountPatchSchema, await readJson(c));
    const updated = await accountsRepo.update(id, patch);
    return c.json(updated);
  })

  // DELETE /api/accounts/:id — delete (owner only; PB cascade removes children)
  .delete('/:id', async (c) => {
    const id = c.req.param('id');
    await requireOwned(accountsRepo, id, c.var.pbUserId);
    await accountsRepo.delete(id);
    return c.json({ ok: true });
  });
