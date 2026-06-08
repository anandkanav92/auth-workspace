// Zod schemas mirroring the 8 PocketBase collections (design §4, and the
// authoritative migrations under pb-schema/migrations/). Each `*Schema` is the
// shape of a *persisted* record as returned by PocketBase — it therefore
// includes the system fields (`id`, `created`, `updated`). The matching
// `*CreateSchema` / `*UpdateSchema` describe the user-supplied write payloads.
//
// TS types are derived via `z.infer` so the repos and routes share one source
// of truth with runtime validation.
//
// Field nullability follows the migrations exactly. PocketBase represents
// "unset optional" fields as empty string / 0 rather than null on read, so the
// read schemas accept those loosely (optional) while keeping required fields
// strict.

import { z } from 'zod';

// --- shared building blocks -------------------------------------------------

// PocketBase system fields present on every base-collection record.
const baseRecord = {
  id: z.string(),
  created: z.string(),
  updated: z.string(),
};

const sourceEnum = z.enum(['revolut', 'trading212', 'manual']);
const statementSourceEnum = z.enum(['revolut', 'trading212']);
const transactionTypeEnum = z.enum([
  'buy',
  'sell',
  'dividend',
  'fee',
  'adjustment',
  'import',
]);
const importStatusEnum = z.enum(['success', 'partial', 'failed']);
const assetTypeEnum = z.enum(['stock', 'etf', 'other']);
const dataSourceEnum = z.enum(['yahoo', 'finnhub']);
const brokerEnum = z.enum(['trading212']);
const brokerStatusEnum = z.enum(['connected', 'error']);

// =====================================================================
// Per-user collections
// =====================================================================

// --- accounts ---------------------------------------------------------------
export const accountSchema = z.object({
  ...baseRecord,
  user: z.string(),
  source: sourceEnum,
  label: z.string().min(1),
  currency: z.string().optional(), // null = inherit user default (EUR)
});

export const accountCreateSchema = z.object({
  user: z.string().min(1),
  source: sourceEnum,
  label: z.string().min(1),
  currency: z.string().optional(),
});

export const accountUpdateSchema = accountCreateSchema.partial();

// --- holdings ---------------------------------------------------------------
// cost_basis + cost_currency are NULLABLE (Revolut PDF has no cost basis).
export const holdingSchema = z.object({
  ...baseRecord,
  user: z.string(),
  account: z.string(),
  ticker: z.string().min(1),
  isin: z.string().optional(),
  quantity: z.number(),
  cost_basis: z.number().nullable().optional(),
  cost_currency: z.string().nullable().optional(),
  source: sourceEnum,
  notes: z.string().optional(),
});

export const holdingCreateSchema = z.object({
  user: z.string().min(1),
  account: z.string().min(1),
  ticker: z.string().min(1),
  isin: z.string().optional(),
  quantity: z.number(),
  cost_basis: z.number().nullable().optional(),
  cost_currency: z.string().nullable().optional(),
  source: sourceEnum,
  notes: z.string().optional(),
});

export const holdingUpdateSchema = holdingCreateSchema.partial();

// --- transactions -----------------------------------------------------------
// Append-only audit log. `holding` is nullable (orphan dividends/fees).
export const transactionSchema = z.object({
  ...baseRecord,
  user: z.string(),
  account: z.string(),
  holding: z.string().optional(),
  type: transactionTypeEnum,
  ticker: z.string().min(1),
  quantity: z.number(),
  // price is optional: adjustments / zero-cost imports carry no per-share price
  // (migration 1717000004 relaxed the PB field). buys/sells always set it.
  price: z.number().optional(),
  currency: z.string().min(1),
  fee: z.number().optional(),
  occurred_at: z.string(),
  source: sourceEnum,
  notes: z.string().optional(),
  // Broker ledger event id for synced rows (Task 2.2). Empty/absent for manual
  // rows; backs the (user, source, external_id) partial-unique upsert.
  external_id: z.string().optional(),
});

