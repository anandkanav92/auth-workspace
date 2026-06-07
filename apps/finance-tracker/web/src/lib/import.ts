/**
 * M12 — client-side contract for the statement-import flow.
 *
 * Mirrors the BFF's `POST /api/import/upload` → `POST /api/import/commit`
 * shapes (see server/src/routes/import.ts, importDiff.ts, importPreview.ts).
 * Two-step: upload returns a preview (no writes), commit applies the
 * snapshot-replace. Keep these types in sync with the server contract.
 */

import { ApiError, api } from "@/lib/api";

/** One holding in the computed diff (server `DiffEntry`). */
export interface DiffEntry {
  ticker: string;
  isin: string;
  /** Reconciliation status against the account's current holdings. */
  status: "new" | "changed" | "unchanged" | "removed";
  /** Quantity currently held (0 for a brand-new ticker). */
  currentQuantity: number;
  /** Quantity the statement reports (0 for a dropped holding). */
  newQuantity: number;
  /** Statement cost basis (absent for Revolut / removed holdings). */
  costBasis?: number;
  costCurrency?: string;
  /** True if this ticker had no symbol_profiles row before this import. */
  isNewTicker: boolean;
}

/** Summary counts the BFF returns alongside the diff. */
export interface DiffSummary {
  total: number;
  new: number;
  changed: number;
  unchanged: number;
  removed: number;
  newTickers: number;
}

/** Successful `POST /api/import/upload` response. */
export interface UploadPreview {
  previewId: string;
  diff: DiffEntry[];
  summary: DiffSummary;
}

/** Successful `POST /api/import/commit` response. */
export interface CommitResult {
  ok: true;
  importId: string;
  rowCount: number;
}

/** 409 body the BFF returns when the same file was already imported. */
export interface AlreadyImportedBody {
  error: "already_imported";
  /** ISO timestamp of the prior import. */
  importedAt: string;
  filename: string;
}

/** Narrow an {@link ApiError} to the 409 "already imported" case. */
export function isAlreadyImported(
  error: unknown,
): error is ApiError & { body: AlreadyImportedBody } {
  if (!(error instanceof ApiError) || error.status !== 409) return false;
  const body = error.body;
  return (
    typeof body === "object" &&
    body !== null &&
    (body as { error?: unknown }).error === "already_imported"
  );
}

/** Upload a statement PDF for the given account and get back a preview. */
export function uploadStatement(
  file: File,
  accountId: string,
): Promise<UploadPreview> {
  const form = new FormData();
  form.append("file", file);
  form.append("accountId", accountId);
  return api.post<UploadPreview>("/api/import/upload", form);
}

/** Commit a previously-uploaded preview (snapshot-replace the holdings). */
export function commitImport(previewId: string): Promise<CommitResult> {
  return api.post<CommitResult>("/api/import/commit", { previewId });
}
