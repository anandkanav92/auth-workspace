import { Hono } from 'hono';

// /api/auth/me — echoes the authed identity. Mounted behind authMiddleware, so
// c.var is always populated here. Variables typing mirrors the middleware so
// c.var.uid / email / pbUserId are typed (not unknown).
export const authRoutes = new Hono<{
  Variables: { uid: string; email: string; pbUserId: string };
}>().get('/me', (c) =>
  c.json({ uid: c.var.uid, email: c.var.email, pbUserId: c.var.pbUserId }),
);