export const transactionCreateSchema = z.object({
  user: z.string().min(1),
  account: z.string().min(1),
  holding: z.string().optional(),
  type: transactionTypeEnum,
  ticker: z.string().min(1),
  quantity: z.number(),
  price: z.number().optional(),
  currency: z.string().min(1),
  fee: z.number().optional(),
  occurred_at: z.string().min(1),
  source: sourceEnum,
  notes: z.string().optional(),
  external_id: z.string().optional(),
});

export const transactionUpdateSchema = transactionCreateSchema.partial();

// --- imports ----------------------------------------------------------------
// Idempotency + audit of statement uploads. (user, file_hash) unique.
export const importSchema = z.object({
  ...baseRecord,
  user: z.string(),
  account: z.string(),
  source: statementSourceEnum,
  filename: z.string().min(1),
  file_hash: z.string().min(1),
  row_count: z.number().optional(),
  status: importStatusEnum,
  error_log: z.string().optional(),
});

export const importCreateSchema = z.object({
  user: z.string().min(1),
  account: z.string().min(1),
  source: statementSourceEnum,
  filename: z.string().min(1),
  file_hash: z.string().min(1),
  row_count: z.number().optional(),
  status: importStatusEnum,
  error_log: z.string().optional(),
});

export const importUpdateSchema = importCreateSchema.partial();

// --- holdings_snapshot ------------------------------------------------------
// Nightly point-in-time copy of every holding.
export const holdingsSnapshotSchema = z.object({
  ...baseRecord,
  user: z.string(),
  account: z.string(),
  ticker: z.string().min(1),
  quantity: z.number(),
  cost_basis: z.number().nullable().optional(),
  eur_value: z.number(),
  date: z.string(),
});

export const holdingsSnapshotCreateSchema = z.object({
  user: z.string().min(1),
  account: z.string().min(1),
  ticker: z.string().min(1),
  quantity: z.number(),
  cost_basis: z.number().nullable().optional(),
  eur_value: z.number(),
  date: z.string().min(1),
});

export const holdingsSnapshotUpdateSchema = holdingsSnapshotCreateSchema.partial();

// --- broker_connections -----------------------------------------------------
// One row per (user, broker). Holds the AES-256-GCM-encrypted read-only API
// key (`api_key_enc`) plus sync bookkeeping. `status` defaults to "connected"
// at the app layer; PB stores it as a select. last_synced_at / last_error are
// set by the sync service.
export const brokerConnectionSchema = z.object({
  ...baseRecord,
  user: z.string(),
  broker: brokerEnum,
  api_key_enc: z.string().min(1),
  t212_account_id: z.string().optional(),
  currency: z.string().optional(),
  status: brokerStatusEnum.optional(),
  last_synced_at: z.string().optional(),
  last_error: z.string().optional(),
});

export const brokerConnectionCreateSchema = z.object({
  user: z.string().min(1),
  broker: brokerEnum,
  api_key_enc: z.string().min(1),
  t212_account_id: z.string().optional(),
  currency: z.string().optional(),
  status: brokerStatusEnum.optional(),
  last_synced_at: z.string().optional(),
  last_error: z.string().optional(),
});

export const brokerConnectionUpdateSchema =
  brokerConnectionCreateSchema.partial();

// =====================================================================
// Shared collections (read: any authed user; write: superuser only)
// =====================================================================

// --- symbol_profiles --------------------------------------------------------
// asset_type drives ETF allocation look-through; sector_weightings holds the
// ETF sector breakdown (spike 3). sector/country are null for ETFs (expected).
export const symbolProfileSchema = z.object({
  ...baseRecord,
  ticker: z.string().min(1),
  isin: z.string().optional(),
  name: z.string().min(1),
  exchange: z.string().optional(),
  asset_type: assetTypeEnum,
  listing_currency: z.string().optional(),
  sector: z.string().optional(),
  industry: z.string().optional(),
  country: z.string().optional(),
  market_cap: z.number().optional(),
  pe_ratio: z.number().optional(),
  beta: z.number().optional(),
  dividend_yield: z.number().optional(),
  sector_weightings: z.record(z.string(), z.number()).nullable().optional(),
  data_source: dataSourceEnum.optional(),
  last_refreshed_at: z.string().optional(),
});

