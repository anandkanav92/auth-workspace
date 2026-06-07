// Atomic snapshot-replace for the statement-import commit (M6, C1 fix).
//
// WHY THIS EXISTS (C1 data-loss bug): the original commit deleted ALL holdings
// for (user, account) in one loop, then inserted the statement's positions in a
// second loop — non-transactional, no try/catch. If any insert threw after the
// delete-all, the account was left WIPED and the imports row was never written.
// A unique-index violation on the imports row (see I1) hit this exact way.
//
// FIX: collect the deletes + holding creates + the imports-row create into a
// SINGLE PocketBase batch (pb.createBatch()) and send it as ONE transaction.
// PocketBase runs the whole batch in a DB transaction and rolls back every
// request if any one fails (verified empirically against v0.23.11: a batch with
// one invalid create returns 400 and leaves zero rows behind). So the commit is
// now all-or-nothing: either the account is fully replaced AND the imports row
// written, or nothing changes.
//
// REQUIRES: PocketBase's batch endpoint is disabled by default and returns 403
// "Batch requests are not allowed." until `batch.enabled` is on. Migration
// 1717000005 turns it on for this deployment's shared PocketBase.
//
// This helper spans TWO collections (holdings + imports) in one batch, so it
// lives here rather than on a single per-collection repo. It uses a fresh
// pbAdmin() client (same admin token the repos use; see lib/pb.ts).

import { pbAdmin } from '../lib/pb';
import type { Holding, HoldingCreate, Import, ImportCreate } from './schemas';

/** A holding to delete in the snapshot-replace (only its id is needed). */
type Deletable = Pick<Holding, 'id'>;

/**
 * Atomically replace a (user, account)'s holdings and write the imports row.
 *
 * Runs as a single PocketBase batch transaction: delete every `existing`
 * holding, create every `holdings` row, then create the `importRow`. If ANY
 * request in the batch fails (e.g. the imports-row unique-index violation from
 * I1, or an invalid position), PocketBase rolls back the entire batch — the
 * account's prior holdings are preserved and no imports row is written.
 *
 * @returns the created imports row (PocketBase echoes the created records back).
 */
export async function commitSnapshotReplace(args: {
  existing: Deletable[];
  holdings: HoldingCreate[];
  importRow: ImportCreate;
}): Promise<Import> {
  const pb = await pbAdmin();
  const batch = pb.createBatch();

  for (const h of args.existing) {
    batch.collection('holdings').delete(h.id);
  }
  for (const row of args.holdings) {
    batch.collection('holdings').create(row);
  }
  // The imports row is the LAST request: if its unique-index check fails (I1),
  // the whole batch — including the deletes — rolls back. No wipe-then-500.
  batch.collection('imports').create(args.importRow);

  const results = await batch.send();
  // The last result is the imports-row create; its body is the created record.
  const importResult = results[results.length - 1];
  return importResult.body as Import;
}
