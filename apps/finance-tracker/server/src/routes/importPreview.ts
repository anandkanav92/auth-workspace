// In-memory preview cache for the two-step statement import (Task 6.4 / I13).
//
// LIMITATION (reviewer note I13): this cache lives in PROCESS MEMORY. If the BFF
// restarts between /api/import/upload (preview) and /api/import/commit, the
// preview is lost and the user must re-upload. This is acceptable for the v1
// single-instance Mac-Mini deploy. The commit route surfaces a "preview expired
// or not found" error (NOT "invalid previewId") so the UI prompts a sensible
// re-upload rather than implying the client sent something malformed.

import { randomUUID } from 'node:crypto';
import { LRUCache } from 'lru-cache';
import type { ParsedPosition } from '../importers/types';
import type { StatementSource } from '../importers/source';

const TTL_MS = 10 * 60 * 1000; // 10 minutes

/** One holding in the computed diff between the statement and current holdings. */
export interface DiffEntry {
  ticker: string;
  isin: string;
  /** 'new' (not currently held), 'changed' (qty/cost differs), 'unchanged'. */
  status: 'new' | 'changed' | 'unchanged' | 'removed';
  /** Current quantity held (0 for a brand-new ticker). */
  currentQuantity: number;
  /** Quantity the statement reports (0 for a holding the statement dropped). */
  newQuantity: number;
  /** Statement cost basis (undefined for Revolut / a removed holding). */
  costBasis?: number;
  costCurrency?: string;
  /** True if this ticker had no symbol_profiles row before this import. */
  isNewTicker: boolean;
}

/** The cached, parsed-and-diffed statement, ready for commit. */
export interface PreviewRecord {
  pbUserId: string;
  account: string;
  source: StatementSource;
  filename: string;
  fileHash: string;
  positions: ParsedPosition[];
  diff: DiffEntry[];
  createdAt: number;
}

const cache = new LRUCache<string, PreviewRecord>({ max: 1000, ttl: TTL_MS });

/** Store a preview and return its opaque id (used by the commit route). */
export function putPreview(record: Omit<PreviewRecord, 'createdAt'>): string {
  const previewId = randomUUID();
  cache.set(previewId, { ...record, createdAt: Date.now() });
  return previewId;
}

/** Fetch a preview by id, or null if expired/never existed. */
export function getPreview(previewId: string): PreviewRecord | null {
  return cache.get(previewId) ?? null;
}

/** Drop a preview after a successful commit so it can't be replayed. */
export function deletePreview(previewId: string): void {
  cache.delete(previewId);
}

/** Test-only: clear the whole cache between cases. */
export function _clearPreviews(): void {
  cache.clear();
}