export const symbolProfileCreateSchema = z.object({
  ticker: z.string().min(1),
  isin: z.string().optional(),
  name: z.string().min(1),
  exchange: z.string().optional(),
  asset_type: assetTypeEnum,
  listing_currency: z.string().optional(),
  sector: z.string().optional(),
  industry: z.string().optional(),
  country: z.string().optional(),
  market_cap: z.number().optional(),
  pe_ratio: z.number().optional(),
  beta: z.number().optional(),
  dividend_yield: z.number().optional(),
  sector_weightings: z.record(z.string(), z.number()).nullable().optional(),
  data_source: dataSourceEnum.optional(),
  last_refreshed_at: z.string().optional(),
});

export const symbolProfileUpdateSchema = symbolProfileCreateSchema.partial();

// --- price_cache ------------------------------------------------------------
export const priceCacheSchema = z.object({
  ...baseRecord,
  ticker: z.string().min(1),
  price: z.number(),
  currency: z.string().min(1),
  as_of: z.string().optional(),
  last_fetched_at: z.string().optional(),
  data_source: dataSourceEnum.optional(),
});

export const priceCacheCreateSchema = z.object({
  ticker: z.string().min(1),
  price: z.number(),
  currency: z.string().min(1),
  as_of: z.string().optional(),
  last_fetched_at: z.string().optional(),
  data_source: dataSourceEnum.optional(),
});

export const priceCacheUpdateSchema = priceCacheCreateSchema.partial();

// --- fx_rates ---------------------------------------------------------------
// Daily ECB reference rates, EUR base. `rates` is a JSON map { USD: 1.08, ... }.
export const fxRatesSchema = z.object({
  ...baseRecord,
  date: z.string(),
  rates: z.record(z.string(), z.number()),
});

export const fxRatesCreateSchema = z.object({
  date: z.string().min(1),
  rates: z.record(z.string(), z.number()),
});

export const fxRatesUpdateSchema = fxRatesCreateSchema.partial();

// =====================================================================
// Inferred TS types
// =====================================================================

export type Account = z.infer<typeof accountSchema>;
export type AccountCreate = z.infer<typeof accountCreateSchema>;
export type AccountUpdate = z.infer<typeof accountUpdateSchema>;

export type Holding = z.infer<typeof holdingSchema>;
export type HoldingCreate = z.infer<typeof holdingCreateSchema>;
export type HoldingUpdate = z.infer<typeof holdingUpdateSchema>;

export type Transaction = z.infer<typeof transactionSchema>;
export type TransactionCreate = z.infer<typeof transactionCreateSchema>;
export type TransactionUpdate = z.infer<typeof transactionUpdateSchema>;

export type Import = z.infer<typeof importSchema>;
export type ImportCreate = z.infer<typeof importCreateSchema>;
export type ImportUpdate = z.infer<typeof importUpdateSchema>;

export type HoldingsSnapshot = z.infer<typeof holdingsSnapshotSchema>;
export type HoldingsSnapshotCreate = z.infer<typeof holdingsSnapshotCreateSchema>;
export type HoldingsSnapshotUpdate = z.infer<typeof holdingsSnapshotUpdateSchema>;

export type SymbolProfile = z.infer<typeof symbolProfileSchema>;
export type SymbolProfileCreate = z.infer<typeof symbolProfileCreateSchema>;
export type SymbolProfileUpdate = z.infer<typeof symbolProfileUpdateSchema>;

export type PriceCache = z.infer<typeof priceCacheSchema>;
export type PriceCacheCreate = z.infer<typeof priceCacheCreateSchema>;
export type PriceCacheUpdate = z.infer<typeof priceCacheUpdateSchema>;

export type FxRates = z.infer<typeof fxRatesSchema>;
export type FxRatesCreate = z.infer<typeof fxRatesCreateSchema>;
export type FxRatesUpdate = z.infer<typeof fxRatesUpdateSchema>;

export type BrokerConnection = z.infer<typeof brokerConnectionSchema>;
export type BrokerConnectionCreate = z.infer<
  typeof brokerConnectionCreateSchema
>;
export type BrokerConnectionUpdate = z.infer<
  typeof brokerConnectionUpdateSchema
>;
