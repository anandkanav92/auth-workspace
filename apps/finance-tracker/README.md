# finance-tracker

A polish-first, multi-tenant investment dashboard: Vite + React 19 + TS PWA
(`web/`) backed by a Hono BFF (`server/`), talking to PocketBase plus external
market-data providers (Yahoo Finance, Finnhub, ECB FX).

## Development

```bash
pnpm --filter finance-tracker dev   # web on :5173, BFF on :3110
```

See `docs/plans/2026-06-06-investment-dashboard-design.md` for the full design
and `docs/plans/2026-06-06-investment-dashboard-implementation.md` for the
implementation plan.
